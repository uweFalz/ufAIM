// src/aim-core/alignment/aggregate/SparseAlignmentBuilder.js

/**
 * Build a derived SparseAlignment from native AlignmentData editor intent.
 *
 * Responsibility:
 * - Input:  AlignmentData.editModel
 * - Output: SparseAlignment
 *
 * Scope, first transfer slice:
 * - supports startPose
 * - supports straight, circular arc and transition elements
 * - does not support profile or cant
 * - does not perform CRS / metric realization
 *
 * This file has no application-layer dependencies.
 */

import { makeAlignment2DFromSparse } from "./AlignmentFactory.js";

export function buildSparseAlignment(
	alignmentData,
	{
		descriptorResolver,
		kappaBuilder,
		alignmentFactory = makeAlignment2DFromSparse,
	} = {}
) {
	if (!isAlignmentData(alignmentData)) {
		throw new Error("buildSparseAlignment: missing AlignmentData");
	}

	const editModel = alignmentData.editModel ?? {};
	const startPose = normalizePose2(editModel.startPose);

	if (!startPose) {
		throw new Error("buildSparseAlignment: missing valid editModel.startPose");
	}

	const editElements = asArray(editModel.elements);
	if (!editElements.length) {
		throw new Error("buildSparseAlignment: editModel.elements must be non-empty");
	}

	const sparse = editElements.map((element, index) =>
		buildSparseElementFromEditor(element, index)
	);

	assertSparseSequence(sparse);

	for (const el of sparse) {
		if (el.type !== "transition") continue;
		descriptorResolver.resolveTransitionDescriptor(el.transType);
	}

	const built = alignmentFactory({
		startPose,
		sparse,
		descriptorResolver,
		kappaBuilder,
	});

	if (!Array.isArray(built?.warnings)) {
		throw new Error("buildSparseAlignment: AXTRAN build warnings contract missing");
	}

	if (built.warnings.length > 0) {
		throw new Error(`buildSparseAlignment: AXTRAN build warnings ${JSON.stringify(built.warnings)}`);
	}

	const alignedSparse = annotateSparseWithPoseAndStation({
		alignment: built.alignment,
		sparse,
	});

	const totalLength = alignedSparse.reduce((acc, el) => acc + (Number(el.arcLength) || 0), 0);

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

		length: totalLength,

		sparse: alignedSparse,
		elements: alignedSparse,

		meta: {
			derivedFrom: alignmentData.id ?? null,
			elementCount: sparse.length,
			supportedElementTypes: ["straight", "arc", "transition"],
			hasUnsupportedElements: false,
			createdAt: new Date().toISOString(),
		},
	};
}

export function buildSparseFromEditModel(alignmentData, dependencies = {}) {
	return buildSparseAlignment(alignmentData, dependencies);
}

function buildSparseElementFromEditor(element, index) {
	const kind = normalizeElementKind(element);

	if (kind === "straight") {
		const length = readPositiveLength(
			element?.parameters?.length ?? element?.length ?? element?.arcLength ?? element?.L,
			"buildSparseAlignment: straight length"
		);

		return {
			id: element?.id ?? makeDerivedElementId("straight", index),
			type: "fixed",
			kind: "straight",
			arcLength: length,
			curvature: 0,
			meta: {
				...(isObject(element?.meta) ? element.meta : {}),
				sourceElementType: "straight",
				derivedBy: "buildSparseAlignment",
			},
		};
	}

	if (kind === "arc") {
		const length = readPositiveLength(
			element?.parameters?.length ?? element?.length ?? element?.arcLength,
			"buildSparseAlignment: arc length"
		);

		const curvature = resolveArcCurvature(element, "buildSparseAlignment: arc curvature");

		return {
			id: element?.id ?? makeDerivedElementId("arc", index),
			type: "fixed",
			kind: "arc",
			arcLength: length,
			curvature,
			meta: {
				...(isObject(element?.meta) ? element.meta : {}),
				sourceElementType: "arc",
				derivedBy: "buildSparseAlignment",
			},
		};
	}

	if (kind === "transition") {
		const length = readPositiveLength(
			element?.parameters?.length ?? element?.length ?? element?.arcLength,
			"buildSparseAlignment: transition length"
		);

		const transType = String(
			element?.parameters?.transitionType ?? element?.transitionType ?? element?.transType ?? ""
		).trim().toLowerCase();

		if (!transType) {
			throw new Error("buildSparseAlignment: transition type is required");
		}

		const opts = readTransitionOpts(element);

		return {
			id: element?.id ?? makeDerivedElementId("transition", index),
			type: "transition",
			kind: "transition",
			arcLength: length,
			transType,
			opts,
			meta: {
				...(isObject(element?.meta) ? element.meta : {}),
				sourceElementType: "transition",
				derivedBy: "buildSparseAlignment",
			},
		};
	}

	throw new Error(`buildSparseAlignment: unsupported editor element type \"${kind}\"`);
}

function annotateSparseWithPoseAndStation({ alignment, sparse }) {
	const out = [];
	let s = 0;

	for (const el of sparse) {
		const poseA = alignment.poseAt(s, { quality: "exact" });
		const L = Number(el.arcLength) || 0;

		out.push({
			...el,
			poseA: {
				p: { x: poseA.p.x, y: poseA.p.y },
				t: { x: poseA.t.x, y: poseA.t.y },
			},
			sStart: s,
			sEnd: s + L,
		});

		s += L;
	}

	return out;
}

function assertSparseSequence(sparse) {
	if (!Array.isArray(sparse) || sparse.length === 0) {
		throw new Error("buildSparseAlignment: sparse sequence must be non-empty");
	}

	if (sparse[0].type !== "fixed") {
		throw new Error("buildSparseAlignment: sequence must start with fixed element");
	}

	if (sparse[sparse.length - 1].type !== "fixed") {
		throw new Error("buildSparseAlignment: sequence must end with fixed element");
	}

	let expect = "fixed";
	for (const el of sparse) {
		if (el.type !== expect) {
			throw new Error(`buildSparseAlignment: elements must alternate fixed/transition, expected ${expect}`);
		}
		expect = expect === "fixed" ? "transition" : "fixed";
	}
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

	if (
		s === "arc" ||
		s === "curve" ||
		s === "circular_arc" ||
		s === "circulararc"
	) {
		return "arc";
	}

	if (
		s === "transition" ||
		s === "spiral"
	) {
		return "transition";
	}

	return s || "unknown";
}

function readPositiveLength(value, caller) {
	if (isObject(value) && Number.isFinite(Number(value.value))) {
		return Number(value.value);
	}

	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) {
		throw new Error(`${caller}: must be a positive number`);
	}

	return n;
}

function resolveArcCurvature(element, caller) {
	const curvatureRaw = element?.parameters?.curvature ?? element?.curvature ?? null;
	const radiusRaw = element?.parameters?.radius ?? element?.radius ?? null;

	if (radiusRaw != null) {
		const radius = Number(radiusRaw);
		if (!Number.isFinite(radius) || radius === 0) {
			throw new Error(`${caller}: radius must be finite and non-zero`);
		}
		return 1 / radius;
	}

	const curvature = Number(curvatureRaw);
	if (!Number.isFinite(curvature) || curvature === 0) {
		throw new Error(`${caller}: curvature must be finite and non-zero`);
	}

	return curvature;
}

function readTransitionOpts(element) {
	const rawW1 = element?.parameters?.w1 ?? element?.opts?.w1 ?? null;
	const rawW2 = element?.parameters?.w2 ?? element?.opts?.w2 ?? null;

	if (rawW1 == null || rawW2 == null) return undefined;

	const w1 = clamp01(Number(rawW1));
	const w2 = clamp01(Number(rawW2));

	if (!Number.isFinite(w1) || !Number.isFinite(w2)) {
		throw new Error("buildSparseAlignment: transition w1/w2 must be finite");
	}

	if (w2 < w1) {
		throw new Error("buildSparseAlignment: transition w2 must be >= w1");
	}

	return { w1, w2 };
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

function clamp01(n) {
	if (!Number.isFinite(n)) return 0;
	if (n < 0) return 0;
	if (n > 1) return 1;
	return n;
}

export default buildSparseAlignment;
