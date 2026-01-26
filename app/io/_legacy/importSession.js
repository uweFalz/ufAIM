// app/io/_legacy/importSession.js
//
// ImportSession = Matching/Grouping (nicht: Store schreiben)
//
// Ergebnis: { baseId, slot, source, artifacts[] }

export function makeImportSession() {
	const cacheByBase = new Map(); // base -> { baseId, ts, tra?, gra? }

	function ingest(importObject, opts = {}) {
		const baseId = importObject?.name ?? "unknown";
		const entry = cacheByBase.get(baseId) ?? { baseId, ts: Date.now(), tra: null, gra: null };

		if (importObject?.kind === "TRA") entry.tra = importObject;
		if (importObject?.kind === "GRA") entry.gra = importObject;

		entry.ts = Date.now();
		cacheByBase.set(baseId, entry);

		// MS4: slot comes from caller (store.activeSlot), fallback right
		const slot = (opts.slot === "left" || opts.slot === "km" || opts.slot === "right") ? opts.slot : "right";

		const source = {
			tra: entry.tra?.name ?? null,
			gra: entry.gra?.name ?? null,
		};

		const artifacts = buildArtifactsFromEntry(entry, { slot, source });

		return { baseId, slot, source, artifacts, imp: importObject };
	}

	function getState() {
		return Array.from(cacheByBase.values()).sort((a, b) => b.ts - a.ts);
	}

	return { ingest, getState };
}

function buildArtifactsFromEntry(entry, { slot, source }) {
	const arts = [];

	// Alignment from TRA
	const polyline2d =
	entry?.tra?.geometry?.pts ??
	entry?.tra?.geometry ??
	entry?.tra?.pts ??
	null;

	if (Array.isArray(polyline2d) && polyline2d.length >= 2) {
		const { bbox, bboxCenter } = computeBbox(polyline2d);
		arts.push({
			domain: "alignment2d",
			kind: "TRA",
			source,
			meta: entry.tra?.meta ?? null,
			payload: { polyline2d, bbox, bboxCenter },
		});
	}

	// Profile from GRA
	const profile1d =
	entry?.gra?.profile1d ??
	entry?.gra?.profile ??
	null;

	if (Array.isArray(profile1d) && profile1d.length >= 2) {
		arts.push({
			domain: "profile1d",
			kind: "GRA",
			source,
			meta: entry.gra?.meta ?? null,
			payload: { profile1d },
		});
	}

	// Cant from TRA
	const cant1d =
	entry?.tra?.cant ??
	entry?.tra?.cant1d ??
	null;

	if (Array.isArray(cant1d) && cant1d.length >= 2) {
		arts.push({
			domain: "cant1d",
			kind: "TRA",
			source,
			meta: entry.tra?.meta ?? null,
			payload: { cant1d },
		});
	}

	if (arts.length === 0) {
		arts.push({
			domain: "unknown",
			kind: entry.tra ? "TRA" : (entry.gra ? "GRA" : "unknown"),
			source,
			meta: { note: "meta only (no renderable payload yet)" },
			payload: null,
		});
	}

	return arts;
}

function computeBbox(polyline2d) {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const p of polyline2d) {
		const x = p?.x ?? p?.[0];
		const y = p?.y ?? p?.[1];
		if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	const bbox = Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
	const bboxCenter = bbox ? { x: (bbox.minX + bbox.maxX) * 0.5, y: (bbox.minY + bbox.maxY) * 0.5 } : null;
	return { bbox, bboxCenter };
}
