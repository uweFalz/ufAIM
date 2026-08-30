// src/domain/optimization/alignment/AlignmentConstraintBuilder.js
//
// AXTRAN2 Calculation Kernel — boundary, connection and sequence conditions.
//
// Declares what may not be given up:
//   - poseE as three equalities (poseA needs none; it is the integration origin)
//   - the element sequence, as one lower bound per element length
//   - any Zwangspunkt the engineer chose to enforce exactly
//
// This module declares conditions. It does not evaluate them, does not solve
// and does not decide which of them should be hard.

export const ALIGNMENT_CONSTRAINT_BUILDER_VERSION =
	"axtran2/alignment-constraint-builder/0.1";

export class AlignmentConstraintBuilderError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "AlignmentConstraintBuilderError";
		this.code = code;
	}
}

function error(code, message) {
	throw new AlignmentConstraintBuilderError(code, message);
}

function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}

function requirePose(pose, label) {
	if (!isObject(pose)) error("INVALID_POSE", `${label} must be an object`);
	const { x, y, theta } = pose;
	if (![x, y, theta].every(isFiniteNumber)) {
		error("INVALID_POSE", `${label} must carry finite x, y and theta`);
	}
	return Object.freeze({ x, y, theta });
}

/**
 * @param {object} declaration
 * @param {{x:number,y:number,theta:number}} declaration.endPose  target poseE
 * @param {string[]} declaration.elementSequence                  from the codec
 * @param {number|Record<string,number>} [declaration.minimumElementLength]
 * @param {Array<{name:string}>} [declaration.hardPoints]         enforced Zwangspunkte
 */
export function createAlignmentConstraintBuilder({
	endPose,
	elementSequence,
	minimumElementLength = 0,
	hardPoints = [],
} = {}) {
	const target = requirePose(endPose, "endPose");

	if (!Array.isArray(elementSequence) || elementSequence.length === 0) {
		error("EMPTY_SEQUENCE", "elementSequence must be a non-empty array");
	}

	const minimumOf = (id) => {
		const value = isObject(minimumElementLength)
			? minimumElementLength[id] ?? 0
			: minimumElementLength;
		if (!isFiniteNumber(value) || value < 0) {
			error("INVALID_MINIMUM", `minimum length for "${id}" must be a finite number >= 0`);
		}
		return value;
	};

	const equalities = [
		Object.freeze({ id: "poseE.x", kind: "end-pose", component: "x", target: target.x, unit: "m" }),
		Object.freeze({ id: "poseE.y", kind: "end-pose", component: "y", target: target.y, unit: "m" }),
		Object.freeze({ id: "poseE.theta", kind: "end-pose", component: "theta", target: target.theta, unit: "rad" }),
	];

	const seenHard = new Set();
	for (const point of hardPoints) {
		if (!isObject(point) || typeof point.name !== "string" || !point.name.trim()) {
			error("INVALID_HARD_POINT", "each hard point must carry a non-empty name");
		}
		const name = point.name.trim();
		if (seenHard.has(name)) {
			error("DUPLICATE_HARD_POINT", `hard point "${name}" is declared more than once`);
		}
		seenHard.add(name);
		equalities.push(Object.freeze({
			id: `zwang.${name}`, kind: "zwangspunkt", pointName: name, unit: "m",
		}));
	}

	// The element sequence is inviolable: no element may vanish, so every
	// element length carries a lower bound. These are inequalities and only
	// consume a degree of freedom while they are active.
	const bounds = elementSequence.map((id) => Object.freeze({
		id: `sequence.${id}`,
		kind: "element-sequence",
		elementId: id,
		quantity: "length",
		minimum: minimumOf(id),
		unit: "m",
	}));

	return Object.freeze({
		version: ALIGNMENT_CONSTRAINT_BUILDER_VERSION,
		endPose: target,
		equalities: Object.freeze(equalities.map(Object.freeze)),
		bounds: Object.freeze(bounds),
		equalityCount: equalities.length,
		hardPointNames: Object.freeze([...seenHard]),
	});
}
