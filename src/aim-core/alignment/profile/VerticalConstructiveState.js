export const VERTICAL_CONSTRUCTIVE_STATE_VERSION =
	"aim-core/vertical-constructive-state/0.1";

export class VerticalConstructiveStateError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "VerticalConstructiveStateError";
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
	throw new VerticalConstructiveStateError(code, message);
}

function requireId(value, label) {
	if (typeof value !== "string" || !value.trim()) {
		error("INVALID_ID", `${label} must be a non-empty string`);
	}
	return value.trim();
}

function lawAt(element, s) {
	const u = s - element.startS;
	if (element.type === "constant-gradient") {
		return {
			elevation:
				element.startElevation + element.gradient * u,
			gradient: element.gradient,
		};
	}
	return {
		elevation:
			element.startElevation +
			element.startGradient * u +
			0.5 * element.gradientRate * u * u,
		gradient:
			element.startGradient + element.gradientRate * u,
	};
}

function isElementShape(element) {
	if (
		!isObject(element) ||
		!isTrimmedId(element.id) ||
		!["constant-gradient", "parabolic"].includes(element.type)
	) {
		return false;
	}
	const common = [
		element.startS,
		element.endS,
		element.startElevation,
	];
	if (!common.every(isFiniteNumber) || element.endS <= element.startS) {
		return false;
	}
	if (element.type === "constant-gradient") {
		return isFiniteNumber(element.gradient);
	}
	return (
		isFiniteNumber(element.startGradient) &&
		isFiniteNumber(element.gradientRate)
	);
}

export function isVerticalConstructiveState(value) {
	if (
		!isObject(value) ||
		value.contractVersion !==
			VERTICAL_CONSTRUCTIVE_STATE_VERSION ||
		value.type !== "VerticalConstructiveState" ||
		!isTrimmedId(value.id) ||
		!isTrimmedId(value.alignmentId) ||
		value.longitudinalParameter !== "intrinsic-s" ||
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
		const previousEnd = lawAt(previous, previous.endS);
		const startGradient =
			element.type === "constant-gradient"
				? element.gradient
				: element.startGradient;
		if (
			element.startS !== previous.endS ||
			element.startElevation !== previousEnd.elevation ||
			startGradient !== previousEnd.gradient
		) {
			return false;
		}
	}
	return true;
}

export function assertVerticalConstructiveState(
	value,
	context = "VerticalConstructiveState"
) {
	if (!isVerticalConstructiveState(value)) {
		throw new TypeError(
			`${context}: invalid VerticalConstructiveState`
		);
	}
	return value;
}

export function createVerticalConstructiveState(
	{ id, alignmentId } = {}
) {
	return Object.freeze({
		contractVersion: VERTICAL_CONSTRUCTIVE_STATE_VERSION,
		type: "VerticalConstructiveState",
		id: requireId(id, "vertical state id"),
		alignmentId: requireId(alignmentId, "Alignment id"),
		longitudinalParameter: "intrinsic-s",
		elements: Object.freeze([]),
	});
}

function requireState(state) {
	if (!isVerticalConstructiveState(state)) {
		error("INVALID_STATE", "invalid vertical constructive state");
	}
	return state;
}

function validateNewElement(element) {
	if (!isObject(element)) {
		error("INVALID_ELEMENT", "vertical element must be an object");
	}
	const id = requireId(element.id, "vertical element id");
	if (
		!["constant-gradient", "parabolic"].includes(element.type)
	) {
		error(
			"UNSUPPORTED_ELEMENT_TYPE",
			`unsupported vertical element type ${String(element.type)}`
		);
	}
	const required =
		element.type === "constant-gradient"
			? ["startS", "endS", "startElevation", "gradient"]
			: [
					"startS",
					"endS",
					"startElevation",
					"startGradient",
					"gradientRate",
				];
	if (!required.every((field) => isFiniteNumber(element[field]))) {
		error(
			"INVALID_ELEMENT",
			"vertical element numeric fields must be finite"
		);
	}
	if (element.endS <= element.startS) {
		error(
			"INVALID_DOMAIN",
			"vertical element endS must be greater than startS"
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

export function appendVerticalElement(state, element) {
	requireState(state);
	const nextElement = validateNewElement(element);
	if (state.elements.some((entry) => entry.id === nextElement.id)) {
		error(
			"ELEMENT_ALREADY_EXISTS",
			`vertical element ${nextElement.id} already exists`
		);
	}

	const previous = state.elements.at(-1);
	if (previous) {
		if (nextElement.startS !== previous.endS) {
			error(
				"NON_CONTIGUOUS_DOMAIN",
				"vertical element domain must start at the preceding endS"
			);
		}
		const previousEnd = lawAt(previous, previous.endS);
		if (nextElement.startElevation !== previousEnd.elevation) {
			error(
				"ELEVATION_DISCONTINUITY",
				"vertical element startElevation must equal preceding end elevation"
			);
		}
		const startGradient =
			nextElement.type === "constant-gradient"
				? nextElement.gradient
				: nextElement.startGradient;
		if (startGradient !== previousEnd.gradient) {
			error(
				"GRADIENT_DISCONTINUITY",
				"vertical element start gradient must equal preceding end gradient"
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

export function evaluateVerticalAt(state, { s } = {}) {
	requireState(state);
	if (!isFiniteNumber(s)) {
		error("INVALID_ELEMENT", "evaluation position s must be finite");
	}
	if (state.elements.length === 0) {
		error("EMPTY_PROFILE", "vertical profile has no elements");
	}
	const first = state.elements[0];
	const last = state.elements.at(-1);
	if (s < first.startS || s > last.endS) {
		error(
			"POSITION_OUTSIDE_DOMAIN",
			"evaluation position lies outside the vertical profile"
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
		elevation: result.elevation,
		gradient: result.gradient,
	};
}
