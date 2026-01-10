// app/io/importSession.js
// Minimal pairing + draft builder (NO side effects)

function baseNameOf(name) {
	const m = String(name).match(/^(.+?)\.(TRA|GRA)$/i);
	return m ? m[1] : null;
}

function buildSevenLinesDraft(base, traImp, graImp) {
	const rawPts = traImp?.geometry?.pts ?? [];
	const polyline2d = rawPts
	.map(p => ({ x: p.x, y: p.y }))
	.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

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
		source: { tra: traImp?.name, gra: graImp?.name },
		kmLine: { alignmentRef: "right" },
		right: { polyline2d, bbox, bboxCenter },
		left: null,
		grade: graImp?.profile ?? null,
		cant: null
	};
}

export function makeImportSession() {
	const cache = new Map(); // base -> { tra, gra, fitted }

	return {
		ingest(imp) {
			const base = baseNameOf(imp?.name);
			if (!base) return { base: null, imp, draft: null, slot: null };

			const slot = cache.get(base) ?? { fitted: false };
			if (imp.kind === "TRA") slot.tra = imp;
			if (imp.kind === "GRA") slot.gra = imp;
			cache.set(base, slot);

			if (slot.tra && slot.gra) {
				const draft = buildSevenLinesDraft(base, slot.tra, slot.gra);
				return { base, imp, draft, slot };
			}
			return { base, imp, draft: null, slot };
		},

		// optional helpers (nice for debugging)
		get(base) { return cache.get(base) ?? null; },
		clear() { cache.clear(); }
	};
}
