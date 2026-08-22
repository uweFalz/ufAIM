/**
 * Creates the immutable, unapplied result of a Transition/AXTRAN preview.
 *
 * The projection is application data only. It does not assert that a
 * continuity candidate or prepared AXTRAN contract has been applied.
 */
export function createTransitionAxtranPreviewProjection({
	active,
	selected,
	descriptor = null,
	evaluation = null,
	continuityEvaluation = null,
	continuityCandidate = null,
	continuityValidation = null,
	axtranContract = null,
	provenance = null,
	errors = [],
} = {}) {
	return deepFreeze({
		status: "unapplied",
		active: clone(active),
		selected: clone(selected),
		descriptor: clone(descriptor),
		evaluation: clone(evaluation),
		continuity: {
			evaluation: clone(continuityEvaluation),
			candidate: clone(continuityCandidate),
			validation: clone(continuityValidation),
		},
		axtranContract: clone(axtranContract),
		provenance: clone(provenance),
		errors: clone(errors),
	});
}

function clone(value) {
	if (value === undefined) return null;
	return structuredClone(value);
}

function deepFreeze(value, seen = new Set()) {
	if (
		value === null ||
		(typeof value !== "object" && typeof value !== "function") ||
		seen.has(value)
	) {
		return value;
	}
	seen.add(value);
	for (const child of Object.values(value)) {
		deepFreeze(child, seen);
	}
	return Object.freeze(value);
}
