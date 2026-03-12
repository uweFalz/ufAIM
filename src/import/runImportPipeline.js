// src/import/runImportPipeline.js

import { importFileAuto } from "@src/import/parsers/importTRA_GRA.js";
import { parseLandXML } from "@src/import/parsers/parseLandXML.js";

export async function runImportPipeline(file, context = {}) {
	const log = typeof context.log === "function" ? context.log : () => {};

	const descriptor = await sniffImportFile(file);
	log(`import: ${descriptor.format} :: ${descriptor.fileName ?? "(unknown)"}`);

	// ------------------------------------------------------------
	// A) bewusst ignorierbare Dateien
	// ------------------------------------------------------------
	if (descriptor.disposition === "ignore") {
		log(`skip: ${descriptor.reason ?? "ignored"} :: ${descriptor.fileName ?? "(unknown)"}`);
		return makeSkipResult(descriptor, "ignored");
	}

	// ------------------------------------------------------------
	// B) bekannte, aber noch nicht unterstützte Formate
	// ------------------------------------------------------------
	if (descriptor.disposition === "recognized-unsupported") {
		log(`recognized but not yet supported: ${descriptor.format} :: ${descriptor.fileName ?? "(unknown)"}`);
		return makeSkipResult(descriptor, "recognized-unsupported");
	}

	// ------------------------------------------------------------
	// C) unbekanntes Format -> bei Samples/Massendrop tolerant
	// ------------------------------------------------------------
	if (descriptor.disposition === "unknown") {
		log(`skip unknown: ${descriptor.fileName ?? "(unknown)"}`);
		return makeSkipResult(descriptor, "unknown");
	}

	// ------------------------------------------------------------
	// D) unterstützte Formate normal verarbeiten
	// ------------------------------------------------------------
	const parsed = await parseImportFile(file, descriptor, { log });
	const artifacts = normalizeParsedToArtifacts(parsed, { log });

	log(`artifacts: ${artifacts.length} :: ${descriptor.fileName ?? "(unknown)"}`);

	return {
		descriptor,
		artifacts,
		status: artifacts.length ? "imported" : "empty",
		reason: artifacts.length ? null : "no-artifacts",
	};
}

async function sniffImportFile(file) {
	const fileName = String(file?.name ?? "");
	const lower = fileName.toLowerCase();
	const ext = getExtension(lower);

	// ------------------------------------------------------------
	// A) offensichtlicher Beifang / Neben-Dateien
	// ------------------------------------------------------------
	if (isIgnorableFile(lower)) {
		return {
			fileName,
			extension: ext,
			format: "IGNORED",
			family: "auxiliary",
			disposition: "ignore",
			reason: "auxiliary/thumbnail/system-file",
		};
	}

	// ------------------------------------------------------------
	// B) direkt unterstützte Spezialformate
	// ------------------------------------------------------------
	if (lower.endsWith(".tra")) {
		return {
			fileName,
			extension: ".tra",
			format: "TRA",
			family: "special",
			disposition: "supported",
		};
	}

	if (lower.endsWith(".gra")) {
		return {
			fileName,
			extension: ".gra",
			format: "GRA",
			family: "special",
			disposition: "supported",
		};
	}

	// ------------------------------------------------------------
	// C) XML-Familie: über Inhalt nachschärfen
	// ------------------------------------------------------------
	if (lower.endsWith(".landxml")) {
		return {
			fileName,
			extension: ".landxml",
			format: "landXML",
			family: "container",
			disposition: "supported",
		};
	}

	if (lower.endsWith(".xml")) {
		const text = await safeReadTextPrefix(file, 240000);

		if (looksLikeLandXML(text)) {
			return {
				fileName,
				extension: ".xml",
				format: "landXML",
				family: "container",
				disposition: "supported",
			};
		}

		if (looksLikeInfraGML(text)) {
			return {
				fileName,
				extension: ".xml",
				format: "InfraGML",
				family: "container",
				disposition: "recognized-unsupported",
			};
		}

		if (looksLikeIFCXML(text)) {
			return {
				fileName,
				extension: ".xml",
				format: "IFCXML",
				family: "container",
				disposition: "recognized-unsupported",
			};
		}

		return {
			fileName,
			extension: ".xml",
			format: "XML",
			family: "container?",
			disposition: "recognized-unsupported",
			reason: "xml-but-not-supported-import-format",
		};
	}

	// ------------------------------------------------------------
	// D) bekannte, fachlich relevante Formate aus Alt-Registry
	//     -> vorerst erkannt, aber nicht aktiv verarbeitet
	// ------------------------------------------------------------
	if (lower.endsWith(".ifcxml")) {
		return {
			fileName,
			extension: ".ifcxml",
			format: "IFCXML",
			family: "container",
			disposition: "recognized-unsupported",
		};
	}

	if (lower.endsWith(".ifc")) {
		return {
			fileName,
			extension: ".ifc",
			format: "IFC",
			family: "container",
			disposition: "recognized-unsupported",
		};
	}

	if (lower.endsWith(".ifczip")) {
		return {
			fileName,
			extension: ".ifczip",
			format: "IFCZIP",
			family: "archive",
			disposition: "recognized-unsupported",
		};
	}

	if (lower.endsWith(".ifcjson")) {
		return {
			fileName,
			extension: ".ifcjson",
			format: "IFCJSON",
			family: "container",
			disposition: "recognized-unsupported",
		};
	}

	if (lower.endsWith(".mdb")) {
		return {
			fileName,
			extension: ".mdb",
			format: "MDB",
			family: "database",
			disposition: "recognized-unsupported",
		};
	}

	if (lower.endsWith(".xlsx")) {
		return {
			fileName,
			extension: ".xlsx",
			format: "XLSX",
			family: "spreadsheet",
			disposition: "recognized-unsupported",
		};
	}

	if (lower.endsWith(".zip")) {
		return {
			fileName,
			extension: ".zip",
			format: "ZIP",
			family: "archive",
			disposition: "recognized-unsupported",
		};
	}

	// ------------------------------------------------------------
	// E) Rest: unbekannt, aber im Massendrop nicht störend
	// ------------------------------------------------------------
	return {
		fileName,
		extension: ext,
		format: "UNKNOWN",
		family: "unknown",
		disposition: "unknown",
	};
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

function normalizeParsedToArtifacts(parsed, context = {}) {
	const log = typeof context.log === "function" ? context.log : () => {};
	const imported = parsed?.raw;
	const descriptor = parsed?.descriptor ?? {};
	const fileName = descriptor?.fileName ?? null;
	const sourceFormat = descriptor?.format ?? "unknown";

	// ------------------------------------------------------------
	// A) leer/null -> tolerant
	// ------------------------------------------------------------
	if (imported == null) {
		log(`parsed result empty: ${fileName ?? "(unknown file)"}`);
		return [];
	}

	// ------------------------------------------------------------
	// B) legacy single object with .kind
	// ------------------------------------------------------------
	if (imported && imported.kind) {
		log(`parsed single object: kind=${imported.kind}`);

		return [
			makeArtifact({
				kind: imported.kind,
				type: imported.type ?? null,
				name: imported.name ?? fileName ?? "import",
				payload: imported,
				meta: {
					sourceFormat,
					sourceFile: fileName,
				},
				sourceRef: {
					name: fileName,
				},
			}),
		];
	}

	// ------------------------------------------------------------
	// C) landFAT container
	//     -> 0 alignments ist ausdrücklich erlaubt
	// ------------------------------------------------------------
	if (imported?.type === "landFAT") {
		const alignments = Array.isArray(imported.alignments) ? imported.alignments : [];
		log(`parsed landFAT container: alignments=${alignments.length}`);

		if (!alignments.length) {
			log(`no alignment artifacts in container: ${fileName ?? "(unknown file)"}`);
			return [];
		}

		return alignments.map((alignment, index) =>
			makeArtifact({
				kind: "ALIGNMENT",
				type: "alignment2D",
				name: alignment?.name ?? `alignment_${index + 1}`,
				payload: {
					kind: "ALIGNMENT",
					type: "alignment2D",
					name: alignment?.name ?? `alignment_${index + 1}`,
					landFATAlignment: alignment,
					meta: {
						sourceFormat: "landXML",
						sourceFile: imported?.meta?.sourceFile ?? fileName ?? null,
						alignmentName: alignment?.name ?? null,
					},
				},
				meta: {
					sourceFormat: "landXML",
					sourceFile: imported?.meta?.sourceFile ?? fileName ?? null,
					alignmentName: alignment?.name ?? null,
				},
				sourceRef: {
					name: fileName,
					alignmentName: alignment?.name ?? null,
				},
			})
		);
	}

	// ------------------------------------------------------------
	// D) echte Inkonsistenz
	// ------------------------------------------------------------
	throw new Error(`Unsupported parsed result shape: ${fileName ?? "(unknown file)"}`);
}

function makeArtifact({
	kind,
	type = null,
	name = null,
	payload,
	meta = {},
	sourceRef = {},
}) {
	return {
		kind,
		type,
		name,
		payload,
		meta,
		sourceRef,
	};
}

function makeSkipResult(descriptor, status) {
	return {
		descriptor,
		artifacts: [],
		status,
		reason: descriptor?.reason ?? null,
	};
}

async function safeReadTextPrefix(file, maxChars = 240000) {
	try {
		const txt = await file.text();
		return typeof txt === "string" ? txt.slice(0, maxChars) : "";
	} catch {
		return "";
	}
}

function looksLikeLandXML(text) {
	if (typeof text !== "string") return false;
	return text.includes("<LandXML") || text.includes(":LandXML");
}

function looksLikeInfraGML(text) {
	if (typeof text !== "string") return false;
	return /opengis\.net\/infragml/i.test(text) || /infra[g]?ml/i.test(text);
}

function looksLikeIFCXML(text) {
	if (typeof text !== "string") return false;
	return /ifcalignment/i.test(text) || /ifc\.org/i.test(text) || /<ifc/i.test(text);
}

function getExtension(lowerFileName) {
	const idx = lowerFileName.lastIndexOf(".");
	return idx >= 0 ? lowerFileName.slice(idx) : "";
}

function isIgnorableFile(lower) {
	if (!lower) return true;

	const base = lower.split("/").pop();

	if (
		base === ".ds_store" ||
		base === "thumbs.db" ||
		base === "desktop.ini" ||
		base === "icon\r"
	) {
		return true;
	}

	if (base.startsWith("._")) return true;

	const imageExts = new Set([
		".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
		".tif", ".tiff", ".svg", ".ico", ".heic", ".avif",
	]);

	const ext = getExtension(base);
	if (imageExts.has(ext)) return true;

	if (
		base.includes("thumbnail") ||
		base.includes("thumb") ||
		base.includes("preview") ||
		base.includes("vorscha") ||
		base.includes("cover")
	) {
		return true;
	}

	const auxExts = new Set([
		".txt", ".md", ".pdf", ".doc", ".docx",
		".xls", ".csv", ".json", ".log", ".bak", ".tmp",
	]);

	if (auxExts.has(ext)) return true;

	return false;
}
