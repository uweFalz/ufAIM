// src/domain/alignment/editor/buildSparseAlignment.js

/**
 * Build a derived SparseAlignment from native AlignmentData editor intent.
 *
 * Responsibility:
 * - Input:  AlignmentData.editModel
 * - Output: SparseAlignment
 *
 * Scope, first transfer slice:
 * - supports startPose
 * - supports straight elements
 * - does not support arcs
 * - does not support transitions
 * - does not support profile or cant
 * - does not perform CRS / metric realization
 *
 * This file does not know SPOT, View, Projection, Cockpit or Import.
 */
export function buildSparseAlignment(alignmentData) {
	if (!isAlignmentData(alignmentData)) {
		throw new Error("buildSparseAlignment: missing AlignmentData");
	}

	const editModel = alignmentData.editModel ?? {};
	const startPose = normalizePose2(editModel.startPose);

	if (!startPose) {
		throw new Error("buildSparseAlignment: missing valid editModel.startPose");
	}

	const sparse = [];
	const elements = [];

	let cursor = {
		s: 0,
		p: { ...startPose.p },
		t: { ...startPose.t },
		theta: vectorToTheta(startPose.t),
	};

	for (const element of asArray(editModel.elements)) {
		const kind = normalizeElementKind(element);

		if (kind === "straight") {
			const built = buildStraightSparseElement(element, cursor, sparse.length);

			sparse.push(built.sparseElement);
			elements.push(built.sparseElement);

			cursor = built.nextCursor;
			continue;
		}

		sparse.push({
			id: element?.id ?? makeDerivedElementId("unsupported", sparse.length),
			type: "unsupported",
			sourceType: element?.type ?? element?.kind ?? null,
			sStart: cursor.s,
			sEnd: cursor.s,
			meta: {
				warning: "unsupported_editor_element",
			},
		});
	}

	return {
		type: "sparseAlignment",
		version: "sparse_v1",

		id: `${alignmentData.id ?? "alignment"}_sparse`,
		name: alignmentData.name ?? null,

		source: {
			kind: "editor",
			alignmentDataId: alignmentData.id ?? null,
			derived: true,
		},

		startPose: {
			p: { ...startPose.p },
			t: { ...startPose.t },
		},

		length: cursor.s,

		sparse,
		elements,

		meta: {
			derivedFrom: alignmentData.id ?? null,
			elementCount: sparse.length,
			supportedElementTypes: ["straight"],
			hasUnsupportedElements: sparse.some((el) => el.type === "unsupported"),
			createdAt: new Date().toISOString(),
		},
	};
}

export function buildSparseFromEditModel(alignmentData) {
	return buildSparseAlignment(alignmentData);
}

function buildStraightSparseElement(element, cursor, index) {
	const length = readPositiveNumber(
		element?.parameters?.length ??
		element?.length ??
		element?.arcLength ??
		element?.L
	);

	if (!Number.isFinite(length) || length <= 0) {
		throw new Error("buildSparseAlignment: straight length must be positive");
	}

	const poseA = {
		p: { ...cursor.p },
		t: { ...cursor.t },
	};

	const nextP = {
		x: cursor.p.x + cursor.t.x * length,
		y: cursor.p.y + cursor.t.y * length,
	};

	const nextCursor = {
		s: cursor.s + length,
		p: nextP,
		t: { ...cursor.t },
		theta: cursor.theta,
	};

	const sparseElement = {
		id: element?.id ?? makeDerivedElementId("straight", index),

		type: "fixed",
		kind: "straight",

		poseA,
		arcLength: length,
		curvature: 0,

		sStart: cursor.s,
		sEnd: nextCursor.s,

		meta: {
			...(isObject(element?.meta) ? element.meta : {}),
			sourceElementType: "straight",
			derivedBy: "buildSparseAlignment",
		},
	};

	return {
		sparseElement,
		nextCursor,
	};
}

function normalizePose2(value) {
	if (!isObject(value)) return null;

	const p = normalizePoint(value.p ?? value.point ?? value.pnt);
	const t = normalizeVector(value.t ?? value.tangent ?? value.dir);

	if (!p || !t) return null;

	return { p, t };
}

function normalizePoint(value) {
	if (!isObject(value)) return null;

	const x = Number(value.x);
	const y = Number(value.y);

	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

	return { x, y };
}

function normalizeVector(value) {
	if (!isObject(value)) return null;

	const x = Number(value.x);
	const y = Number(value.y);

	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

	const n = Math.hypot(x, y);
	if (!Number.isFinite(n) || n <= 0) return null;

	return {
		x: x / n,
		y: y / n,
	};
}

function vectorToTheta(t) {
	return Math.atan2(t.y, t.x);
}

function normalizeElementKind(element) {
	const raw =
		element?.kind ??
		element?.type ??
		element?.elementType ??
		"unknown";

	const s = String(raw).trim().toLowerCase();

	if (
		s === "straight" ||
		s === "line" ||
		s === "fixed" ||
		s === "fixedline" ||
		s === "fixed_line"
	) {
		return "straight";
	}

	return s || "unknown";
}

function readPositiveNumber(value) {
	if (isObject(value) && Number.isFinite(Number(value.value))) {
		return Number(value.value);
	}

	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function makeDerivedElementId(prefix, index) {
	return `${prefix}_${index + 1}`;
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function isAlignmentData(value) {
	return isObject(value) && value.type === "AlignmentData";
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

export default buildSparseAlignment;
