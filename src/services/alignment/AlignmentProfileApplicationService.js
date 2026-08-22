import StaticAlignmentProfileStateReaderAdapter from "./StaticAlignmentProfileStateReaderAdapter.js";
import {
	AlignmentProfileEvaluationService,
} from "../../aim-core/alignment/profile/AlignmentProfileEvaluationService.js";
import {
	createSynchronizedAlignmentProfileProjection,
} from "./createSynchronizedAlignmentProfileProjection.js";

const {
	default: RepositoryAlignmentProfileStateReaderAdapter,
	assertAlignmentProfileStateReaderPort,
} = await import("./RepositoryAlignmentProfileStateReaderAdapter.js");

export const ALIGNMENT_PROFILE_APPLICATION_SERVICE_VERSION =
	"app-service/alignment-profile-evaluation/0.1";

export const ALIGNMENT_PROFILE_BATCH_RESULT_VERSION =
	"app-service/alignment-profile-evaluation-batch-result/0.1";

export class AlignmentProfileApplicationServiceError extends Error {
	constructor(code, message, { cause, index } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "AlignmentProfileApplicationServiceError";
		this.code = code;
		if (cause !== undefined) {
			this.cause = cause;
		}
		if (index !== undefined) {
			this.index = index;
		}
	}
}

function validateBatchRequest({ alignmentId, positions } = {}) {
	if (typeof alignmentId !== "string" || alignmentId.trim() === "") {
		throw new AlignmentProfileApplicationServiceError(
			"INVALID_BATCH_REQUEST",
			"alignmentId must be a non-empty string"
		);
	}
	if (!Array.isArray(positions)) {
		throw new AlignmentProfileApplicationServiceError(
			"INVALID_BATCH_REQUEST",
			"positions must be an array"
		);
	}
	if (positions.some((position) => !Number.isFinite(position))) {
		throw new AlignmentProfileApplicationServiceError(
			"INVALID_BATCH_REQUEST",
			"every position must be a finite number"
		);
	}
	return {
		alignmentId: alignmentId.trim(),
		positions: [...positions],
	};
}

export class AlignmentProfileApplicationService {
	#stateReader;
	#evaluationService;
	#alignmentRepository;

	constructor(options = {}) {
		const hasRecords = Object.prototype.hasOwnProperty.call(
			options,
			"records"
		);
		const hasRepository = Object.prototype.hasOwnProperty.call(
			options,
			"alignmentRepository"
		);
		const hasStateReader = Object.prototype.hasOwnProperty.call(
			options,
			"stateReader"
		);
		if (
			Number(hasRecords) +
				Number(hasRepository) +
				Number(hasStateReader) >
			1
		) {
			throw new AlignmentProfileApplicationServiceError(
				"INVALID_CONSTRUCTION",
				"records, alignmentRepository, and stateReader are mutually exclusive"
			);
		}

		if (hasRepository) {
			this.#alignmentRepository = options.alignmentRepository;
			this.#stateReader =
				new RepositoryAlignmentProfileStateReaderAdapter({
					alignmentRepository: options.alignmentRepository,
				});
		} else if (hasStateReader) {
			this.#stateReader =
				assertAlignmentProfileStateReaderPort(
					options.stateReader
				);
		} else {
			this.#stateReader =
				new StaticAlignmentProfileStateReaderAdapter({
					records: hasRecords ? options.records : [],
				});
		}
		this.#evaluationService = new AlignmentProfileEvaluationService({
			stateReader: this.#stateReader,
		});
	}

	async evaluateAt(request = {}) {
		return this.#evaluationService.evaluateAt(request);
	}

	async projectAt(request = {}) {
		const { alignmentId, s } = request;
		const snapshot = await this.#loadSnapshot(alignmentId);
		const snapshotReader =
			new StaticAlignmentProfileStateReaderAdapter({
				records:
					snapshot.presence === "present"
						? [
								{
									alignmentId:
										typeof alignmentId === "string"
											? alignmentId.trim()
											: alignmentId,
									revision: snapshot.revision,
									vertical: snapshot.vertical,
									cant: snapshot.cant,
									chainageMappings:
										snapshot.chainageMappings,
								},
							]
						: [],
			});
		const evaluation =
			await new AlignmentProfileEvaluationService({
				stateReader: snapshotReader,
			}).evaluateAt({ alignmentId, s });
		return createSynchronizedAlignmentProfileProjection({
			evaluation,
			profileSnapshot: snapshot,
		});
	}

	async saveProfileState(request = {}) {
		const { alignmentId, profileState } = request;
		if (!this.#alignmentRepository) {
			throw new AlignmentProfileApplicationServiceError(
				"PROFILE_WRITE_UNAVAILABLE",
				"saveProfileState requires alignmentRepository construction"
			);
		}
		if (typeof alignmentId !== "string" || alignmentId.trim() === "") {
			throw new AlignmentProfileApplicationServiceError(
				"INVALID_SAVE_REQUEST",
				"alignmentId must be a non-empty string"
			);
		}
		if (!Object.prototype.hasOwnProperty.call(request, "profileState")) {
			throw new AlignmentProfileApplicationServiceError(
				"INVALID_SAVE_REQUEST",
				"profileState must be explicit; use undefined to preserve absence"
			);
		}
		const normalizedAlignmentId = alignmentId.trim();
		let current;
		try {
			current =
				await this.#alignmentRepository.loadById(
					normalizedAlignmentId
				);
		} catch (cause) {
			throw new AlignmentProfileApplicationServiceError(
				"PROFILE_SAVE_READ_FAILED",
				`profile save read failed for ${normalizedAlignmentId}`,
				{ cause }
			);
		}
		if (
			!current ||
			typeof current !== "object" ||
			Array.isArray(current) ||
			current.id !== normalizedAlignmentId
		) {
			throw new AlignmentProfileApplicationServiceError(
				"INVALID_SAVE_TARGET",
				`repository returned no valid AlignmentData for ${normalizedAlignmentId}`
			);
		}

		if (profileState !== undefined) {
			try {
				new StaticAlignmentProfileStateReaderAdapter({
					records: [
						{
							alignmentId: normalizedAlignmentId,
							vertical: profileState?.vertical,
							cant: profileState?.cant,
							chainageMappings:
								profileState?.chainageMappings,
						},
					],
				});
			} catch (cause) {
				throw new AlignmentProfileApplicationServiceError(
					"INVALID_SAVE_REQUEST",
					`invalid profileState for ${normalizedAlignmentId}`,
					{ cause }
				);
			}
		}

		const next = { ...current };
		if (profileState === undefined) {
			delete next.profileState;
		} else {
			next.profileState = profileState;
		}

		try {
			await this.#alignmentRepository.saveById(
				normalizedAlignmentId,
				next
			);
		} catch (cause) {
			throw new AlignmentProfileApplicationServiceError(
				"PROFILE_SAVE_FAILED",
				`profile save failed for ${normalizedAlignmentId}`,
				{ cause }
			);
		}
		return this.#loadSnapshot(normalizedAlignmentId);
	}

	async evaluateMany(request = {}) {
		const validated = validateBatchRequest(request);
		const results = [];
		for (let index = 0; index < validated.positions.length; index += 1) {
			try {
				results.push(
					await this.#evaluationService.evaluateAt({
						alignmentId: validated.alignmentId,
						s: validated.positions[index],
					})
				);
			} catch (cause) {
				throw new AlignmentProfileApplicationServiceError(
					"BATCH_EVALUATION_FAILED",
					`profile evaluation failed at batch index ${index}`,
					{ cause, index }
				);
			}
		}
		return Object.freeze({
			contractVersion: ALIGNMENT_PROFILE_BATCH_RESULT_VERSION,
			status: "evaluated",
			alignmentId: validated.alignmentId,
			positions: Object.freeze(validated.positions),
			results: Object.freeze(results),
		});
	}

	async #loadSnapshot(alignmentId) {
		if (
			typeof this.#stateReader.loadProfileSnapshotByAlignmentId ===
			"function"
		) {
			return this.#stateReader.loadProfileSnapshotByAlignmentId(
				alignmentId
			);
		}
		const [vertical, cant, chainageMappings] = await Promise.all([
			this.#stateReader.loadVerticalByAlignmentId(alignmentId),
			this.#stateReader.loadCantByAlignmentId(alignmentId),
			this.#stateReader.loadChainageMappingsByAlignmentId(alignmentId),
		]);
		return Object.freeze({
			presence:
				vertical === null &&
				cant === null &&
				chainageMappings.length === 0
					? "absent"
					: "present",
			revision: null,
			vertical,
			cant,
			chainageMappings: Object.freeze([...chainageMappings]),
		});
	}
}

export default AlignmentProfileApplicationService;
