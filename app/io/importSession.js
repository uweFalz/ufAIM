export function makeImportSession() {
	const cacheByBase = new Map(); // baseName -> { tra?, gra?, ts }

	function ingest(importObject) {
		const base = importObject?.name ?? "unknown";
		const entry = cacheByBase.get(base) ?? { base, ts: Date.now(), tra: null, gra: null };

		if (importObject.kind === "TRA") entry.tra = importObject;
		if (importObject.kind === "GRA") entry.gra = importObject;
		entry.ts = Date.now();

		cacheByBase.set(base, entry);

		// Provide a "slot" concept (right/left later); for now always "right".
		const slot = "right";

		// Draft: if TRA exists, create a minimal draft object.
		const draft = entry.tra ? buildSevenLinesDraft(base, entry.tra, entry.gra) : null;

		return { imp: importObject, base, slot, draft };
	}

	function getState() {
		return Array.from(cacheByBase.values()).sort((a, b) => b.ts - a.ts);
	}

	return { ingest, getState };
}

function buildSevenLinesDraft(base, traImport, graImport) {
	const rawPoints =
		traImport?.geometry?.pts ??
		traImport?.geometry ??
		traImport?.pts ??
		[];

	const polyline2d = [];
	for (const p of rawPoints) {
		const x = p?.x ?? p?.[0];
		const y = p?.y ?? p?.[1];
		if (Number.isFinite(x) && Number.isFinite(y)) polyline2d.push({ x, y });
	}

	let bbox = null;
	let bboxCenter = null;
	if (polyline2d.length >= 2) {
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const p of polyline2d) {
			if (p.x < minX) minX = p.x;
			if (p.y < minY) minY = p.y;
			if (p.x > maxX) maxX = p.x;
			if (p.y > maxY) maxY = p.y;
		}
		bbox = { minX, minY, maxX, maxY };
		bboxCenter = { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 };
	}

	return {
		type: "SevenLinesDraft",
		id: base,
		source: { tra: traImport?.name, gra: graImport?.name ?? null },
		kmLine: { alignmentRef: "right" },
		right: { polyline2d, bbox, bboxCenter },
		left: null,
		grade: graImport?.grade ?? null,
		cant: graImport?.cant ?? null,
	};
}
