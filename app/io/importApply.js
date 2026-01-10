// app/io/importApply.js

export function applyImportToProject({ project, store, imp, draft, slot, ui }) {
	const effects = [];

	if (imp.kind === "TRA" && (imp.meta?.points ?? 0) < 2) {
		effects.push({ type: "warn", line: `TRA has no usable points (${imp.name})` });
	}

	if (draft) {
		effects.push({ type: "toast", level: "info", text: `Import paired: ${draft.id}`, ms: 1800 });
	}

	// per-file feedback
	effects.push({
		type: "log",
		line: `import ok: ${imp.kind} ${imp.name} bytes=${imp.meta?.bytes ?? "?"}`
	});

	effects.push({
		type: "props",
		data: { kind: imp.kind, name: imp.name, meta: imp.meta ?? null }
	});

	if (!draft) return effects;

	// draft ready -> store patch
	const poly = draft?.right?.polyline2d ?? [];
	const center = draft?.right?.bboxCenter ?? null;

	effects.push({ type: "state", patch: { import_polyline: poly, import_marker: center } });

	// debug exposure (kein store/ui-effect; das ist ok als side-effect im apply)
	window.__sevenLinesDraft = draft;

	effects.push({ type: "props", data: draft });
	effects.push({ type: "log", line: `SevenLinesDraft ready: ${draft.id} ✅` });

	// zoom only once per base
	if (slot) {
		if (slot.fitted) return effects;
		slot.fitted = true;
	}

	effects.push({ type: "zoom", bbox: draft?.right?.bbox ?? null, padding: 1.35 });

	return effects;
}
