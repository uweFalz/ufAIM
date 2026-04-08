// app/examples/workerImportMirror.js

import { debugLog, debugError } from "@src/shared/debug/debugLog.js";

export async function workerImportMirror(label, importer) {
	try {
		const mod = await importer();

		debugLog("workerImportMirror", `${label} succeeded`, {
			keys: mod ? Object.keys(mod) : [],
		});

		return {
			ok: true,
			module: mod ?? null,
		};
	} catch (err) {
		debugError("workerImportMirror", `${label} failed`, {
			message: err?.message ?? String(err),
			stack: err?.stack ?? null,
		});

		return {
			ok: false,
			error: err,
		};
	}
}
