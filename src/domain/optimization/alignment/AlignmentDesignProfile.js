// src/domain/optimization/alignment/AlignmentDesignProfile.js
//
// AXTRAN2 Calculation Kernel - tier 3, as a declared profile with provenance.
//
// A design profile says what an alignment is allowed to be: how tight a curve
// may run, how short an element may be. Those are not properties of a
// calculation. They come from a rule book, and this module's whole job is to
// carry them with the record of where they came from and to turn them into the
// two things the solver can hold - a largest admissible curvature and a
// smallest admissible length per element kind.
//
// Provenance is required, not encouraged. A profile whose numbers cannot say
// where they came from is refused, because a limit without a source cannot be
// checked, cannot be reviewed, and will be copied into the next project by
// someone who assumes it was.
//
// The kinematics
// --------------
// With V the design speed, R the radius, s the dynamic gauge, u the applied
// cant and u_f the cant deficiency, all lengths in metres and V in m/s:
//
//     equilibrium cant     u_eq = s V^2 / (g R)
//     cant deficiency      u_f  = u_eq - u
//     lateral acceleration a_q  = g u_f / s
//
// so the smallest radius that keeps the deficiency within its limit is
//
//     R >= s V^2 / (g (u + u_f))                                          (1)
//
// and a transition has to be long enough for the cant to be built up and for
// the deficiency to change, at the rates the rule book allows:
//
//     L >= V u / (du/dt)                cant ramp, in time                (2)
//     L >= n u                          cant ramp, in space (gradient 1:n)(3)
//     L >= V u_f / (du_f/dt)            deficiency change rate            (4)
//
// These are physics and geometry. Every limit in them - u, u_f, the two rates,
// the gradient - is a rule-book number and is declared, never derived here.
//
// What this module does not model
// -------------------------------
// Cant itself. AXTRAN2 optimises the horizontal alignment; the cant is a design
// variable of another discipline and enters here only as an assumption, at its
// declared maximum. That makes (2), (3) and (4) the worst case for an element
// that runs the full cant range, and conservative for one that does not - the
// same conservatism as bounding |dkappa| by 1/R, and for the same reason: the
// honest form is a constraint coupling length and curvature, which the solver
// carries as neither.

export const ALIGNMENT_DESIGN_PROFILE_VERSION = "axtran2/alignment-design-profile/0.1";

/** Standard gravity, m/s^2. */
export const GRAVITY = 9.80665;

/**
 * Dynamic gauge for standard-gauge track: the distance between the running
 * edges plus the contact-point offset, which is what the cant formulas use.
 * Nominal track gauge is 1.435 m; this is not that number and the difference
 * matters at the third digit of every radius below.
 */
export const STANDARD_DYNAMIC_GAUGE = 1.5;

export const ELEMENT_KINDS = Object.freeze(["straight", "arc", "transition"]);

/**
 * Whether a profile's numbers have been confirmed against the rule book they
 * name. Nothing here decides this; it is carried so that a proposal built on
 * unconfirmed limits can say so.
 */
export const PROFILE_STATUSES = Object.freeze(["candidate", "confirmed"]);

export class AlignmentDesignProfileError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "AlignmentDesignProfileError";
		this.code = code;
		this.detail = detail;
	}
}

function error(code, message, detail) {
	throw new AlignmentDesignProfileError(code, message, detail);
}

function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function positive(value, label) {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		error("INVALID_LIMIT", `${label} must be a positive finite number`);
	}
	return value;
}

/**
 * A declared limit: its value, where it came from, and whether anyone has read
 * that source. The source is a free string on purpose - this module cannot check
 * a citation, and pretending to would be worse than carrying it plainly. What it
 * can do is refuse to let a profile call itself confirmed while any of its
 * limits is still unread.
 */
function requireSourced(entry, label) {
	if (!isObject(entry)) {
		error("MISSING_PROVENANCE",
			`${label} must be declared as { value, source }, so that the limit says where it came from`,
			{ limit: label });
	}
	const source = typeof entry.source === "string" ? entry.source.trim() : "";
	if (!source) {
		error("MISSING_PROVENANCE", `${label} carries no source`, { limit: label });
	}
	return Object.freeze({
		value: positive(entry.value, `${label}.value`),
		source,
		verified: entry.verified === true,
	});
}

function optionalSourced(entry, label) {
	return entry === undefined || entry === null ? null : requireSourced(entry, label);
}

/**
 * Build a design profile.
 *
 * @param {object} declaration
 * @param {string} declaration.id
 * @param {string} declaration.source          where the profile as a whole comes from
 * @param {"candidate"|"confirmed"} [declaration.status]
 * @param {{value:number,source:string}} declaration.speed                m/s
 * @param {{value:number,source:string}} declaration.maximumCant          m
 * @param {{value:number,source:string}} declaration.maximumCantDeficiency m
 * @param {{value:number,source:string}} [declaration.maximumCantRate]     m/s
 * @param {{value:number,source:string}} [declaration.cantGradient]        1:n, the n
 * @param {{value:number,source:string}} [declaration.maximumDeficiencyRate] m/s
 * @param {{value:number,source:string}} [declaration.absoluteMinimumRadius]
 *        a floor the kinematics may not undercut, from the rule book itself
 * @param {{value:number,source:string}} [declaration.regulatoryCantLimit]
 *        a cap on the cant from the regulation itself, which the declared
 *        maximumCant may not exceed
 * @param {{value:number,source:string}} [declaration.dynamicGauge]        m
 * @param {Record<string,{value:number,source:string}>} [declaration.minimumLength]
 *        per element kind, where the rule book states one directly
 * @param {Record<string,object>} [declaration.exceptions]
 *        per element id, each with its own source: real projects carry local
 *        departures, and an exception that cannot say why is not one
 */
export function createAlignmentDesignProfile(declaration = {}) {
	if (!isObject(declaration)) error("INVALID_PROFILE", "a profile must be an object");
	const id = typeof declaration.id === "string" ? declaration.id.trim() : "";
	if (!id) error("MISSING_ID", "a profile must be named");
	const source = typeof declaration.source === "string" ? declaration.source.trim() : "";
	if (!source) {
		error("MISSING_PROVENANCE", `profile "${id}" does not say where it comes from`);
	}
	const status = declaration.status ?? "candidate";
	if (!PROFILE_STATUSES.includes(status)) {
		error("UNKNOWN_STATUS", `status must be one of ${PROFILE_STATUSES.join(", ")}`);
	}

	const speed = requireSourced(declaration.speed, "speed");
	const cant = requireSourced(declaration.maximumCant, "maximumCant");
	// A regulation may cap the cant outright, independently of what the line's
	// own design rules allow. EBO does. The cap is declared like everything else,
	// because which regulation applies is not this module's business - what is,
	// is refusing a value that exceeds one that was declared.
	const cantCap = optionalSourced(declaration.regulatoryCantLimit, "regulatoryCantLimit");
	if (cantCap && cant.value > cantCap.value) {
		error("CANT_ABOVE_REGULATION",
			`maximumCant of ${(cant.value * 1000).toFixed(0)} mm exceeds the declared regulatory `
				+ `limit of ${(cantCap.value * 1000).toFixed(0)} mm`,
			{ declared: cant.value, limit: cantCap.value, source: cantCap.source });
	}
	const deficiency = requireSourced(declaration.maximumCantDeficiency, "maximumCantDeficiency");
	const gauge = optionalSourced(declaration.dynamicGauge, "dynamicGauge");
	const s = gauge?.value ?? STANDARD_DYNAMIC_GAUGE;

	const cantRate = optionalSourced(declaration.maximumCantRate, "maximumCantRate");
	const gradient = optionalSourced(declaration.cantGradient, "cantGradient");
	const deficiencyRate = optionalSourced(declaration.maximumDeficiencyRate, "maximumDeficiencyRate");
	const floor = optionalSourced(declaration.absoluteMinimumRadius, "absoluteMinimumRadius");

	const V = speed.value;

	// (1) R >= s V^2 / (g (u + u_f))
	const kinematicRadius = (s * V * V) / (GRAVITY * (cant.value + deficiency.value));
	const derivations = [Object.freeze({
		quantity: "minimumRadius",
		value: kinematicRadius,
		formula: "s V^2 / (g (u + u_f))",
		from: Object.freeze([speed.source, cant.source, deficiency.source]),
	})];

	// A rule-book floor is not a competing derivation; it is a statement that no
	// kinematics may undercut it, so the binding radius is the larger.
	let minimumRadius = kinematicRadius;
	let radiusBinding = "kinematics";
	if (floor && floor.value > minimumRadius) {
		minimumRadius = floor.value;
		radiusBinding = "absolute-minimum";
	}

	// (2), (3), (4): the transition has to satisfy every rate it is subject to,
	// so the longest of them binds.
	const transitionRules = [];
	if (cantRate) {
		transitionRules.push(Object.freeze({
			value: (V * cant.value) / cantRate.value,
			formula: "V u / (du/dt)", from: Object.freeze([speed.source, cant.source, cantRate.source]),
		}));
	}
	if (gradient) {
		transitionRules.push(Object.freeze({
			value: gradient.value * cant.value,
			formula: "n u", from: Object.freeze([gradient.source, cant.source]),
		}));
	}
	if (deficiencyRate) {
		transitionRules.push(Object.freeze({
			value: (V * deficiency.value) / deficiencyRate.value,
			formula: "V u_f / (du_f/dt)",
			from: Object.freeze([speed.source, deficiency.source, deficiencyRate.source]),
		}));
	}
	let transitionMinimum = 0;
	let transitionBinding = null;
	for (const rule of transitionRules) {
		if (rule.value > transitionMinimum) {
			transitionMinimum = rule.value;
			transitionBinding = rule.formula;
		}
		derivations.push(Object.freeze({ quantity: "minimumTransitionLength", ...rule }));
	}

	// Lengths the rule book states outright, which override nothing but raise
	// what the kinematics produced where they are stricter.
	const declaredLengths = {};
	if (declaration.minimumLength !== undefined) {
		if (!isObject(declaration.minimumLength)) {
			error("INVALID_LIMIT", "minimumLength must be a map of element kind to { value, source }");
		}
		for (const [kind, entry] of Object.entries(declaration.minimumLength)) {
			if (!ELEMENT_KINDS.includes(kind)) {
				error("UNKNOWN_ELEMENT_KIND", `minimumLength names "${kind}", not an element kind`);
			}
			declaredLengths[kind] = requireSourced(entry, `minimumLength.${kind}`);
		}
	}

	const lengthFor = (kind) => {
		const declared = declaredLengths[kind]?.value ?? 0;
		if (kind !== "transition") return declared;
		return Math.max(declared, transitionMinimum);
	};

	// Local departures. A project keeps a curve it inherited, or a station throat
	// runs tighter than the open line; those are real, and they are declared per
	// element with their own reason. What is not allowed is an exception with no
	// source, which is indistinguishable from an error.
	const exceptions = new Map();
	if (declaration.exceptions !== undefined) {
		if (!isObject(declaration.exceptions)) {
			error("INVALID_EXCEPTION", "exceptions must be a map of element id to a declaration");
		}
		for (const [elementId, entry] of Object.entries(declaration.exceptions)) {
			if (!isObject(entry)) error("INVALID_EXCEPTION", `exception for "${elementId}" must be an object`);
			const reason = typeof entry.source === "string" ? entry.source.trim() : "";
			if (!reason) {
				error("MISSING_PROVENANCE",
					`the exception for "${elementId}" carries no source; an exception that cannot say why is not one`,
					{ elementId });
			}
			exceptions.set(elementId, Object.freeze({
				source: reason,
				minimumRadius: entry.minimumRadius === undefined
					? null : positive(entry.minimumRadius, `exceptions.${elementId}.minimumRadius`),
				minimumLength: entry.minimumLength === undefined
					? null : positive(entry.minimumLength, `exceptions.${elementId}.minimumLength`),
			}));
		}
	}

	// "confirmed" is a claim about every number in the profile, so it cannot be
	// made while any of them is still unread. This is the one thing the module
	// can do about provenance beyond carrying it: stop the claim from being made
	// loosely, since a profile marked confirmed is one nobody will check again.
	const limits = {
		speed, maximumCant: cant, maximumCantDeficiency: deficiency,
		maximumCantRate: cantRate, cantGradient: gradient,
		maximumDeficiencyRate: deficiencyRate, absoluteMinimumRadius: floor,
		dynamicGauge: gauge, regulatoryCantLimit: cantCap,
	};
	const unverified = Object.entries(limits)
		.filter(([, entry]) => entry !== null && entry.verified !== true)
		.map(([name]) => name);
	for (const [kind, entry] of Object.entries(declaredLengths)) {
		if (entry.verified !== true) unverified.push(`minimumLength.${kind}`);
	}
	if (status === "confirmed" && unverified.length > 0) {
		error("UNVERIFIED_LIMITS",
			`profile "${id}" cannot be confirmed while ${unverified.length} of its limits are `
				+ `unread: ${unverified.join(", ")}`,
			{ unverified });
	}

	return Object.freeze({
		version: ALIGNMENT_DESIGN_PROFILE_VERSION,
		id,
		source,
		status,
		/** Limits whose source nobody has read yet. Empty is what confirmed means. */
		unverified: Object.freeze(unverified),
		speed: speed.value,
		dynamicGauge: s,
		minimumRadius,
		maximumCurvature: 1 / minimumRadius,
		radiusBinding,
		kinematicRadius,
		minimumTransitionLength: transitionMinimum || null,
		transitionBinding,
		derivations: Object.freeze(derivations),
		declared: Object.freeze({
			...limits,
			minimumLength: Object.freeze({ ...declaredLengths }),
		}),
		exceptionFor: (elementId) => exceptions.get(elementId) ?? null,
		exceptionIds: Object.freeze([...exceptions.keys()]),

		/** Smallest admissible length for one element, exceptions included. */
		minimumLengthFor(kind, elementId = null) {
			const exception = elementId === null ? null : exceptions.get(elementId);
			if (exception?.minimumLength !== null && exception?.minimumLength !== undefined) {
				return exception.minimumLength;
			}
			return lengthFor(kind);
		},

		/** Largest admissible curvature for one element, exceptions included. */
		maximumCurvatureFor(elementId = null) {
			const exception = elementId === null ? null : exceptions.get(elementId);
			if (exception?.minimumRadius !== null && exception?.minimumRadius !== undefined) {
				return 1 / exception.minimumRadius;
			}
			return 1 / minimumRadius;
		},
	});
}
