// src/import/build/sparseWriter.js

//
// sparseWriter.js
//
// Minimaler Writer für sparse_v1
//
// Ziel:
// - zentrale Erstellung von sparseAlignment-Objekten
// - keine verstreuten Objektliterale mehr im Builder
// - kompatibel zu validateSparseAlignment()
// - bewusst klein halten (kein Overengineering)
//
// @baustelle [7L]
// Erweiterungen (profile, cant, stationing etc.) bewusst NICHT hier.
// Writer bleibt rein geometrisch.
//
// @baustelle [SPARSE_V2]
// zukünftiges Modell (node-edge) wird hier NICHT berücksichtigt
//

// -----------------------------------------------------------------------------
// root
// -----------------------------------------------------------------------------

export function createSparseAlignment({
	name = null,
	startPose,
	elements = [],
} = {}) {

	if (!startPose) {
		throw new Error("sparseWriter: startPose required");
	}

	if (!Array.isArray(elements) || elements.length === 0) {
		throw new Error("sparseWriter: elements must be non-empty array");
	}

	return {
		type: "sparseAlignment",
		name,
		startPose,
		sparse: elements,
	};
}

// -----------------------------------------------------------------------------
// elements
// -----------------------------------------------------------------------------

export function fixed({
	poseA,
	arcLength,
	curvature,
	meta = {},
} = {}) {

	return {
		type: "fixed",
		poseA,
		arcLength: toLen(arcLength),
		curvature: toNum(curvature),
		meta,
	};
}

export function transition({
	poseA,
	arcLength,
	transType,
	deltaDir = null,
	meta = {},
} = {}) {

	const out = {
		type: "transition",
		poseA,
		arcLength: toLen(arcLength),
		transType: toStr(transType),
		meta,
	};

	if (deltaDir != null) {
		out.deltaDir = normalizeDir(deltaDir);
	}

	return out;
}

// -----------------------------------------------------------------------------
// helpers for common cases
// -----------------------------------------------------------------------------

export function zeroFixed({
	poseA,
	curvature = 0,
	meta = {},
} = {}) {
	return fixed({
		poseA,
		arcLength: 0,
		curvature,
		meta: { ...meta, zeroLength: true },
	});
}

export function immediate({
	poseA,
	meta = {},
} = {}) {
	return transition({
		poseA,
		arcLength: 0,
		transType: "immediate",
		meta,
	});
}

export function kink({
	poseA,
	deltaDir,
	meta = {},
} = {}) {

	if (!deltaDir) {
		throw new Error("sparseWriter.kink: deltaDir required");
	}

	return transition({
		poseA,
		arcLength: 0,
		transType: "kink",
		deltaDir,
		meta,
	});
}

// -----------------------------------------------------------------------------
// alternation helper
// -----------------------------------------------------------------------------

export function enforceAlternation(elements = []) {

	const out = [];
	let expectFixed = true;

	for (const el of elements) {

		if (expectFixed && el.type !== "fixed") {
			out.push(zeroFixed({
				poseA: el.poseA,
				meta: { insertedBy: "enforceAlternation" },
			}));
		}

		if (!expectFixed && el.type !== "transition") {
			out.push(immediate({
				poseA: el.poseA,
				meta: { insertedBy: "enforceAlternation" },
			}));
		}

		out.push(el);
		expectFixed = el.type !== "fixed";
	}

	if (out.length > 0) {
		const last = out[out.length - 1];
		if (last.type !== "fixed") {
			out.push(zeroFixed({
				poseA: last.poseA,
				meta: { insertedBy: "enforceAlternation" },
			}));
		}
	}

	return out;
}

// -----------------------------------------------------------------------------
// low-level normalization
// -----------------------------------------------------------------------------

function toLen(v) {
	const n = toNum(v);
	if (!Number.isFinite(n) || n < 0) {
		throw new Error("sparseWriter: arcLength must be >= 0");
	}
	return n;
}

function toNum(v) {
	if (typeof v === "number" && Number.isFinite(v)) return v;

	if (typeof v === "string") {
		const n = Number(v.replace(",", "."));
		if (Number.isFinite(n)) return n;
	}

	return 0;
}

function toStr(v) {
	if (v == null) {
		throw new Error("sparseWriter: transType required");
	}
	const s = String(v).trim();
	if (!s) {
		throw new Error("sparseWriter: transType empty");
	}
	return s;
}

function normalizeDir(vec) {
	if (!vec || typeof vec !== "object") {
		throw new Error("sparseWriter: deltaDir must be object");
	}

	const x = Number(vec.x);
	const y = Number(vec.y);

	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		throw new Error("sparseWriter: invalid deltaDir");
	}

	return { x, y };
}
