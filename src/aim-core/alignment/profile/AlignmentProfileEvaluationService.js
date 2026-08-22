import { assertAlignmentProfileStateReaderPort } from "./AlignmentProfileStateReaderPort.js";
import {
	evaluateVerticalAt,
	isVerticalConstructiveState,
} from "./VerticalConstructiveState.js";
import {
	evaluateCantAt,
	isCantConstructiveState,
} from "./CantConstructiveState.js";
import {
	isChainageMapping,
	mapIntrinsicToChainage,
} from "./ChainageMapping.js";

export const ALIGNMENT_PROFILE_EVALUATION_RESULT_VERSION =
	"aim-core/alignment-profile-evaluation-result/0.1";

export class AlignmentProfileEvaluationServiceError extends Error {
	constructor(code, message, options = {}) {
		super(message, options);
		this.name = "AlignmentProfileEvaluationServiceError";
		this.code = code;
		if (options.cause !== undefined && this.cause === undefined) {
			this.cause = options.cause;
		}
	}
}

function fail(code, message, cause) {
	throw new AlignmentProfileEvaluationServiceError(
		code,
		message,
		cause === undefined ? {} : { cause }
	);
}

function freezeRecord(value) {
	for (const entry of Object.values(value)) {
		if (Array.isArray(entry)) {
			for (const item of entry) {
				if (item && typeof item === "object") freezeRecord(item);
			}
			Object.freeze(entry);
		} else if (entry && typeof entry === "object") {
			freezeRecord(entry);
		}
	}
	return Object.freeze(value);
}

function evaluateComponent({
	state,
	absentStatus,
	evaluate,
	notCoveredCodes,
	label,
}) {
	if (state === null) return Object.freeze({ status: absentStatus });
	try {
		const value = evaluate(state);
		return freezeRecord({
			status: "evaluated",
			value: { ...value },
		});
	} catch (cause) {
		if (notCoveredCodes.includes(cause?.code)) {
			return Object.freeze({
				status: "not-covered",
				code: cause.code,
			});
		}
		fail(
			"COMPONENT_EVALUATION_FAILED",
			`${label} evaluation failed`,
			cause
		);
	}
}

export class AlignmentProfileEvaluationService {
	constructor({ stateReader } = {}) {
		this.stateReader = assertAlignmentProfileStateReaderPort(stateReader);
	}

	async evaluateAt({ alignmentId, s } = {}) {
		if (
			typeof alignmentId !== "string" ||
			!alignmentId.trim() ||
			typeof s !== "number" ||
			!Number.isFinite(s)
		) {
			fail(
				"INVALID_REQUEST",
				"alignmentId must be non-empty and s must be finite"
			);
		}
		const normalizedAlignmentId = alignmentId.trim();

		let vertical;
		let cant;
		let chainageMappings;
		try {
			[vertical, cant, chainageMappings] = await Promise.all([
				this.stateReader.loadVerticalByAlignmentId(
					normalizedAlignmentId
				),
				this.stateReader.loadCantByAlignmentId(
					normalizedAlignmentId
				),
				this.stateReader.loadChainageMappingsByAlignmentId(
					normalizedAlignmentId
				),
			]);
		} catch (cause) {
			fail("PORT_READ_FAILED", "profile state read failed", cause);
		}

		if (
			(vertical !== null &&
				!isVerticalConstructiveState(vertical)) ||
			(cant !== null && !isCantConstructiveState(cant)) ||
			!Array.isArray(chainageMappings) ||
			!chainageMappings.every(isChainageMapping)
		) {
			fail(
				"INVALID_PORT_RESULT",
				"profile state reader returned an invalid value"
			);
		}

		for (const state of [vertical, cant]) {
			if (state !== null && state.alignmentId !== normalizedAlignmentId) {
				fail(
					"ALIGNMENT_ID_MISMATCH",
					"profile state belongs to another Alignment"
				);
			}
		}
		const mappingIds = new Set();
		for (const mapping of chainageMappings) {
			if (mapping.alignmentId !== normalizedAlignmentId) {
				fail(
					"ALIGNMENT_ID_MISMATCH",
					"chainage mapping belongs to another Alignment"
				);
			}
			if (mappingIds.has(mapping.id)) {
				fail(
					"DUPLICATE_MAPPING_ID",
					`duplicate chainage mapping ${mapping.id}`
				);
			}
			mappingIds.add(mapping.id);
		}

		const verticalResult = evaluateComponent({
			state: vertical,
			absentStatus: "absent",
			evaluate: (value) => evaluateVerticalAt(value, { s }),
			notCoveredCodes: [
				"EMPTY_PROFILE",
				"POSITION_OUTSIDE_DOMAIN",
			],
			label: "vertical",
		});
		const cantResult = evaluateComponent({
			state: cant,
			absentStatus: "absent",
			evaluate: (value) => evaluateCantAt(value, { s }),
			notCoveredCodes: ["EMPTY_CANT", "POSITION_OUTSIDE_DOMAIN"],
			label: "cant",
		});

		const chainageResult =
			chainageMappings.length === 0
				? freezeRecord({ status: "absent", mappings: [] })
				: freezeRecord({
						status: "evaluated",
						mappings: chainageMappings.map((mapping) => ({
							mappingId: mapping.id,
							schemeId: mapping.schemeId,
							schemeVersion: mapping.schemeVersion,
							candidates: mapIntrinsicToChainage(mapping, {
								s,
							}).map((candidate) => ({ ...candidate })),
						})),
					});

		return freezeRecord({
			contractVersion:
				ALIGNMENT_PROFILE_EVALUATION_RESULT_VERSION,
			status: "evaluated",
			alignmentId: normalizedAlignmentId,
			s,
			vertical: verticalResult,
			cant: cantResult,
			chainage: chainageResult,
		});
	}
}
