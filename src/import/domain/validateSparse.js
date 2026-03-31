// src/import/domain/validateSparse.js (v2 – geschärft)
//
// Validierung für sparseAlignment (sparse_v1)
//
// Ziel:
// - klarer struktureller Vertrag
// - minimale, aber sinnvolle semantische Checks
// - KEINE Geometrie-Reparatur
//
// @baustelle [CONTINUITY]
// Nur Soft-Checks, keine Korrekturen
//
// @baustelle [7L]
// Noch keine Prüfung von profile/cant/stationing
//
// @baustelle [POSE-CONTRACT]
// Pose-Struktur wird NICHT lokal definiert.
// Maßgeblich ist ausschließlich src/lib/geom/frame/pose2.js.
// Damit bleibt später der Umbau pose2 -> pose3 möglichst lokal.

import { isPose2, posePoint } from "@src/lib/geom/frame/pose2.js";

export function validateSparse(doc) {
	const errors = [];
	const warnings = [];

	validateRoot(doc, errors, warnings);

	return {
		ok: errors.length === 0,
		errors,
		warnings,
	};
}

// -----------------------------------------------------------------------------
// root
// -----------------------------------------------------------------------------

function validateRoot(doc, errors, warnings) {
	if (!isObject(doc)) {
		errors.push("root must be object");
		return;
	}

	if (doc.type !== "sparseAlignment") {
		errors.push("type must be 'sparseAlignment'");
	}

	if (!isPose2(doc.startPose)) {
		errors.push("startPose missing or invalid");
	}

	if (!Array.isArray(doc.sparse) || doc.sparse.length === 0) {
		errors.push("sparse must be non-empty array");
		return;
	}

	validateElements(doc.sparse, errors, warnings);
}

// -----------------------------------------------------------------------------
// elements
// -----------------------------------------------------------------------------

function validateElements(elements, errors, warnings) {
	let expectFixed = true;

	for (let i = 0; i < elements.length; i++) {
		const el = elements[i];

		if (!isObject(el)) {
			errors.push(`el[${i}] must be object`);
			continue;
		}

		if (el.type !== "fixed" && el.type !== "transition") {
			errors.push(`el[${i}] invalid type`);
			continue;
		}

		if (expectFixed && el.type !== "fixed") {
			errors.push(`el[${i}] expected fixed`);
		}

		if (!expectFixed && el.type !== "transition") {
			errors.push(`el[${i}] expected transition`);
		}

		expectFixed = el.type !== "fixed";

		if (!isPose2(el.poseA)) {
			errors.push(`el[${i}] poseA invalid`);
		}

		if (!isFiniteNonNegative(el.arcLength)) {
			errors.push(`el[${i}] arcLength invalid`);
		}

		if (el.arcLength === 0) {
			warnings.push(`el[${i}] zero-length`);
		}

		if (el.type === "fixed") {
			if (!Number.isFinite(el.curvature)) {
				errors.push(`el[${i}] curvature invalid`);
			}
		}

		if (el.type === "transition") {
			if (!isNonEmptyString(el.transType)) {
				errors.push(`el[${i}] transType missing`);
			}

			if (el.deltaDir != null) {
				validateDeltaDir(el.deltaDir, i, errors, warnings);
			}
		}

		if (i > 0) {
			checkPoseContinuity(elements[i - 1], el, i, warnings);
		}
	}

	const last = elements[elements.length - 1];
	if (last.type !== "fixed") {
		errors.push("last element must be fixed");
	}
}

// -----------------------------------------------------------------------------
// deltaDir
// -----------------------------------------------------------------------------

function validateDeltaDir(vec, index, errors, warnings) {
	if (!isObject(vec)) {
		errors.push(`el[${index}] deltaDir must be object`);
		return;
	}

	const x = Number(vec.x);
	const y = Number(vec.y);

	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		errors.push(`el[${index}] deltaDir invalid`);
		return;
	}

	const len = Math.sqrt(x * x + y * y);

	if (len === 0) {
		errors.push(`el[${index}] deltaDir zero vector`);
		return;
	}

	if (Math.abs(len - 1) > 1e-3) {
		warnings.push(`el[${index}] deltaDir not normalized`);
	}
}

// -----------------------------------------------------------------------------
// soft continuity
// -----------------------------------------------------------------------------

function checkPoseContinuity(prev, curr, index, warnings) {
	if (!isPose2(prev?.poseA) || !isPose2(curr?.poseA)) return;

	const pPrev = posePoint(prev.poseA);
	const pCurr = posePoint(curr.poseA);

	if (!pPrev || !pCurr) return;

	const dx = pCurr.x - pPrev.x;
	const dy = pCurr.y - pPrev.y;

	const dist = Math.sqrt(dx * dx + dy * dy);

	// sehr grober Check – keine harte Geometrieprüfung
	if (dist > 1e-3) {
		warnings.push(`el[${index}] pose discontinuity (${dist.toFixed(4)})`);
	}
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

function isFiniteNonNegative(v) {
	return Number.isFinite(v) && v >= 0;
}

function isNonEmptyString(s) {
	return typeof s === "string" && s.trim().length > 0;
}
