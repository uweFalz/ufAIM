// app/core/import/summarizeImportForUser.js

import { t } from "@app/i18n/strings.js";

/**
 * Create user-facing import summary text
 *
 * @param {Object} params
 * @param {string} params.fileName
 * @param {string} params.sourceFormat   // "vermesn" | "landxml" | "gnd" | "unknown"
 * @param {number} params.spotCount
 * @param {number} params.auxCount
 * @param {boolean} params.failed
 */
export function summarizeImportForUser({
	fileName,
	sourceFormat,
	spotCount = 0,
	auxCount = 0,
	failed = false,
} = {}) {

	// --- detection (optional, for logInfo)
	let detectedKey = null;
	switch (sourceFormat) {
		case "vermesn": detectedKey = "import_detected_vermesn"; break;
		case "landxml": detectedKey = "import_detected_landxml"; break;
		case "gnd":     detectedKey = "import_detected_gnd"; break;
		default:        detectedKey = "import_detected_unknown";
	}

	// --- result
	if (failed) {
		return {
			detected: t(detectedKey),
			result: t("import_result_failed", { fileName }),
		};
	}

	if (spotCount === 1) {
		return {
			detected: t(detectedKey),
			result: t("import_result_alignment_ready", { fileName }),
		};
	}

	if (spotCount > 1) {
		return {
			detected: t(detectedKey),
			result: t("import_result_alignments_ready", { fileName, count: spotCount }),
		};
	}

	if (auxCount > 0) {
		return {
			detected: t(detectedKey),
			result: t("import_result_only_aux_data", { fileName }),
		};
	}

	return {
		detected: t(detectedKey),
		result: t("import_result_no_usable_alignment", { fileName }),
	};
}
