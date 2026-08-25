export const RAIL_PAIR_CANT_CONSTRUCTIVE_STATE_VERSION =
	"aim-core/rail-pair-cant-constructive-state/0.1";

const UNIT = "alignment-length-unit";
const PARAMETER = "intrinsic-s";
const SEPARATION_KIND =
	"horizontal-projection-between-governing-references";

export class RailPairCantConstructiveStateError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "RailPairCantConstructiveStateError";
		this.code = code;
	}
}

function fail(code, message) {
	throw new RailPairCantConstructiveStateError(code, message);
}

function object(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function id(value) {
	return typeof value === "string" && value.trim() === value && value.length > 0;
}

function finite(value) {
	return typeof value === "number" && Number.isFinite(value);
}

function deepFreeze(value) {
	if (Array.isArray(value)) {
		value.forEach(deepFreeze);
		return Object.freeze(value);
	}
	if (object(value)) {
		Object.values(value).forEach(deepFreeze);
		return Object.freeze(value);
	}
	return value;
}

function clone(value) {
	if (Array.isArray(value)) return value.map(clone);
	if (object(value)) {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, clone(entry)])
		);
	}
	return value;
}

function cloneAndFreeze(value) {
	return deepFreeze(clone(value));
}

function lawAt(element, s) {
	return element.type === "constant-rail-offset"
		? element.startOffset
		: element.startOffset + element.offsetRate * (s - element.startS);
}

function validCoverage(coverage) {
	return object(coverage) &&
		["complete", "incomplete"].includes(coverage.status) &&
		finite(coverage.startS) && finite(coverage.endS) &&
		coverage.endS > coverage.startS &&
		(coverage.status !== "complete" || coverage.authority === "admitted-construction");
}

function validAnchorRule(rule, railPair) {
	if (!object(rule) || !id(rule.id) || !id(rule.version) ||
		!["midpoint", "left-reference", "right-reference", "qualified-other"].includes(rule.kind) ||
		!object(rule.provenance) || !id(rule.provenance.sourceId)) return false;
	if (rule.kind === "left-reference" && rule.railId !== railPair.leftRailId) return false;
	if (rule.kind === "right-reference" && rule.railId !== railPair.rightRailId) return false;
	if (rule.kind === "qualified-other") {
		return finite(rule.leftLateralOffset) && finite(rule.rightLateralOffset);
	}
	return true;
}

function validRailPair(railPair) {
	return object(railPair) && id(railPair.leftRailId) && id(railPair.rightRailId) &&
		railPair.leftRailId !== railPair.rightRailId && object(railPair.separation) &&
		railPair.separation.kind === SEPARATION_KIND &&
		railPair.separation.unit === UNIT && finite(railPair.separation.value) &&
		railPair.separation.value > 0 && id(railPair.separation.measurementDefinition) &&
		object(railPair.separation.provenance) && id(railPair.separation.provenance.sourceId);
}

function validElement(element, state) {
	if (!object(element) || !id(element.id) ||
		![state.railPair.leftRailId, state.railPair.rightRailId].includes(element.railId) ||
		!["constant-rail-offset", "linear-rail-offset"].includes(element.type) ||
		!finite(element.startS) || !finite(element.endS) || element.endS <= element.startS ||
		element.startS < state.coverage.startS || element.endS > state.coverage.endS ||
		!finite(element.startOffset)) return false;
	if (element.type === "linear-rail-offset" && !finite(element.offsetRate)) return false;
	return !(element.startOffset === 0 &&
		(element.type === "constant-rail-offset" || element.offsetRate === 0));
}

function elementsValid(state) {
	const ids = new Set();
	for (const element of state.elements) {
		if (!validElement(element, state) || ids.has(element.id)) return false;
		ids.add(element.id);
	}
	for (const railId of [state.railPair.leftRailId, state.railPair.rightRailId]) {
		const elements = state.elements
			.filter((entry) => entry.railId === railId)
			.sort((a, b) => a.startS - b.startS || a.endS - b.endS);
		for (let index = 1; index < elements.length; index += 1) {
			const previous = elements[index - 1];
			const current = elements[index];
			if (current.startS < previous.endS) return false;
			if (current.startS === previous.endS &&
				current.startOffset !== lawAt(previous, previous.endS)) return false;
		}
	}
	return true;
}

export function isRailPairCantConstructiveState(value) {
	return object(value) &&
		value.contractVersion === RAIL_PAIR_CANT_CONSTRUCTIVE_STATE_VERSION &&
		value.type === "RailPairCantConstructiveState" && id(value.id) &&
		id(value.alignmentId) && value.longitudinalParameter === PARAMETER &&
		value.unit === UNIT && validCoverage(value.coverage) &&
		validRailPair(value.railPair) && validAnchorRule(value.anchorRule, value.railPair) &&
		Array.isArray(value.elements) && elementsValid(value);
}

export function assertRailPairCantConstructiveState(value, context = "RailPairCantConstructiveState") {
	if (!isRailPairCantConstructiveState(value)) {
		throw new TypeError(`${context}: invalid RailPairCantConstructiveState`);
	}
	return value;
}

export function createRailPairCantConstructiveState({
	id: stateId,
	alignmentId,
	coverage,
	railPair,
	anchorRule,
} = {}) {
	const state = {
		contractVersion: RAIL_PAIR_CANT_CONSTRUCTIVE_STATE_VERSION,
		type: "RailPairCantConstructiveState",
		id: stateId,
		alignmentId,
		longitudinalParameter: PARAMETER,
		unit: UNIT,
		coverage: clone(coverage),
		railPair: clone(railPair),
		anchorRule: clone(anchorRule),
		elements: [],
	};
	if (!isRailPairCantConstructiveState(state)) {
		fail("INVALID_STATE", "invalid rail-pair cant construction inputs");
	}
	return deepFreeze(state);
}

export function appendRailOffsetElement(state, element) {
	if (!isRailPairCantConstructiveState(state)) fail("INVALID_STATE", "invalid rail-pair cant state");
	if (!object(element)) fail("INVALID_ELEMENT", "rail offset element must be an object");
	if (!id(element.id)) fail("INVALID_ID", "rail offset element id is required");
	if (state.elements.some((entry) => entry.id === element.id)) fail("ELEMENT_ALREADY_EXISTS", `element ${element.id} already exists`);
	if (element.startOffset === 0 && (element.type === "constant-rail-offset" || element.offsetRate === 0)) {
		fail("REDUNDANT_ZERO_ELEMENT", "sparse rail offset state does not store identically zero elements");
	}
	const candidate = cloneAndFreeze(element);
	const next = { ...state, elements: [...state.elements, candidate] };
	if (!validElement(candidate, state)) fail("INVALID_ELEMENT", "invalid rail offset element");
	if (!elementsValid(next)) fail("RAIL_DOMAIN_CONFLICT", "same-rail elements overlap or meet discontinuously");
	return deepFreeze(next);
}

function activeElement(elements, s, coverageEnd) {
	const sorted = elements.slice().sort((a, b) => a.startS - b.startS);
	return sorted.find((entry, index) =>
		s >= entry.startS &&
		(s < entry.endS || (s === coverageEnd && index === sorted.length - 1 && s === entry.endS))
	) ?? null;
}

export function evaluateRailPairCantAt(state, { s } = {}) {
	if (!isRailPairCantConstructiveState(state)) fail("INVALID_STATE", "invalid rail-pair cant state");
	if (!finite(s)) fail("INVALID_POSITION", "s must be finite");
	if (s < state.coverage.startS || s > state.coverage.endS) fail("POSITION_OUTSIDE_COVERAGE", "s lies outside cant coverage");

	const evaluateRail = (railId) => {
		const element = activeElement(state.elements.filter((entry) => entry.railId === railId), s, state.coverage.endS);
		if (element) return { status: "known", offset: lawAt(element, s), elementId: element.id };
		if (state.coverage.status === "complete") return { status: "known", offset: 0, elementId: null };
		return { status: "unknown", offset: null, elementId: null };
	};
	const left = evaluateRail(state.railPair.leftRailId);
	const right = evaluateRail(state.railPair.rightRailId);
	const known = left.status === "known" && right.status === "known";
	return deepFreeze({
		status: known ? "known" : "unknown",
		s,
		left,
		right,
		crossLevel: known ? right.offset - left.offset : null,
		commonOffset: known ? 0.5 * (left.offset + right.offset) : null,
		separation: state.railPair.separation,
		anchorRule: state.anchorRule,
	});
}
