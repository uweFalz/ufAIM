import { AlignmentAxtranEvidenceService } from "./AlignmentAxtranEvidenceService.js";
import {
	POINT_OBSERVATION_RECORD_VERSION,
	copyObservationData,
	createPointObservationRequest,
	matchesPointObservationSnapshot,
	validatePointObservationRecord,
} from "./AlignmentPointObservationRecord.js";

/**
 * Headless, alignment-scoped source-evidence workflow.
 * Use the one SpotService that owns the project's durable snapshot. No direct
 * IndexedDB writer, CRS transformation, candidate application or UI registration.
 */
export function createAlignmentPointObservationService({ spotService } = {}) {
	if (typeof spotService?.hydrate !== "function" || typeof spotService?.getState !== "function"
		|| typeof spotService?.storePointObservationEvidence !== "function") {
		throw new Error("Point observation: a durable SpotService boundary is required");
	}
	const evaluator = new AlignmentAxtranEvidenceService();

	async function run(input = {}) {
		// Copy before the first await so mutation by the caller cannot change a run.
		const draft = copyObservationData(input);
		if (!draft || typeof draft !== "object" || Array.isArray(draft)) throw new Error("Point observation: invalid run request");
		for (const key of Object.keys(draft)) {
			if (!["runId", "objectId", "afterAlignmentData", "pointObservationInput", "options"].includes(key)) {
				throw new Error(`Point observation: unsupported run field ${key}`);
			}
		}
		await spotService.hydrate();
		const object = spotService.getState()?.objects?.[draft.objectId];
		const request = createPointObservationRequest({ ...draft, object });
		const result = evaluator.evaluateChange({
			beforeAlignmentData: copyObservationData(request.beforeAlignmentData),
			afterAlignmentData: copyObservationData(request.afterAlignmentData),
			pointObservationInput: copyObservationData(request.pointObservationInput),
			...copyObservationData(request.options),
		});
		const entry = validatePointObservationRecord({ version: POINT_OBSERVATION_RECORD_VERSION, request, result });
		// SpotService compares the captured state inside its mutation queue, then
		// saves atomically relative to its own other operations, or rolls back.
		await spotService.storePointObservationEvidence({ objectId: request.objectId, entry });
		return copyObservationData(entry);
	}

	async function read({ objectId, runId } = {}) {
		await spotService.hydrate();
		const object = spotService.getState()?.objects?.[objectId];
		const entries = object?.data?.extended?.pointObservationEvidence;
		if (entries === undefined) return null;
		if (!Array.isArray(entries)) throw new Error("Point observation: invalid existing archive");
		const matching = entries.filter((entry) => entry?.request?.id === runId);
		if (matching.length === 0) return null;
		if (matching.length !== 1) throw new Error("Point observation: duplicate archived run identity");
		const entry = validatePointObservationRecord(matching[0]);
		if (entry.request.objectId !== objectId) throw new Error("Point observation: cross-object archive");
		return { entry, current: matchesPointObservationSnapshot(object, entry.request) };
	}

	return Object.freeze({ run, read });
}
