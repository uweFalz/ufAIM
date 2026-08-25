import {
	assertAlignmentRepositoryPort,
} from "../../aim-core/alignment/authoring/AlignmentRepositoryPort.js";
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
	isRailPairCantConstructiveState,
} from "../../aim-core/alignment/profile/RailPairCantConstructiveState.js";
import {
	isChainageMapping,
} from "../../aim-core/alignment/profile/ChainageMapping.js";

export const REPOSITORY_ALIGNMENT_PROFILE_STATE_READER_ADAPTER_VERSION =
	"app-adapter/repository-alignment-profile-state-reader/0.1";

const EMPTY_MAPPINGS = Object.freeze([]);
const ABSENT_SNAPSHOT = Object.freeze({
	presence: "absent",
	revision: null,
	vertical: null,
	cant: null,
	chainageMappings: EMPTY_MAPPINGS,
});

export class RepositoryAlignmentProfileStateReaderAdapterError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "RepositoryAlignmentProfileStateReaderAdapterError";
		this.code = code;
		if (cause !== undefined) {
			this.cause = cause;
		}
	}
}

function fail(code, message, options) {
	throw new RepositoryAlignmentProfileStateReaderAdapterError(
		code,
		message,
		options
	);
}

function normalizedAlignmentId(value) {
	if (typeof value !== "string" || value.trim() === "") {
		fail(
			"INVALID_ALIGNMENT_ID",
			"Alignment identity must be a non-empty string"
		);
	}
	return value.trim();
}

function hasOwn(record, member) {
	return Object.prototype.hasOwnProperty.call(record, member);
}

function validateProfileState(alignmentData, alignmentId) {
	if (
		alignmentData === null ||
		typeof alignmentData !== "object" ||
		Array.isArray(alignmentData) ||
		alignmentData.id !== alignmentId
	) {
		fail(
			"INVALID_PORT_RESULT",
			`repository returned invalid AlignmentData for ${alignmentId}`
		);
	}

	if (!hasOwn(alignmentData, "profileState")) {
		return Object.freeze({
			...ABSENT_SNAPSHOT,
			revision: hasOwn(alignmentData, "revision")
				? alignmentData.revision
				: null,
		});
	}

	const profileState = alignmentData.profileState;
	if (
		profileState === null ||
		typeof profileState !== "object" ||
		Array.isArray(profileState) ||
		!hasOwn(profileState, "vertical") ||
		!hasOwn(profileState, "cant") ||
		!hasOwn(profileState, "chainageMappings")
	) {
		fail(
			"INVALID_PROFILE_STATE",
			`invalid profileState record for ${alignmentId}`
		);
	}

	if (
		profileState.vertical !== null &&
		!isVerticalConstructiveState(profileState.vertical)
	) {
		fail(
			"INVALID_PROFILE_STATE",
			`invalid vertical profile state for ${alignmentId}`
		);
	}
	if (
		profileState.vertical !== null &&
		profileState.vertical.alignmentId !== alignmentId
	) {
		fail(
			"ALIGNMENT_ID_MISMATCH",
			`vertical state does not belong to ${alignmentId}`
		);
	}

	if (
		profileState.cant !== null &&
		!isCantConstructiveState(profileState.cant) &&
		!isRailPairCantConstructiveState(profileState.cant)
	) {
		fail(
			"INVALID_PROFILE_STATE",
			`invalid cant profile state for ${alignmentId}`
		);
	}
	if (
		profileState.cant !== null &&
		profileState.cant.alignmentId !== alignmentId
	) {
		fail(
			"ALIGNMENT_ID_MISMATCH",
			`cant state does not belong to ${alignmentId}`
		);
	}

	if (!Array.isArray(profileState.chainageMappings)) {
		fail(
			"INVALID_PROFILE_STATE",
			`chainageMappings for ${alignmentId} must be an array`
		);
	}
	const mappingIds = new Set();
	for (const mapping of profileState.chainageMappings) {
		if (!isChainageMapping(mapping)) {
			fail(
				"INVALID_PROFILE_STATE",
				`invalid chainage mapping for ${alignmentId}`
			);
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

	return Object.freeze({
		presence: "present",
		revision: hasOwn(alignmentData, "revision")
			? alignmentData.revision
			: null,
		vertical: profileState.vertical,
		cant: profileState.cant,
		chainageMappings: Object.freeze([
			...profileState.chainageMappings,
		]),
	});
}

export class RepositoryAlignmentProfileStateReaderAdapter {
	#alignmentRepository;

	constructor({ alignmentRepository } = {}) {
		this.#alignmentRepository =
			assertAlignmentRepositoryPort(alignmentRepository);
		assertAlignmentProfileStateReaderPort(this);
	}

	async #loadProfileState(alignmentId) {
		const normalizedId = normalizedAlignmentId(alignmentId);
		let alignmentData;
		try {
			alignmentData =
				await this.#alignmentRepository.loadById(normalizedId);
		} catch (cause) {
			fail(
				"REPOSITORY_READ_FAILED",
				`repository read failed for ${normalizedId}`,
				{ cause }
			);
		}
		if (alignmentData === null) {
			return ABSENT_SNAPSHOT;
		}
		return validateProfileState(alignmentData, normalizedId);
	}

	async loadProfileSnapshotByAlignmentId(alignmentId) {
		return this.#loadProfileState(alignmentId);
	}

	async loadVerticalByAlignmentId(alignmentId) {
		return (await this.#loadProfileState(alignmentId)).vertical;
	}

	async loadCantByAlignmentId(alignmentId) {
		return (await this.#loadProfileState(alignmentId)).cant;
	}

	async loadChainageMappingsByAlignmentId(alignmentId) {
		return (await this.#loadProfileState(alignmentId)).chainageMappings;
	}
}

export { assertAlignmentProfileStateReaderPort };

export default RepositoryAlignmentProfileStateReaderAdapter;
