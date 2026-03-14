// src/import/runImportPipeline.js

import { sniffImportFile } from "./sniffers/sniffImportFile.js";
import { importFileAuto } from "./parsers/importTRA_GRA.js";
import { parseLandXML } from "./parsers/parseLandXML.js";

export async function runImportPipeline(file, context = {}) {
	const log = typeof context.log === "function" ? context.log : () => {};

	const descriptor = await sniffImportFile(file);
	log(`import: ${descriptor.format} :: ${descriptor.fileName ?? "(unknown)"}`);

	if (descriptor.disposition === "ignore") {
		return makePipelineResult({
			descriptor,
			status: "ignored",
			reason: descriptor.reason ?? "ignored",
		});
	}

	if (descriptor.disposition === "recognized-unsupported") {
		return makePipelineResult({
			descriptor,
			status: "recognized-unsupported",
			reason: descriptor.reason ?? "recognized-but-not-supported",
		});
	}

	if (descriptor.disposition === "unknown") {
		return makePipelineResult({
			descriptor,
			status: "unknown",
			reason: "unknown-format",
		});
	}

	const parsed = await parseImportFile(file, descriptor, { log });
	const normalized = normalizeParsedResult(parsed, { log });

	return makePipelineResult({
		descriptor,
		status: normalized.isEmpty ? "empty" : "imported",
		reason: normalized.reason ?? null,
		spotCandidates: normalized.spotCandidates,
		workingItems: normalized.workingItems,
		referenceItems: normalized.referenceItems,
	});
}

async function parseImportFile(file, descriptor, context = {}) {
	const log = typeof context.log === "function" ? context.log : () => {};

	switch (descriptor.format) {
		case "TRA":
		case "GRA": {
			const imported = await importFileAuto(file);

			return {
				stage: "parsed",
				descriptor,
				raw: imported,
			};
		}

		case "landXML": {
			const text = await file.text();
			const imported = await parseLandXML(text, file.name);

			return {
				stage: "parsed",
				descriptor,
				raw: imported,
			};
		}

		default:
			log(`no parser wired for supported format? ${descriptor.format} :: ${descriptor.fileName}`);
			throw new Error(`No parser for format: ${descriptor?.format ?? "unknown"}`);
	}
}

function makePipelineResult({
	descriptor,
	status = "unknown",
	reason = null,
	spotCandidates = [],
	workingItems = [],
	referenceItems = [],
}) {
	return {
		descriptor,
		status,
		reason,
		spotCandidates,
		workingItems,
		referenceItems,
	};
}

function normalizeParsedResult(parsed, context = {}) {
	const log = typeof context.log === "function" ? context.log : () => {};
	const imported = parsed?.raw;
	const descriptor = parsed?.descriptor ?? {};
	const fileName = descriptor.fileName ?? null;
	const sourceFormat = descriptor.format ?? "unknown";

	// leer/null
	if (imported == null) {
		log(`parsed result empty: ${fileName ?? "(unknown file)"}`);
		return {
			isEmpty: true,
			reason: "parsed-empty",
			spotCandidates: [],
			workingItems: [],
			referenceItems: [],
		};
	}

	// ----------------------------------------
	// A) Legacy single object (.kind)
	// ----------------------------------------
	if (imported && imported.kind) {
		log(`parsed single object: kind=${imported.kind}`);

		// TODO: hier später echte landFAT->sparse Normalisierung einhängen
		const sparse = tryBuildSparseCandidateFromLegacy(imported, {
			fileName,
			sourceFormat,
		});

		return {
			isEmpty: false,
			reason: null,

			spotCandidates: sparse ? [sparse] : [],

			workingItems: [
				makeWorkingItem({
					kind: imported.kind,
					name: imported.name ?? fileName ?? "import",
					sourceFormat,
					sourceFile: fileName,
					payload: imported,
				}),
			],

			referenceItems: [],
		};
	}

	// ----------------------------------------
	// B) landFAT container
	// ----------------------------------------
	if (imported?.type === "landFAT") {
		const alignments = Array.isArray(imported.alignments) ? imported.alignments : [];
		log(`parsed landFAT container: alignments=${alignments.length}`);

		if (!alignments.length) {
			return {
				isEmpty: true,
				reason: "no-alignments-in-container",
				spotCandidates: [],
				workingItems: [],
				referenceItems: [],
			};
		}

		const workingItems = alignments.map((alignment, index) =>
			makeWorkingItem({
				kind: "landFATAlignment",
				name: alignment?.name ?? `alignment_${index + 1}`,
				sourceFormat: "landXML",
				sourceFile: imported?.meta?.sourceFile ?? fileName ?? null,
				payload: alignment,
				meta: {
					alignmentName: alignment?.name ?? null,
				},
			})
		);

		const spotCandidates = alignments
			.map((alignment, index) =>
				tryBuildSpotCandidateFromLandFATAlignment(alignment, {
					fileName: imported?.meta?.sourceFile ?? fileName ?? null,
					sourceFormat: "landXML",
					fallbackName: `alignment_${index + 1}`,
				})
			)
			.filter(Boolean);

		return {
			isEmpty: false,
			reason: null,
			spotCandidates,
			workingItems,
			referenceItems: [],
		};
	}

	// ----------------------------------------
	// C) später Terrain / IFC / Referenzen
	// ----------------------------------------
	throw new Error(`Unsupported parsed result shape: ${fileName ?? "(unknown file)"}`);
}

function makeWorkingItem({
	kind,
	name,
	sourceFormat,
	sourceFile,
	payload,
	meta = {},
}) {
	return {
		id: makeId("wrk"),
		kind,
		name: name ?? "unnamed",
		source: {
			format: sourceFormat ?? "unknown",
			file: sourceFile ?? null,
		},
		payload,
		status: {
			selected: false,
			validated: false,
			assigned: false,
		},
		meta,
	};
}

function makeSpotCandidate({
	id = null,
	kind,
	role = "candidate",
	name,
	modelType,
	model,
	provenance = {},
	links = {},
}) {
	const finalId =
		id ??
		makeDeterministicSpotId({
			kind,
			name,
			sourceFormat: provenance?.sourceFormat,
			sourceFile: provenance?.sourceFile,
			alignmentName: provenance?.alignmentName,
		});

	return {
		id: finalId,
		kind,
		role,
		name: name ?? "unnamed",
		model: {
			type: modelType,
			data: model,
		},
		status: {
			editable: true,
			valid: true,
			dirty: false,
		},
		provenance,
		links,
	};
}

function makeDeterministicSpotId({
	kind,
	name,
	sourceFormat,
	sourceFile,
	alignmentName,
}) {
	const raw = [
		kind ?? "",
		name ?? "",
		sourceFormat ?? "",
		sourceFile ?? "",
		alignmentName ?? "",
	].join("::");

	return "spot_" + simpleHash(raw);
}

function simpleHash(str) {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0).toString(16);
}

function tryBuildSpotCandidateFromLandFATAlignment(alignment, {
	fileName,
	sourceFormat,
	fallbackName,
}) {
	// TODO:
	// hier später normalizeLandFATToSparse(alignment) aufrufen

	const sparse = tryExtractSparsePlaceholder(alignment);
	if (!sparse) return null;

	return makeSpotCandidate({
		kind: "alignment",
		role: "candidate",
		name: alignment?.name ?? fallbackName ?? "alignment",
		modelType: "sparseAlignment",
		model: sparse,
		provenance: {
			sourceFormat,
			sourceFile: fileName ?? null,
			alignmentName: alignment?.name ?? null,
		},
	});
}

function tryBuildSparseCandidateFromLegacy(imported, {
	fileName,
	sourceFormat,
}) {
	// TODO:
	// wenn importFileAuto später landFAT liefert, besser darüber gehen
	// aktuell nur Platzhalter / Hook

	const sparse = imported?.sparseAlignment ?? null;
	if (!sparse) return null;

	return makeSpotCandidate({
		kind: "alignment",
		role: "candidate",
		name: imported?.name ?? fileName ?? "alignment",
		modelType: "sparseAlignment",
		model: sparse,
		provenance: {
			sourceFormat,
			sourceFile: fileName ?? null,
		},
	});
}

function tryExtractSparsePlaceholder(alignment) {
	// Noch KEINE echte Konvertierung.
	// Nur wenn der Parser bereits etwas Passendes mitgibt.
	if (alignment?.sparseAlignment) return alignment.sparseAlignment;
	return null;
}

function makeId(prefix) {
	return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}
