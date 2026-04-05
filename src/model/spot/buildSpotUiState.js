// src/model/spot/buildSpotUiState.js
//
// buildSpotUiState
//
// Transforms canonical SPOT state into a window-consumable UI shape.
//
// Responsibilities:
// - flattens SPOT objects into simple rows
// - extracts display-friendly metadata
// - prepares lightweight UI state (no grouping, no slots)
//
// NOT:
// - no calculations
// - no geometry generation
// - no solver/view derivations
//
// Important:
// This is a pure projection layer (SPOT → UI).
// All derived geometry must be computed via @kernel by the consumer (e.g. ViewController).
//
// Builds a simple UI state for SPOT
// → alignment-candidate board (no grouping, no slots)
//
// Input:
//   spotStore state
//
// Output:
//   {
//     rows: [...],
//     stats: {...}
//   }

//
// 🔧 Helper (klein, aber wichtig)
//
function buildSourceLabel(spot) {
	const file = spot?.source?.file ?? "";
	const name = spot?.meta?.alignmentName ?? spot?.name ?? "";
	if (!file) return name;
	return `${file} → ${name}`;
}

function buildNotes(meta = {}) {
	const notes = [];

	if (meta?.crs == null) {
		notes.push("crs=missing");
	}

	if (meta?.classification?.warnings?.length) {
		notes.push(...meta.classification.warnings.slice(0, 2));
	}

	return notes;
}

function countFiles(rows) {
	const set = new Set();
	for (const r of rows) {
		for (const f of r.files ?? []) {
			set.add(f);
		}
	}
	return set.size;
}

//
// ...
//
export function buildSpotUiState(spotState = {}) {
	const spots = Object.values(spotState?.spots ?? {});
	const activeSpotId = spotState?.meta?.activeSpotId ?? null;

	const rows = spots.map((s) => {
		const meta = s?.meta ?? {};
		const payload = s?.payload ?? {};

		return {
			spotId: s.id,
			objectId: s.id,
			isActive: s.id === activeSpotId,

			label: meta.alignmentName ?? s.name ?? "alignment",
			kind: s.kind ?? "alignment",

			outcome: meta?.classification?.status ?? "candidate",
			outcomeConfidence: meta?.classification?.confidence ?? 1,

			sourceLabel: buildSourceLabel(s),
			files: s?.source?.file ? [s.source.file] : [],

			missing: meta?.classification?.missing ?? [],
			notes: buildNotes(meta),

			// first step toward visualization
			hasSparse: Boolean(payload?.sparse),
			sparse: payload?.sparse ?? null,
		};
	});

	return {
		rows,
		activeSpotId,
		stats: {
			total: rows.length,
			filesSeen: countFiles(rows),
		},
	};
}
