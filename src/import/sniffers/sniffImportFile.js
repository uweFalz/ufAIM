// src/import/sniffers/sniffImportFile.js

export async function sniffImportFile(file) {
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
