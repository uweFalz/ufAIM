// src/import/sniffers/sniffImportFile.js

import { getParserIds, loadParserModule } from '../parsers/parserRegistry.js';
import { validateParserModule } from '../parsers/validateParserModule.js';

function getFileExtension(file) {
	const name = file?.name || '';
	const idx = name.lastIndexOf('.');
	if (idx < 0) return '';
	return name.slice(idx + 1).toLowerCase();
}

async function readFileBytesSafe(file, signal) {
	try {
		throwIfAborted(signal);
		if (!file || typeof file.arrayBuffer !== 'function') return new Uint8Array();
		const buffer = await file.arrayBuffer();
		throwIfAborted(signal);
		return new Uint8Array(buffer);
	} catch (error) {
		if (error?.name === "AbortError" || signal?.aborted) throw error;
		return new Uint8Array();
	}
}

function matchesExtension(ext, extensions = []) {
	if (!ext || !Array.isArray(extensions)) return false;
	return extensions.map(e => String(e).toLowerCase()).includes(ext);
}

export async function sniffImportFile(file, context = {}) {
	const extension = getFileExtension(file);
	const signal = context?.signal;
	throwIfAborted(signal);
	const bytes = context?.bytes instanceof Uint8Array
		? context.bytes
		: await readFileBytesSafe(file, signal);
	const text = typeof context?.text === "string"
		? context.text
		: extension === "mdb" ? "" : new TextDecoder().decode(bytes);

	const parserIds = getParserIds();

	const extensionCandidates = [];
	const looksLikeCandidates = [];

	context?.onParserLoading?.();
	for (const parserId of parserIds) {
		throwIfAborted(signal);
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
				throwIfAborted(signal);
				if (looksLike) {
					looksLikeCandidates.push({
						parserId,
						confidence: extMatch ? 1.0 : 0.85,
						reason: extMatch ? 'extension + looksLike matched' : 'looksLike matched'
					});
				}
			} catch (err) {
				if (err?.name === "AbortError" || signal?.aborted) throw err;
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

function throwIfAborted(signal) {
	if (!signal?.aborted) return;
	const error = new Error(String(signal.reason ?? "Import cancelled"));
	error.name = "AbortError";
	error.code = "IMPORT_JOB_CANCELLED";
	throw error;
}

export default sniffImportFile;
