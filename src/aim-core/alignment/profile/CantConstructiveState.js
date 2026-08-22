export const CANT_CONSTRUCTIVE_STATE_VERSION =
	"aim-core/cant-constructive-state/0.1";

const QUANTITY = "cross-level";
const UNIT = "alignment-length-unit";
const SIGN_CONVENTION =
	"left-minus-right-viewed-in-increasing-s";

export class CantConstructiveStateError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "CantConstructiveStateError";
		this.code = code;
	}
}

function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}

function isTrimmedId(value) {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value === value.trim()
	);
}

function error(code, message) {
	throw new CantConstructiveStateError(code, message);
}

function requireId(value, label) {
	if (typeof value !== "string" || !value.trim()) {
		error("INVALID_ID", `${label} must be a non-empty string`);
	}
	return value.trim();
}

function lawAt(element, s) {
	const u = s - element.startS;
	if (element.type === "constant-cross-level") {
		return {
			crossLevel: element.startCrossLevel,
			twist: 0,
		};
	}
	return {
		crossLevel:
			element.startCrossLevel + element.crossLevelRate * u,
		twist: element.crossLevelRate,
	};
}

function isElementShape(element) {
	if (
		!isObject(element) ||
		!isTrimmedId(element.id) ||
		!["constant-cross-level", "linear-cross-level"].includes(
			element.type
		)
	) {
		return false;
	}
	if (
		![element.startS, element.endS, element.startCrossLevel].every(
			isFiniteNumber
		) ||
		element.endS <= element.startS
	) {
		return false;
	}
	return (
		element.type === "constant-cross-level" ||
		isFiniteNumber(element.crossLevelRate)
	);
}

export function isCantConstructiveState(value) {
	if (
		!isObject(value) ||
		value.contractVersion !== CANT_CONSTRUCTIVE_STATE_VERSION ||
		value.type !== "CantConstructiveState" ||
		!isTrimmedId(value.id) ||
		!isTrimmedId(value.alignmentId) ||
		value.longitudinalParameter !== "intrinsic-s" ||
		value.quantity !== QUANTITY ||
		value.unit !== UNIT ||
		value.signConvention !== SIGN_CONVENTION ||
		!Array.isArray(value.elements)
	) {
		return false;
	}

	const ids = new Set();
	for (let index = 0; index < value.elements.length; index += 1) {
		const element = value.elements[index];
		if (!isElementShape(element) || ids.has(element.id)) {
			return false;
		}
		ids.add(element.id);
		if (index === 0) continue;
		const previous = value.elements[index - 1];
		if (
			element.startS !== previous.endS ||
			element.startCrossLevel !==
				lawAt(previous, previous.endS).crossLevel
		) {
			return false;
		}
	}
	return true;
}

export function assertCantConstructiveState(
	value,
	context = "CantConstructiveState"
) {
	if (!isCantConstructiveState(value)) {
		throw new TypeError(`${context}: invalid CantConstructiveState`);
	}
	return value;
}

export function createCantConstructiveState(
	{ id, alignmentId } = {}
) {
	return Object.freeze({
		contractVersion: CANT_CONSTRUCTIVE_STATE_VERSION,
		type: "CantConstructiveState",
		id: requireId(id, "cant state id"),
		alignmentId: requireId(alignmentId, "Alignment id"),
		longitudinalParameter: "intrinsic-s",
		quantity: QUANTITY,
		unit: UNIT,
		signConvention: SIGN_CONVENTION,
		elements: Object.freeze([]),
	});
}

function requireState(state) {
	if (!isCantConstructiveState(state)) {
		error("INVALID_STATE", "invalid cant constructive state");
	}
	return state;
}

function validateNewElement(element) {
	if (!isObject(element)) {
		error("INVALID_ELEMENT", "cant element must be an object");
	}
	const id = requireId(element.id, "cant element id");
	if (
		!["constant-cross-level", "linear-cross-level"].includes(
			element.type
		)
	) {
		error(
			"UNSUPPORTED_ELEMENT_TYPE",
			`unsupported cant element type ${String(element.type)}`
		);
	}
	const required =
		element.type === "constant-cross-level"
			? ["startS", "endS", "startCrossLevel"]
			: [
					"startS",
					"endS",
					"startCrossLevel",
					"crossLevelRate",
				];
	if (!required.every((field) => isFiniteNumber(element[field]))) {
		error(
			"INVALID_ELEMENT",
			"cant element numeric fields must be finite"
		);
	}
	if (element.endS <= element.startS) {
		error(
			"INVALID_DOMAIN",
			"cant element endS must be greater than startS"
		);
	}
	return { ...element, id };
}

function freezeExistingElements(elements) {
	return elements.map((element) =>
		Object.isFrozen(element)
			? element
			: Object.freeze({ ...element })
	);
}

export function appendCantElement(state, element) {
	requireState(state);
	const nextElement = validateNewElement(element);
	if (state.elements.some((entry) => entry.id === nextElement.id)) {
		error(
			"ELEMENT_ALREADY_EXISTS",
			`cant element ${nextElement.id} already exists`
		);
	}

	const previous = state.elements.at(-1);
	if (previous) {
		if (nextElement.startS !== previous.endS) {
			error(
				"NON_CONTIGUOUS_DOMAIN",
				"cant element domain must start at the preceding endS"
			);
		}
		if (
			nextElement.startCrossLevel !==
			lawAt(previous, previous.endS).crossLevel
		) {
			error(
				"CROSS_LEVEL_DISCONTINUITY",
				"cant element startCrossLevel must equal preceding end cross-level"
			);
		}
	}

	const elements = Object.freeze([
		...freezeExistingElements(state.elements),
		Object.freeze(nextElement),
	]);
	return Object.freeze({
		...state,
		elements,
	});
}

export function evaluateCantAt(state, { s } = {}) {
	requireState(state);
	if (!isFiniteNumber(s)) {
		error("INVALID_ELEMENT", "evaluation position s must be finite");
	}
	if (state.elements.length === 0) {
		error("EMPTY_CANT", "cant state has no elements");
	}
	const first = state.elements[0];
	const last = state.elements.at(-1);
	if (s < first.startS || s > last.endS) {
		error(
			"POSITION_OUTSIDE_DOMAIN",
			"evaluation position lies outside the cant state"
		);
	}

	const element =
		s === last.endS
			? last
			: state.elements.find(
					(entry) => s >= entry.startS && s < entry.endS
				);
	const result = lawAt(element, s);
	return {
		elementId: element.id,
		s,
		crossLevel: result.crossLevel,
		twist: result.twist,
		quantity: QUANTITY,
		unit: UNIT,
		signConvention: SIGN_CONVENTION,
	};
}
