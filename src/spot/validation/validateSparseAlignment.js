// src/spot/validation/validateSparseAlignment.js
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

import { isPose2, posePoint } from "../..//lib/geom/frame/pose2.js";
// import { isPose2, posePoint } from "@src/lib/geom/frame/pose2.js";

const CODES = {
	root_type: "root_type",
	root_type_value: "root_type_value",
	missing_start_pose: "missing_start_pose",
	missing_elements: "missing_elements",

	element_type: "element_type",
	element_type_value: "element_type_value",
	invalid_start: "invalid_start",
	invalid_sequence: "invalid_sequence",
	missing_poseA: "missing_poseA",
	invalid_arc_length: "invalid_arc_length",
	zero_length: "zero_length",

	invalid_curvature: "invalid_curvature",
	missing_trans_type: "missing_trans_type",

	invalid_delta_dir_type: "invalid_delta_dir_type",
	invalid_delta_dir_value: "invalid_delta_dir_value",
	zero_delta_dir: "zero_delta_dir",
	non_normalized_delta_dir: "non_normalized_delta_dir",

	pose_discontinuity: "pose_discontinuity",
	last_element_not_fixed: "last_element_not_fixed",
};

export function validateSparseAlignment(doc) {
	const res = makeResult();
	validateRoot(doc, "", res);
	return res;
}

// -----------------------------------------------------------------------------
// root
// -----------------------------------------------------------------------------

function validateRoot(doc, path, res) {
	if (!isObject(doc)) {
		pushError(res, CODES.root_type, "root must be object", path);
		return;
	}

	if (doc.type !== "sparseAlignment") {
		pushError(res, CODES.root_type_value, "type must be 'sparseAlignment'", joinPath(path, "type"));
	}

	if (!isPose2(doc.startPose)) {
		pushError(res, CODES.missing_start_pose, "startPose missing or invalid", joinPath(path, "startPose"));
	}

	if (!Array.isArray(doc.sparse) || doc.sparse.length === 0) {
		pushError(res, CODES.missing_elements, "sparse must be non-empty array", joinPath(path, "sparse"));
		return;
	}

	validateElements(doc.sparse, joinPath(path, "sparse"), res);
}

// -----------------------------------------------------------------------------
// elements
// -----------------------------------------------------------------------------

function validateElements(elements, path, res) {
	let expectFixed = true;

	for (let i = 0; i < elements.length; i++) {
		const el = elements[i];
		const elPath = `${path}[${i}]`;

		if (!isObject(el)) {
			pushError(res, CODES.element_type, "element must be object", elPath);
			continue;
		}

		if (el.type !== "fixed" && el.type !== "transition") {
			pushError(res, CODES.element_type_value, 'element.type must be "fixed" or "transition"', joinPath(elPath, "type"));
			continue;
		}

		if (expectFixed && el.type !== "fixed") {
			pushError(res, CODES.invalid_start, "sequence must start with fixed", elPath);
		}

		if (!expectFixed && el.type !== "transition") {
			pushError(res, CODES.invalid_sequence, "elements must strictly alternate fixed/transition", elPath);
		}

		expectFixed = el.type !== "fixed";

		if (!isPose2(el.poseA)) {
			pushError(res, CODES.missing_poseA, "poseA invalid", joinPath(elPath, "poseA"));
		}

		if (!isFiniteNonNegative(el.arcLength)) {
			pushError(res, CODES.invalid_arc_length, "arcLength invalid", joinPath(elPath, "arcLength"));
		} else if (el.arcLength === 0) {
			pushWarning(res, CODES.zero_length, "zero-length element", joinPath(elPath, "arcLength"));
		}

		if (el.type === "fixed") {
			if (!Number.isFinite(el.curvature)) {
				pushError(res, CODES.invalid_curvature, "curvature invalid", joinPath(elPath, "curvature"));
			}
		}

		if (el.type === "transition") {
			if (!isNonEmptyString(el.transType)) {
				pushError(res, CODES.missing_trans_type, "transType missing", joinPath(elPath, "transType"));
			}

			if (el.deltaDir != null) {
				validateDeltaDir(el.deltaDir, joinPath(elPath, "deltaDir"), res);
			}
		}

		if (i > 0) {
			checkPoseContinuity(elements[i - 1], el, elPath, res);
		}
	}

	const last = elements[elements.length - 1];
	if (last?.type !== "fixed") {
		pushError(res, CODES.last_element_not_fixed, "last element must be fixed", path);
	}
}

// -----------------------------------------------------------------------------
// deltaDir
// -----------------------------------------------------------------------------

function validateDeltaDir(vec, path, res) {
	if (!isObject(vec)) {
		pushError(res, CODES.invalid_delta_dir_type, "deltaDir must be object", path);
		return;
	}

	const x = Number(vec.x);
	const y = Number(vec.y);

	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		pushError(res, CODES.invalid_delta_dir_value, "deltaDir invalid", path);
		return;
	}

	const len = Math.sqrt(x * x + y * y);

	if (len === 0) {
		pushError(res, CODES.zero_delta_dir, "deltaDir zero vector", path);
		return;
	}

	if (Math.abs(len - 1) > 1e-3) {
		pushWarning(res, CODES.non_normalized_delta_dir, "deltaDir not normalized", path);
	}
}

// -----------------------------------------------------------------------------
// soft continuity
// -----------------------------------------------------------------------------

function checkPoseContinuity(prev, curr, currPath, res) {
	if (!isPose2(prev?.poseA) || !isPose2(curr?.poseA)) return;

	const pPrev = posePoint(prev.poseA);
	const pCurr = posePoint(curr.poseA);

	if (!pPrev || !pCurr) return;

	const dx = pCurr.x - pPrev.x;
	const dy = pCurr.y - pPrev.y;

	const dist = Math.sqrt(dx * dx + dy * dy);

	// sehr grober Check – keine harte Geometrieprüfung
	if (dist > 1e-3) {
		pushWarning(
			res,
			CODES.pose_discontinuity,
			`pose discontinuity (${dist.toFixed(4)})`,
			joinPath(currPath, "poseA")
		);
	}
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function makeResult() {
	return {
		ok: true,
		errors: [],
		warnings: [],
	};
}

function pushError(res, code, message, path = "") {
	res.ok = false;
	res.errors.push({ code, message, path });
}

function pushWarning(res, code, message, path = "") {
	res.warnings.push({ code, message, path });
}

function joinPath(base, key) {
	return base ? `${base}.${key}` : key;
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

function isFiniteNonNegative(v) {
	return Number.isFinite(v) && v >= 0;
}

function isNonEmptyString(s) {
	return typeof s === "string" && s.trim().length > 0;
}
