// src/domain/optimization/alignment/AlignmentVariableCodec.js
//
// AXTRAN2 Calculation Kernel — variable declaration.
//
// Declares which engineering quantities of an alignment are held, free or
// derived, and maps them to and from a flat parameter vector.
//
// Scaling is by engineering magnitude, not by Jacobian norm: one metre of
// length, one unit of 1e-3 1/m of curvature (a radius near 1000 m). A scale
// taken from the Jacobian changes every iteration and interacts with the
// damping; a fixed diagonal known before the solve does not.
//
// This module has no dependencies. It performs no evaluation, no solving and
// no selection.

export const ALIGNMENT_VARIABLE_CODEC_VERSION =
	"axtran2/alignment-variable-codec/0.1";

export const VARIABLE_ROLES = Object.freeze(["held", "free", "derived"]);

export const VARIABLE_KINDS = Object.freeze({
	length: Object.freeze({ unit: "m", scale: 1, minimum: 0 }),
	curvature: Object.freeze({ unit: "1/m", scale: 1e-3, minimum: null }),
});

export class AlignmentVariableCodecError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "AlignmentVariableCodecError";
		this.code = code;
	}
}

function error(code, message) {
	throw new AlignmentVariableCodecError(code, message);
}

function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}

function requireId(value, label) {
	if (typeof value !== "string" || !value.trim()) {
		error("INVALID_ID", `${label} must be a non-empty string`);
	}
	return value.trim();
}

/**
 * @param {object} declaration
 * @param {Array<{id: string, quantities: Record<string, string>, values?: Record<string, number>}>} declaration.elements
 */
export function createAlignmentVariableCodec({ elements } = {}) {
	if (!Array.isArray(elements) || elements.length === 0) {
		error("EMPTY_SEQUENCE", "elements must be a non-empty array");
	}

	const slots = [];
	const seen = new Set();
	const sequence = [];

	for (const [index, element] of elements.entries()) {
		if (!isObject(element)) {
			error("INVALID_ELEMENT", `element at index ${index} must be an object`);
		}
		const id = requireId(element.id, `element[${index}].id`);
		if (seen.has(id)) {
			error("DUPLICATE_ELEMENT_ID", `element id "${id}" occurs more than once`);
		}
		seen.add(id);
		sequence.push(id);

		const quantities = element.quantities;
		if (!isObject(quantities) || Object.keys(quantities).length === 0) {
			error("NO_QUANTITIES", `element "${id}" declares no quantities`);
		}

		for (const [kind, role] of Object.entries(quantities)) {
			if (!(kind in VARIABLE_KINDS)) {
				error("UNKNOWN_QUANTITY", `element "${id}" declares unknown quantity "${kind}"`);
			}
			if (!VARIABLE_ROLES.includes(role)) {
				error("UNKNOWN_ROLE", `element "${id}".${kind} has unknown role "${role}"`);
			}
			const value = element.values?.[kind];
			if (value !== undefined && !isFiniteNumber(value)) {
				error("INVALID_VALUE", `element "${id}".${kind} value must be a finite number`);
			}
			slots.push(Object.freeze({
				name: `${id}.${kind}`,
				elementId: id,
				elementIndex: index,
				kind,
				role,
				unit: VARIABLE_KINDS[kind].unit,
				scale: VARIABLE_KINDS[kind].scale,
				value: value ?? null,
			}));
		}
	}

	const free = slots.filter((slot) => slot.role === "free");
	const held = slots.filter((slot) => slot.role === "held");
	const derived = slots.filter((slot) => slot.role === "derived");

	if (free.length === 0) {
		error("NO_FREE_VARIABLES", "at least one quantity must be declared free");
	}

	const frozenSlots = Object.freeze(slots.map(Object.freeze));
	const freeNames = Object.freeze(free.map((slot) => slot.name));

	return Object.freeze({
		version: ALIGNMENT_VARIABLE_CODEC_VERSION,
		elementSequence: Object.freeze(sequence),
		slots: frozenSlots,
		freeNames,
		freeCount: free.length,
		heldCount: held.length,
		derivedCount: derived.length,

		/** Scale vector for the free variables, in declaration order. */
		freeScales: Object.freeze(free.map((slot) => slot.scale)),

		/** Flat vector of the free variables' declared values. */
		encode(values = {}) {
			return Object.freeze(free.map((slot) => {
				const supplied = values?.[slot.name];
				const value = supplied ?? slot.value;
				if (!isFiniteNumber(value)) {
					error("MISSING_VALUE", `no finite value for free variable "${slot.name}"`);
				}
				return value;
			}));
		},

		/** Named overlay from a flat vector of free-variable values. */
		decode(vector = []) {
			if (!Array.isArray(vector) || vector.length !== free.length) {
				error("VECTOR_LENGTH", `vector must hold ${free.length} values, received ${vector?.length ?? 0}`);
			}
			const overlay = {};
			for (const [i, slot] of free.entries()) {
				if (!isFiniteNumber(vector[i])) {
					error("INVALID_VALUE", `vector[${i}] for "${slot.name}" is not finite`);
				}
				(overlay[slot.elementId] ||= {})[slot.kind] = vector[i];
			}
			return Object.freeze(overlay);
		},

		roleOf(name) {
			return slots.find((slot) => slot.name === name)?.role ?? null;
		},
	});
}
