// app/io/importApply.js

export function applyImportToProject({ project, store, imp, draft, slot, ui }) {
	// 1) Always: basic feedback per file
	ui?.log?.(`import ok: ${imp.kind} ${imp.name} bytes=${imp.meta?.bytes ?? "?"}`);

	// show per-file meta, but keep it light (draft will override)
	ui?.showProps?.({
		kind: imp.kind,
		name: imp.name,
		meta: imp.meta ?? null
	});

	// 2) If no paired draft yet -> no more side effects
	if (!draft) return null;

	// 3) Draft ready -> drive the "import bridge" (single place!)
	const poly = draft?.right?.polyline2d ?? [];
	const center = draft?.right?.bboxCenter ?? null;

	store.setState({
		import_polyline: poly,
		import_marker: center
	});

	// expose for debugging
	window.__sevenLinesDraft = draft;

	// props now show the full draft
	ui?.showProps?.(draft);
	ui?.log?.(`SevenLinesDraft ready: ${draft.id} ✅`);

	// 4) Zoom-to-fit: only once per base (optional but recommended)
	if (slot) {
		if (slot.fitted) return null;
		slot.fitted = true;
	}

	return {
		zoomBBox: draft?.right?.bbox ?? null
	};
}
