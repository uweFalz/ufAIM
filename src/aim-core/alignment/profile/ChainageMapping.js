export const CHAINAGE_MAPPING_VERSION =
	"aim-core/chainage-mapping/0.1";

const UNIT = "alignment-length-unit";

export class ChainageMappingError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "ChainageMappingError";
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
	throw new ChainageMappingError(code, message);
}

function requireId(value, label) {
	if (typeof value !== "string" || !value.trim()) {
		error("INVALID_ID", `${label} must be a non-empty string`);
	}
	return value.trim();
}

function isSegmentShape(segment) {
	return (
		isObject(segment) &&
		isTrimmedId(segment.id) &&
		isFiniteNumber(segment.startS) &&
		isFiniteNumber(segment.endS) &&
		isFiniteNumber(segment.startAddress) &&
		(segment.direction === 1 || segment.direction === -1) &&
		segment.endS > segment.startS
	);
}

export function isChainageMapping(value) {
	if (
		!isObject(value) ||
		value.contractVersion !== CHAINAGE_MAPPING_VERSION ||
		value.type !== "ChainageMapping" ||
		!isTrimmedId(value.id) ||
		!isTrimmedId(value.alignmentId) ||
		!isTrimmedId(value.schemeId) ||
		!isTrimmedId(value.schemeVersion) ||
		value.longitudinalParameter !== "intrinsic-s" ||
		value.addressQuantity !== "chainage" ||
		value.unit !== UNIT ||
		!Array.isArray(value.segments)
	) {
		return false;
	}

	const ids = new Set();
	for (let index = 0; index < value.segments.length; index += 1) {
		const segment = value.segments[index];
		if (!isSegmentShape(segment) || ids.has(segment.id)) {
			return false;
		}
		ids.add(segment.id);
		if (index === 0) continue;
		const previous = value.segments[index - 1];
		if (
			segment.startS < previous.startS ||
			segment.startS < previous.endS
		) {
			return false;
		}
	}
	return true;
}

export function assertChainageMapping(
	value,
	context = "ChainageMapping"
) {
	if (!isChainageMapping(value)) {
		throw new TypeError(`${context}: invalid ChainageMapping`);
	}
	return value;
}

export function createChainageMapping(
	{ id, alignmentId, schemeId, schemeVersion } = {}
) {
	return Object.freeze({
		contractVersion: CHAINAGE_MAPPING_VERSION,
		type: "ChainageMapping",
		id: requireId(id, "chainage mapping id"),
		alignmentId: requireId(alignmentId, "Alignment id"),
		schemeId: requireId(schemeId, "chainage scheme id"),
		schemeVersion: requireId(
			schemeVersion,
			"chainage scheme version"
		),
		longitudinalParameter: "intrinsic-s",
		addressQuantity: "chainage",
		unit: UNIT,
		segments: Object.freeze([]),
	});
}

function requireMapping(mapping) {
	if (!isChainageMapping(mapping)) {
		error("INVALID_MAPPING", "invalid chainage mapping");
	}
	return mapping;
}

function validateNewSegment(segment) {
	if (!isObject(segment)) {
		error("INVALID_SEGMENT", "chainage segment must be an object");
	}
	const id = requireId(segment.id, "chainage segment id");
	if (
		![segment.startS, segment.endS, segment.startAddress].every(
			isFiniteNumber
		)
	) {
		error(
			"INVALID_SEGMENT",
			"chainage segment numeric fields must be finite"
		);
	}
	if (segment.direction !== 1 && segment.direction !== -1) {
		error(
			"INVALID_DIRECTION",
			"chainage segment direction must be numeric 1 or -1"
		);
	}
	if (segment.endS <= segment.startS) {
		error(
			"INVALID_DOMAIN",
			"chainage segment endS must be greater than startS"
		);
	}
	return { ...segment, id };
}

function freezeExistingSegments(segments) {
	return segments.map((segment) =>
		Object.isFrozen(segment)
			? segment
			: Object.freeze({ ...segment })
	);
}

export function appendChainageSegment(mapping, segment) {
	requireMapping(mapping);
	const nextSegment = validateNewSegment(segment);
	if (mapping.segments.some((entry) => entry.id === nextSegment.id)) {
		error(
			"SEGMENT_ALREADY_EXISTS",
			`chainage segment ${nextSegment.id} already exists`
		);
	}

	const previous = mapping.segments.at(-1);
	if (previous) {
		if (nextSegment.startS < previous.startS) {
			error(
				"OUT_OF_ORDER_DOMAIN",
				"chainage segment starts before the preceding startS"
			);
		}
		if (nextSegment.startS < previous.endS) {
			error(
				"OVERLAPPING_INTRINSIC_DOMAIN",
				"chainage segment overlaps the preceding intrinsic interior"
			);
		}
	}

	const segments = Object.freeze([
		...freezeExistingSegments(mapping.segments),
		Object.freeze(nextSegment),
	]);
	return Object.freeze({
		...mapping,
		segments,
	});
}

function requireFiniteLookup(value, label) {
	if (!isFiniteNumber(value)) {
		error("INVALID_POSITION", `${label} must be finite`);
	}
}

export function mapIntrinsicToChainage(mapping, { s } = {}) {
	requireMapping(mapping);
	requireFiniteLookup(s, "intrinsic position s");
	const candidates = mapping.segments
		.filter((segment) => s >= segment.startS && s <= segment.endS)
		.map((segment) =>
			Object.freeze({
				segmentId: segment.id,
				s,
				address:
					segment.startAddress +
					segment.direction * (s - segment.startS),
				schemeId: mapping.schemeId,
				schemeVersion: mapping.schemeVersion,
				unit: UNIT,
			})
		);
	return Object.freeze(candidates);
}

export function mapChainageToIntrinsic(
	mapping,
	{ address } = {}
) {
	requireMapping(mapping);
	requireFiniteLookup(address, "chainage address");
	const candidates = [];
	for (const segment of mapping.segments) {
		const s =
			segment.startS +
			segment.direction * (address - segment.startAddress);
		if (s < segment.startS || s > segment.endS) continue;
		candidates.push(
			Object.freeze({
				segmentId: segment.id,
				address,
				s,
				alignmentId: mapping.alignmentId,
				schemeId: mapping.schemeId,
				schemeVersion: mapping.schemeVersion,
				unit: UNIT,
			})
		);
	}
	return Object.freeze(candidates);
}
