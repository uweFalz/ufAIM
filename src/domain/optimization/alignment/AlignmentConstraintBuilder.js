// src/domain/optimization/alignment/AlignmentConstraintBuilder.js
//
// AXTRAN2 Calculation Kernel — boundary, connection and sequence conditions.
//
// Declares what may not be given up:
//   - poseE as three equalities (poseA needs none; it is the integration origin)
//   - the element sequence, as one lower bound per element length
//   - any Zwangspunkt the engineer chose to enforce exactly
//   - the design limits: a smallest admissible radius and a smallest admissible
//     length per element kind
//
// This module declares conditions. It does not evaluate them, does not solve
// and does not decide which of them should be hard.
//
// Why the design limits belong here, as constraints and not as an objective.
// Minimising the accumulated length against nothing but the end pose and the
// element sequence has one answer: the shortest path between the two poses.
// Measured on a nine-element alignment it collapsed to element lengths
// [200, 20, 20, 20, 916, 20, 20, 20, 180] with a 108 m radius - the correct
// minimum of that objective, and not an alignment. Nothing in the end pose, the
// sequence or the measured points opposes shortening; only the design limits
// do. They are what makes the length a meaningful thing to minimise.
//
// Values, and where they come from. This module invents no limits. It takes the
// smallest radius and the smallest length per element kind as declared numbers,
// because those live in the design rules the engineer works under, not in a
// calculation kernel. What it will do, if asked, is the pure kinematics:
//
//   R >= V^2 / a          from the unbalanced lateral acceleration limit a
//   L >= V^3 / (R * j)    from the limit j on its rate of change
//
// Both are written cant-free, because cant is not modelled here; with cant the
// admissible radius is smaller and these are conservative. The second is also
// conservative in a second way: the honest form is L >= V^3 |dkappa| / j, and
// dkappa is a variable, so enforcing it exactly needs a general inequality that
// the solver does not carry. Bounding |dkappa| by 1/R gives the constant form
// above, which is stricter than required whenever the transition does not run
// the full curvature range.

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

export const ELEMENT_KINDS = Object.freeze(["straight", "arc", "transition"]);

/**
 * Read a design profile into the two things the solver can hold: a largest
 * admissible curvature and a smallest admissible length per element kind.
 * Declared numbers win over derived ones, and a derivation that contradicts a
 * declared number is refused rather than silently overruled - the engineer's
 * rule book knows things this kinematics does not.
 */
function readDesign(declaration) {
	if (!isObject(declaration)) error("INVALID_DESIGN", "design must be an object");
	const { minimumRadius, minimumLength, speed, lateralAcceleration, lateralJerk } = declaration;

	let radius = minimumRadius ?? null;
	if (radius !== null && (!isFiniteNumber(radius) || radius <= 0)) {
		error("INVALID_DESIGN", "design.minimumRadius must be a positive number of metres");
	}

	let derivedRadius = null;
	if (speed !== undefined || lateralAcceleration !== undefined) {
		if (!isFiniteNumber(speed) || speed <= 0) {
			error("INVALID_DESIGN", "design.speed must be a positive number, in m/s");
		}
		if (!isFiniteNumber(lateralAcceleration) || lateralAcceleration <= 0) {
			error("INVALID_DESIGN",
				"design.lateralAcceleration must be a positive number, in m/s^2, to derive a radius");
		}
		derivedRadius = (speed * speed) / lateralAcceleration;
		if (radius === null) radius = derivedRadius;
		else if (radius < derivedRadius) {
			error("DESIGN_CONFLICT",
				`declared minimumRadius ${radius} m is tighter than V^2/a = ${derivedRadius.toFixed(1)} m`);
		}
	}

	let transitionMinimum = null;
	if (lateralJerk !== undefined) {
		if (!isFiniteNumber(lateralJerk) || lateralJerk <= 0) {
			error("INVALID_DESIGN", "design.lateralJerk must be a positive number, in m/s^3");
		}
		if (radius === null) {
			error("INVALID_DESIGN",
				"a transition length from the jerk limit needs a radius to bound the curvature range");
		}
		transitionMinimum = (speed * speed * speed) / (radius * lateralJerk);
	}

	const byKind = isObject(minimumLength) ? { ...minimumLength } : null;
	const flat = isFiniteNumber(minimumLength) ? minimumLength : null;
	if (minimumLength !== undefined && !byKind && flat === null) {
		error("INVALID_DESIGN", "design.minimumLength must be a number or a map of element kind to number");
	}
	if (byKind) {
		for (const [kind, value] of Object.entries(byKind)) {
			if (!ELEMENT_KINDS.includes(kind)) {
				error("UNKNOWN_ELEMENT_KIND", `design.minimumLength names "${kind}", not an element kind`);
			}
			if (!isFiniteNumber(value) || value < 0) {
				error("INVALID_DESIGN", `design.minimumLength.${kind} must be a finite number >= 0`);
			}
		}
	}
	if (transitionMinimum !== null) {
		const declared = byKind?.transition ?? flat ?? 0;
		if (declared >= transitionMinimum) transitionMinimum = declared;
	}

	return {
		maximumCurvature: radius === null ? null : 1 / radius,
		minimumLengthByKind: byKind !== null || transitionMinimum !== null,
		minimumLengthFor(kind) {
			if (kind === "transition" && transitionMinimum !== null) return transitionMinimum;
			if (byKind && kind !== null) return byKind[kind] ?? 0;
			return flat ?? 0;
		},
		declared: Object.freeze({
			minimumRadius: radius,
			radiusFrom: minimumRadius !== undefined && minimumRadius !== null
				? "declared"
				: derivedRadius !== null ? "V^2/a" : null,
			minimumTransitionLength: transitionMinimum,
			transitionLengthFrom: transitionMinimum !== null && lateralJerk !== undefined
				? "V^3/(R j), conservative: |dkappa| bounded by 1/R"
				: transitionMinimum !== null ? "declared" : null,
			speed: speed ?? null,
			lateralAcceleration: lateralAcceleration ?? null,
			lateralJerk: lateralJerk ?? null,
		}),
	};
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
 * @param {Record<string,string>} [declaration.elementKinds]
 *        element id to "straight" | "arc" | "transition"; required only when a
 *        design profile declares limits per kind
 * @param {object} [declaration.design]                            tier 3
 * @param {number} [declaration.design.minimumRadius]              metres
 * @param {Record<string,number>|number} [declaration.design.minimumLength]
 *        smallest admissible length, per element kind or for all of them
 * @param {number} [declaration.design.speed]                      m/s, optional
 * @param {number} [declaration.design.lateralAcceleration]        m/s^2
 * @param {number} [declaration.design.lateralJerk]                m/s^3
 */
export function createAlignmentConstraintBuilder({
	endPose,
	elementSequence,
	minimumElementLength = 0,
	hardPoints = [],
	elementKinds = null,
	design = null,
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

	const profile = design ? readDesign(design) : null;
	const kindOf = (id) => {
		if (!elementKinds) return null;
		const kind = elementKinds[id] ?? null;
		if (kind !== null && !ELEMENT_KINDS.includes(kind)) {
			error("UNKNOWN_ELEMENT_KIND",
				`element "${id}" is declared as "${kind}", not one of ${ELEMENT_KINDS.join(", ")}`);
		}
		return kind;
	};
	if (profile?.minimumLengthByKind && !elementKinds) {
		error("MISSING_ELEMENT_KINDS",
			"a design profile with lengths per element kind needs elementKinds");
	}

	// The element sequence is inviolable: no element may vanish, so every
	// element length carries a lower bound. These are inequalities and only
	// consume a degree of freedom while they are active. Where a design limit is
	// stricter than the sequence bound it takes over, and the bound records
	// which of the two is speaking.
	const bounds = elementSequence.map((id) => {
		const sequence = minimumOf(id);
		const kind = kindOf(id);
		const designMinimum = profile ? profile.minimumLengthFor(kind) : 0;
		const minimum = Math.max(sequence, designMinimum);
		return Object.freeze({
			id: `sequence.${id}`,
			kind: "element-sequence",
			elementId: id,
			elementKind: kind,
			quantity: "length",
			minimum,
			sequenceMinimum: sequence,
			designMinimum,
			binding: designMinimum > sequence ? "design" : "element-sequence",
			unit: "m",
		});
	});

	// The smallest admissible radius is a two-sided bound on curvature: a curve
	// may run either way, and may straighten out entirely, but may not be
	// tighter than the design allows.
	const designBounds = [];
	if (profile?.maximumCurvature !== null && profile?.maximumCurvature !== undefined) {
		for (const id of elementSequence) {
			if (elementKinds && kindOf(id) !== "arc") continue;
			designBounds.push(Object.freeze({
				id: `design.${id}.curvature`,
				kind: "design-limit",
				elementId: id,
				quantity: "curvature",
				minimum: -profile.maximumCurvature,
				maximum: profile.maximumCurvature,
				reason: "minimum-radius",
				unit: "1/m",
			}));
		}
	}

	return Object.freeze({
		version: ALIGNMENT_CONSTRAINT_BUILDER_VERSION,
		endPose: target,
		equalities: Object.freeze(equalities.map(Object.freeze)),
		bounds: Object.freeze(bounds),
		designBounds: Object.freeze(designBounds),
		design: profile?.declared ?? null,
		equalityCount: equalities.length,
		hardPointNames: Object.freeze([...seenHard]),
	});
}
