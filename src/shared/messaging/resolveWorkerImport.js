// src/shared/messaging/resolveWorkerImport.js

import { workerImportMap } from "./workerImportMap.js";

export function resolveWorkerImport(specifier) {
	const s = String(specifier ?? "");

	for (const [alias, base] of Object.entries(workerImportMap)) {
		if (s.startsWith(alias)) {
			return base + s.slice(alias.length);
		}
	}

	throw new Error(
		`resolveWorkerImport: unresolved specifier "${s}"`
	);
}

export async function workerImport(specifier) {
	return import(resolveWorkerImport(specifier));
}
