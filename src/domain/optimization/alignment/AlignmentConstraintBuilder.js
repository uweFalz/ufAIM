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

/**
 * The word a caller has to say to build constraints from a design profile whose
 * numbers nobody has read. It is spelled out rather than a boolean so that it
 * cannot be passed by accident and reads, at the call site, as what it is.
 */
export const EVIDENCE_ONLY = "evidence-only";

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
 *        either a profile from createAlignmentDesignProfile, which carries its
 *        own provenance and per-element exceptions, or the plain form below,
 *        which carries none and is therefore not reviewable
 * @param {"evidence-only"} [declaration.admitUnconfirmedDesign]
 *        required to build constraints from a profile that is not confirmed
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
	admitUnconfirmedDesign = null,
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

	// A design profile built by createAlignmentDesignProfile arrives ready, with
	// its provenance and its per-element exceptions. The plain object form stays
	// for callers that only want a radius and a length, and it carries no
	// provenance - which is why it may not be used for anything reviewable.
	const built = design?.version?.startsWith("axtran2/alignment-design-profile/") ? design : null;

	// Admission. A profile marked "candidate" is one whose numbers nobody has
	// read yet, and those numbers do not stay advisory once they are here: they
	// become the curvature bound and the transition floor, and the solver runs
	// its alignment onto them. Consuming a candidate exactly like a confirmed
	// profile would let an unread limit shape an answer that then looks like any
	// other. So it takes an explicit word, and the constraints carry which word
	// was given, all the way out to the proposal.
	const admission = built === null || built.status === "confirmed"
		? "confirmed"
		: admitUnconfirmedDesign;
	if (admission !== "confirmed" && admission !== EVIDENCE_ONLY) {
		error("UNCONFIRMED_DESIGN_PROFILE",
			`design profile "${built.id}" is a ${built.status} - unread: `
				+ `${built.unverified.join(", ")}. To use it anyway, declare `
				+ `admitUnconfirmedDesign: "${EVIDENCE_ONLY}"; the result is then not admissible `
				+ "as an engineering answer.");
	}
	const profile = built ? null : design ? readDesign(design) : null;
	const kindOf = (id) => {
		if (!elementKinds) return null;
		const kind = elementKinds[id] ?? null;
		if (kind !== null && !ELEMENT_KINDS.includes(kind)) {
			error("UNKNOWN_ELEMENT_KIND",
				`element "${id}" is declared as "${kind}", not one of ${ELEMENT_KINDS.join(", ")}`);
		}
		return kind;
	};
	if ((profile?.minimumLengthByKind || built) && !elementKinds) {
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
		const designMinimum = built
			? built.minimumLengthFor(kind, id)
			: profile ? profile.minimumLengthFor(kind) : 0;
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
	const curvatureCap = built
		? (id) => built.maximumCurvatureFor(id)
		: profile?.maximumCurvature !== null && profile?.maximumCurvature !== undefined
			? () => profile.maximumCurvature
			: null;
	if (curvatureCap) {
		for (const id of elementSequence) {
			if (elementKinds && kindOf(id) !== "arc") continue;
			const cap = curvatureCap(id);
			designBounds.push(Object.freeze({
				id: `design.${id}.curvature`,
				kind: "design-limit",
				elementId: id,
				quantity: "curvature",
				minimum: -cap,
				maximum: cap,
				reason: built?.exceptionFor(id)?.minimumRadius ? "exception" : "minimum-radius",
				source: built?.exceptionFor(id)?.minimumRadius
					? built.exceptionFor(id).source
					: built?.source ?? null,
				unit: "1/m",
			}));
		}
	}

	return Object.freeze({
		version: ALIGNMENT_CONSTRAINT_BUILDER_VERSION,
		endPose: target,
		// "confirmed" or "evidence-only": whether an answer built on these
		// constraints may be treated as an engineering result
		admission,
		admissible: admission === "confirmed",
		equalities: Object.freeze(equalities.map(Object.freeze)),
		bounds: Object.freeze(bounds),
		designBounds: Object.freeze(designBounds),
		design: built
			? Object.freeze({
				id: built.id, source: built.source, status: built.status,
				minimumRadius: built.minimumRadius, radiusBinding: built.radiusBinding,
				minimumTransitionLength: built.minimumTransitionLength,
				transitionBinding: built.transitionBinding,
				derivations: built.derivations,
				exceptions: built.exceptionIds,
			})
			: profile?.declared ?? null,
		equalityCount: equalities.length,
		hardPointNames: Object.freeze([...seenHard]),
	});
}
