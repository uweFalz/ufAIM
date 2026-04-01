// app/io/import/importSession.js
//
// ImportSession (reduced)
//
// Rolle:
// - temporärer Client-Puffer für Import-Batches
// - liefert einfache UI-Zeilen
//
// NICHT:
// - keine Matching-Logik
// - keine Preview-Logik
// - keine Domain-Interpretation

export function makeImportSession(opts = {}) {

	const items = [];

	function ingest(importObject, ingestOpts = {}) {
		const now = Date.now();

		const entry = {
			id: `imp_${now}_${items.length}`,
			ts: now,

			name:
				importObject?.name ??
				ingestOpts?.originFile ??
				"unknown",

			kind: importObject?.kind ?? "UNKNOWN",

			file: ingestOpts?.originFile ?? null,
			slot: ingestOpts?.slotHint ?? "right",

			meta: importObject?.meta ?? null,
		};

		items.push(entry);

		return {
			ingests: [entry],
			primary: entry,
		};
	}

	function getState() {
		return items.slice().reverse();
	}

	function getUIState() {
		// aktuell identisch → später hier sort/filter möglich
		return getState();
	}

	function clear() {
		items.length = 0;
	}

	return {
		ingest,
		getState,
		getUIState,
		clear,
	};
}
