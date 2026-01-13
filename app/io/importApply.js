export function applyImportToProject({ project, store, imp, draft, slot, ui }) {
	// Keep this minimal: write polyline + marker to store,
	// so the renderer can show it immediately.
	if (!draft?.right?.polyline2d || draft.right.polyline2d.length < 2) {
		return [{ type: "log", level: "error", message: "importApply: no polyline2d" }];
	}

	const polyline2d = draft.right.polyline2d;
	const marker = draft.right.bboxCenter ?? polyline2d[0];

	store.setState({
		import_polyline: polyline2d,
		import_marker: marker,
		import_meta: {
			base: draft.id,
			slot,
			source: draft.source,
			points: polyline2d.length,
		},
	});

	return [
		{ type: "log", level: "info", message: `applyImport: ${draft.id} pts=${polyline2d.length}` },
		{ type: "props", object: { import: draft.id, pts: polyline2d.length, slot } },
	];
}
