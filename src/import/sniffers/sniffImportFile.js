// src/import/sniffers/sniffImportFile.js

import { getParserIds, loadParserModule } from '../parsers/parserRegistry.js';
import { validateParserModule } from '../parsers/validateParserModule.js';

function getFileExtension(file) {
	const name = file?.name || '';
	const idx = name.lastIndexOf('.');
	if (idx < 0) return '';
	return name.slice(idx + 1).toLowerCase();
}

async function readFileTextSafe(file) {
	try {
		if (!file || typeof file.text !== 'function') return '';
		return await file.text();
	} catch {
		return '';
	}
}

async function readFileBytesSafe(file) {
	try {
		if (!file || typeof file.arrayBuffer !== 'function') return new Uint8Array();
		const buffer = await file.arrayBuffer();
		return new Uint8Array(buffer);
	} catch {
		return new Uint8Array();
	}
}

function matchesExtension(ext, extensions = []) {
	if (!ext || !Array.isArray(extensions)) return false;
	return extensions.map(e => String(e).toLowerCase()).includes(ext);
}

export async function sniffImportFile(file, context = {}) {
	const extension = getFileExtension(file);
	const text = await readFileTextSafe(file);
	const bytes = await readFileBytesSafe(file);

	const parserIds = getParserIds();

	const extensionCandidates = [];
	const looksLikeCandidates = [];

	for (const parserId of parserIds) {
		let mod;
		try {
			mod = await loadParserModule(parserId);
			validateParserModule(parserId, mod);
		} catch (err) {
			console.warn(`[sniffImportFile] parser "${parserId}" skipped:`, err);
			continue;
		}

		const sniff = mod.sniff || {};
		const extensions = sniff.extensions || [];
		const extMatch = matchesExtension(extension, extensions);

		if (extMatch) {
			extensionCandidates.push({
				parserId,
				confidence: 0.7,
				reason: `extension ".${extension}" matched`
			});
		}

		if (typeof sniff.looksLike === 'function') {
			try {
				const looksLike = await sniff.looksLike({ file, text, bytes, context });
				if (looksLike) {
					looksLikeCandidates.push({
						parserId,
						confidence: extMatch ? 1.0 : 0.85,
						reason: extMatch ? 'extension + looksLike matched' : 'looksLike matched'
					});
				}
			} catch (err) {
				console.warn(`[sniffImportFile] looksLike failed for "${parserId}":`, err);
			}
		}
	}

	const best =
	looksLikeCandidates.sort((a, b) => b.confidence - a.confidence)[0] ||
	extensionCandidates.sort((a, b) => b.confidence - a.confidence)[0] ||
	null;

	return {
		ok: !!best,
		fileName: file?.name || '',
		extension,
		parserId: best?.parserId || null,
		confidence: best?.confidence || 0,
		reason: best?.reason || 'no parser matched'
	};
}

export default sniffImportFile;
