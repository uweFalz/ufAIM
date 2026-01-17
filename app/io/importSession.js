// app/io/importSession.js
//
// ImportSession: caches partial imports (TRA/GRA) by baseId and emits
// a "best available" SevenLinesDraft on every ingest.
// - TRA provides: geometry.pts (polyline2d), cant1d
// - GRA provides: profile1d, grade
//
// The draft is kept intentionally lightweight and "view-friendly".
// Real RouteProject/Registry wiring can come later.

function nowIso() {
	return new Date().toISOString();
}

export function makeImportSession() {
	const cacheByBase = new Map(); // base -> { base, ts, tra?, gra? }

	function ingest(importObject) {
		const base = importObject?.name ?? "unknown";
		const prev = cacheByBase.get(base);

		const entry = prev ?? {
			base,
			ts: Date.now(),
			tra: null,
			gra: null,
			createdAt: nowIso(),
		};

		// Update cache
		if (importObject?.kind === "TRA") entry.tra = importObject;
		if (importObject?.kind === "GRA") entry.gra = importObject;
		entry.ts = Date.now();

		cacheByBase.set(base, entry);

		// Slot concept: for now always right
		const slot = "right";

		// Build "best available" draft every time
		const draft = buildSevenLinesDraft(base, entry.tra, entry.gra);

		return {
			imp: importObject,
			base,
			slot,
			draft,
			entry, // optional for debugging
		};
	}

	function getState() {
		return Array.from(cacheByBase.values()).sort((a, b) => b.ts - a.ts);
	}

	return { ingest, getState };
}

function normalizePolyline2d(traImport) {
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

	return polyline2d.length ? polyline2d : null;
}

function computeBBox(polyline2d) {
	if (!Array.isArray(polyline2d) || polyline2d.length < 2) {
		return { bbox: null, bboxCenter: null };
	}

	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;

	for (const p of polyline2d) {
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
	}

	const bbox = { minX, minY, maxX, maxY };
	const bboxCenter = { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 };

	return { bbox, bboxCenter };
}

function normalizeProfile1d(graImport) {
	// prefer new importer payloads
	const profile =
		graImport?.profile1d ??
		graImport?.profilePts ??
		graImport?.gradient1d ??
		graImport?.pts ??
		null;

	if (!Array.isArray(profile) || profile.length < 2) return null;

	// normalize minimal shape: {s,z}
	const out = [];
	for (const p of profile) {
		const s = p?.s ?? p?.station ?? p?.[0];
		const z = p?.z ?? p?.height ?? p?.[1];
		if (Number.isFinite(s) && Number.isFinite(z)) out.push({ ...p, s, z });
	}

	out.sort((a, b) => a.s - b.s);
	return out.length >= 2 ? out : null;
}

function normalizeGrade1d(graImport) {
	const grade = graImport?.grade ?? graImport?.grade1d ?? null;
	if (!Array.isArray(grade) || grade.length < 2) return null;

	const out = [];
	for (const p of grade) {
		const s = p?.s ?? p?.station ?? p?.[0];
		const i = p?.i ?? p?.slope ?? p?.[1];
		if (Number.isFinite(s) && Number.isFinite(i)) out.push({ ...p, s, i });
	}
	out.sort((a, b) => a.s - b.s);
	return out.length >= 2 ? out : null;
}

function normalizeCant1d(traImport, graImport) {
	// Cant comes from TRA right now (cant1d).
	// Keep hook for future: if later GRA provides ramps etc.
	const cant =
		traImport?.cant1d ??
		traImport?.cant ??
		graImport?.cant1d ??
		graImport?.cant ??
		null;

	if (!Array.isArray(cant) || cant.length < 2) return null;

	const out = [];
	for (const p of cant) {
		const s = p?.s ?? p?.station ?? p?.[0];
		const u = p?.u ?? p?.cant ?? p?.[1];
		if (Number.isFinite(s) && Number.isFinite(u)) out.push({ ...p, s, u });
	}
	out.sort((a, b) => a.s - b.s);
	return out.length >= 2 ? out : null;
}

function buildSevenLinesDraft(base, traImport, graImport) {
	const polyline2d = normalizePolyline2d(traImport);
	const { bbox, bboxCenter } = computeBBox(polyline2d);

	const profile1d = normalizeProfile1d(graImport);
	const grade1d = normalizeGrade1d(graImport);
	const cant1d = normalizeCant1d(traImport, graImport);

	return {
		type: "SevenLinesDraft",
		id: base,

		// raw origin info
		source: {
			tra: traImport?.name ?? null,
			gra: graImport?.name ?? null,
		},

		// km-line concept (later); for now kmLine references right alignment
		kmLine: { alignmentRef: "right" },

		// Right track (minimal)
		right: {
			polyline2d: polyline2d ?? null,
			bbox,
			bboxCenter,

			// bands on alignment (s->z, s->u, ...)
			profile1d: profile1d ?? null,
			grade1d: grade1d ?? null,
			cant1d: cant1d ?? null,
		},

		// Left optional later
		left: null,

		// convenient top-level mirrors (optional; keep them for backward compat)
		profile1d: profile1d ?? null,
		cant1d: cant1d ?? null,
		grade1d: grade1d ?? null,

		meta: {
			hasTRA: Boolean(traImport),
			hasGRA: Boolean(graImport),
			updatedAt: nowIso(),
		},
	};
}
