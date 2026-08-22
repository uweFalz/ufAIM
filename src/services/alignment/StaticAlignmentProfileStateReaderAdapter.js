import {
	assertAlignmentProfileStateReaderPort,
} from "../../aim-core/alignment/profile/AlignmentProfileStateReaderPort.js";
import {
	isVerticalConstructiveState,
} from "../../aim-core/alignment/profile/VerticalConstructiveState.js";
import {
	isCantConstructiveState,
} from "../../aim-core/alignment/profile/CantConstructiveState.js";
import {
	isChainageMapping,
} from "../../aim-core/alignment/profile/ChainageMapping.js";

export const STATIC_ALIGNMENT_PROFILE_STATE_READER_ADAPTER_VERSION =
	"app-adapter/static-alignment-profile-state-reader/0.1";

const EMPTY_MAPPINGS = Object.freeze([]);
const ABSENT_SNAPSHOT = Object.freeze({
	presence: "absent",
	revision: null,
	vertical: null,
	cant: null,
	chainageMappings: EMPTY_MAPPINGS,
});

export class StaticAlignmentProfileStateReaderAdapterError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "StaticAlignmentProfileStateReaderAdapterError";
		this.code = code;
	}
}

function fail(code, message) {
	throw new StaticAlignmentProfileStateReaderAdapterError(code, message);
}

function normalizedAlignmentId(value, subject = "Alignment identity") {
	if (typeof value !== "string" || value.trim() === "") {
		fail("INVALID_ALIGNMENT_ID", `${subject} must be a non-empty string`);
	}
	return value.trim();
}

function hasRequiredMembers(record) {
	return ["alignmentId", "vertical", "cant", "chainageMappings"].every(
		(member) => Object.prototype.hasOwnProperty.call(record, member)
	);
}

function installRecord(recordsByAlignmentId, record) {
	if (!record || typeof record !== "object" || Array.isArray(record)) {
		fail("INVALID_RECORD", "snapshot record must be a non-array object");
	}
	if (!hasRequiredMembers(record)) {
		fail(
			"INVALID_RECORD",
			"snapshot record requires alignmentId, vertical, cant, and chainageMappings"
		);
	}

	const alignmentId = normalizedAlignmentId(
		record.alignmentId,
		"record Alignment identity"
	);
	if (recordsByAlignmentId.has(alignmentId)) {
		fail(
			"DUPLICATE_ALIGNMENT_ID",
			`duplicate snapshot record Alignment identity: ${alignmentId}`
		);
	}

	if (
		record.vertical !== null &&
		!isVerticalConstructiveState(record.vertical)
	) {
		fail("INVALID_RECORD", `invalid vertical state for ${alignmentId}`);
	}
	if (record.vertical !== null && record.vertical.alignmentId !== alignmentId) {
		fail(
			"ALIGNMENT_ID_MISMATCH",
			`vertical state does not belong to ${alignmentId}`
		);
	}

	if (record.cant !== null && !isCantConstructiveState(record.cant)) {
		fail("INVALID_RECORD", `invalid cant state for ${alignmentId}`);
	}
	if (record.cant !== null && record.cant.alignmentId !== alignmentId) {
		fail(
			"ALIGNMENT_ID_MISMATCH",
			`cant state does not belong to ${alignmentId}`
		);
	}

	if (!Array.isArray(record.chainageMappings)) {
		fail(
			"INVALID_RECORD",
			`chainageMappings for ${alignmentId} must be an array`
		);
	}
	const mappingIds = new Set();
	for (const mapping of record.chainageMappings) {
		if (!isChainageMapping(mapping)) {
			fail("INVALID_RECORD", `invalid chainage mapping for ${alignmentId}`);
		}
		if (mapping.alignmentId !== alignmentId) {
			fail(
				"ALIGNMENT_ID_MISMATCH",
				`chainage mapping does not belong to ${alignmentId}`
			);
		}
		if (mappingIds.has(mapping.id)) {
			fail(
				"DUPLICATE_MAPPING_ID",
				`duplicate chainage mapping identity for ${alignmentId}: ${mapping.id}`
			);
		}
		mappingIds.add(mapping.id);
	}

	recordsByAlignmentId.set(
		alignmentId,
		Object.freeze({
			alignmentId,
			presence: "present",
			revision: Object.prototype.hasOwnProperty.call(record, "revision")
				? record.revision
				: null,
			vertical: record.vertical,
			cant: record.cant,
			chainageMappings: Object.freeze([...record.chainageMappings]),
		})
	);
}

export class StaticAlignmentProfileStateReaderAdapter {
	#recordsByAlignmentId;

	constructor({ records = [] } = {}) {
		if (!Array.isArray(records)) {
			fail("INVALID_RECORDS", "records must be an array");
		}
		this.#recordsByAlignmentId = new Map();
		for (const record of records) {
			installRecord(this.#recordsByAlignmentId, record);
		}
		assertAlignmentProfileStateReaderPort(this);
	}

	loadVerticalByAlignmentId(alignmentId) {
		const normalizedId = normalizedAlignmentId(alignmentId);
		return this.#recordsByAlignmentId.get(normalizedId)?.vertical ?? null;
	}

	loadCantByAlignmentId(alignmentId) {
		const normalizedId = normalizedAlignmentId(alignmentId);
		return this.#recordsByAlignmentId.get(normalizedId)?.cant ?? null;
	}

	loadChainageMappingsByAlignmentId(alignmentId) {
		const normalizedId = normalizedAlignmentId(alignmentId);
		return (
			this.#recordsByAlignmentId.get(normalizedId)?.chainageMappings ??
			EMPTY_MAPPINGS
		);
	}

	loadProfileSnapshotByAlignmentId(alignmentId) {
		const normalizedId = normalizedAlignmentId(alignmentId);
		return this.#recordsByAlignmentId.get(normalizedId) ?? ABSENT_SNAPSHOT;
	}
}

export default StaticAlignmentProfileStateReaderAdapter;
