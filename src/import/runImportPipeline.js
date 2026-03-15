// src/import/runImportPipeline.js

import { sniffImportFile } from "./sniffers/sniffImportFile.js";
import { resolveParser } from "./parsers/parserRegistry.js";
import { normalizeLandFATToSparse } from "./domain/normalizeLandFATToSparse.js";
import { classifyAlignmentForSpot } from "./domain/classifyImportResult.js";
import { IMPORT_REASONS } from "./domain/importReasons.js";

//
// ...
//
export async function future_runImportPipeline(file, context = {}) {
	const log = typeof context.log === "function" ? context.log : () => {};

	const sniff = await sniffImportFile(file);
	const parser = resolveParser(sniff);

	if (!parser) {
		return makeUnknownImportResult(file, sniff);
	}

	log(`import: ${parser.label} :: ${file.name}`);

	const raw = await parser.parseToLandFAT(file, { log, sniff });

	const parsed = {
		stage: "parsed",
		descriptor: {
			fileName: file.name,
			format:
			sniff?.format ??
			(parser.id === "landxml" ? "landXML" : parser.id?.toUpperCase?.() ?? "unknown"),
			parserKey,
		},
		raw,
	};

	return normalizeParsedResult(parsed, {
		log,
		file,
		sniff: { ...sniff, parserKey },
		parserId: parser.id,
	});

	const sparseReady = normalizeLandFATDomain(normalized, {
		log,
		file,
		sniff,
	});

	return classifyImportResult(sparseReady, {
		log,
		file,
		sniff,
	});
}

export async function runImportPipeline(file, context = {}) {
	const log = typeof context.log === "function" ? context.log : () => {};

	const sniff = await sniffImportFile(file);

	const parserKey =
	sniff?.parserKey ??
	(sniff?.format === "landXML" ? "landxml" : null) ??
	(sniff?.format === "TRA" ? "tra" : null) ??
	(sniff?.format === "GRA" ? "gra" : null);

	log(`sniff raw: ${JSON.stringify(sniff ?? null)}`);
	log(`parserKey resolved: ${parserKey ?? "(none)"}`);

	if (!parserKey) {
		return {
			status: "unknown",
			spotCandidates: [],
			workingItems: [],
			referenceItems: [],
		};
	}

	const parser = resolveParser({ ...sniff, parserKey });

	if (!parser) {
		throw new Error(`No parser registered for ${parserKey}`);
	}

	log(`import: ${parser.label} :: ${file.name}`);

	const raw = await parser.parseToLandFAT(file, {
		log,
		sniff: { ...sniff, parserKey },
	});

	log(`raw keys: ${Object.keys(raw ?? {}).join(",")}`);

	const parsed = {
		stage: "parsed",
		descriptor: {
			fileName: file.name,
			format:
			sniff?.format ??
			(parser.id === "landxml" ? "landXML" :
			parser.id === "vermesn" ? file.name.split(".").pop()?.toUpperCase() ?? "unknown" :
			parser.id ?? "unknown"),
		},
		raw,
	};

	log(`wrapped parsed descriptor: ${JSON.stringify(parsed.descriptor)}`);

	return normalizeParsedResult(parsed, {
		log,
		file,
		sniff: { ...sniff, parserKey },
		parserId: parser.id,
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
	
	log(`normalizeParsedResult descriptor: ${JSON.stringify(parsed?.descriptor ?? null)}`);
	log(`normalizeParsedResult raw keys: ${Object.keys(parsed?.raw ?? {}).join(",")}`);

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

		const spotCandidates = [];
		const workingItems = [];
		const sourceFile = imported?.meta?.sourceFile ?? fileName ?? null;

		for (const [index, alignment] of alignments.entries()) {
			const name = alignment?.name ?? `alignment_${index + 1}`;

			// 1) sparse erzeugen, falls noch nicht vorhanden
			if (!alignment?.sparseAlignment) {
				try {
					alignment.sparseAlignment = normalizeLandFATToSparse(alignment, {
						log,
						sourceFormat: "landXML",
						sourceFile,
					});
				} catch (err) {
					log(
					`normalizeLandFATToSparse failed for ${name}: ${String(err?.message ?? err)}`
					);
					alignment.sparseAlignment = null;
				}
			}

			// 2) Klassifikation
			const verdict = classifyAlignmentForSpot(alignment, { imported });

			log(
			`alignment[${index}] name=${name} ` +
			`sparse=${!!alignment?.sparseAlignment} ` +
			`crs=${JSON.stringify(verdict?.crs ?? null)} ` +
			`verdict=${verdict?.code ?? "UNKNOWN"}`
			);

			// 3) SPOT-ready -> spotCandidate
			if (verdict?.ok) {
				try {
					const candidate = buildAlignmentSpotCandidate({
						alignment,
						fileName: sourceFile,
						sourceFormat: "landXML",
						fallbackName: name,
						crs: verdict.crs,
						classification: {
							roleCandidate: "unassigned",
							confidence: null,
						},
					});

					if (candidate) {
						spotCandidates.push(candidate);
						continue;
					}
				} catch (err) {
					log(`spotCandidate build failed for ${name}: ${String(err?.message ?? err)}`);
				}
			}

			// 4) Nicht SPOT-ready -> Working Set / Giftschrank
			workingItems.push(
			makeWorkingItem({
				kind: "landFATAlignment",
				name,
				sourceFormat: "landXML",
				sourceFile,
				payload: alignment,
				meta: {
					alignmentName: alignment?.name ?? null,
					crs: verdict?.crs ?? { status: "needed" },
					giftCabinetReason:
					verdict?.code ?? IMPORT_REASONS.SPARSE_BUILD_FAILED,
				},
			})
			);
		}

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

function buildAlignmentSpotCandidate({
	alignment,
	fileName,
	sourceFormat,
	fallbackName,
	crs,
	classification = {},
}) {
	const sparse = alignment?.sparseAlignment ?? null;
	if (!sparse) return null;

	const effectiveName = alignment?.name ?? fallbackName ?? "alignment";

	if (!crs?.authority || !crs?.code) {
		throw new Error(
		`spotCandidate requires CRS: ${effectiveName} :: ${fileName ?? "(unknown file)"}`
		);
	}

	return {
		id: makeDeterministicSpotId({
			kind: "alignment",
			name: effectiveName,
			sourceFormat,
			sourceFile: fileName ?? null,
			alignmentName: alignment?.name ?? null,
		}),

		kind: "alignment",
		role: "candidate",
		name: effectiveName,

		crs: {
			authority: crs.authority,
			code: crs.code,
			axisOrder: crs.axisOrder ?? "xy",
			units: crs.units ?? "m",
			vertical: crs.vertical ?? null,
			source: crs.source ?? "parser",
		},

		model: {
			type: "sparseAlignment",
			data: sparse,
			geometryLevel: "analytic",
		},

		provenance: {
			sourceFormat,
			sourceFile: fileName ?? null,
			alignmentName: alignment?.name ?? null,
		},

		classification: {
			roleCandidate: classification.roleCandidate ?? null,
			confidence: classification.confidence ?? null,
		},

		status: {
			editable: true,
			valid: true,
			dirty: false,
		},

		links: {},
	};
}

function resolveEffectiveCRS(container, alignment) {
	return (
	alignment?.crs ??
	container?.meta?.crs ??
	container?.crs ??
	null
	);
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

function makeId(prefix) {
	return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}
