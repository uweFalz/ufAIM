export const SYNCHRONIZED_ALIGNMENT_PROFILE_PROJECTION_VERSION =
	"app-service/synchronized-alignment-profile-projection/0.1";

const WORKING_REFERENCE = "midpointGoverningRailEdges";

function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneAndFreeze(value) {
	if (Array.isArray(value)) {
		return Object.freeze(value.map(cloneAndFreeze));
	}
	if (!isObject(value)) return value;
	return Object.freeze(
		Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [
				key,
				cloneAndFreeze(entry),
			])
		)
	);
}

function cantReferenceProjection(cantState) {
	if (cantState === null) {
		return Object.freeze({ status: "absent" });
	}

	const pairedRails = isObject(cantState.pairedRails)
		? cloneAndFreeze(cantState.pairedRails)
		: Object.freeze({
				status: "unknown",
				reason: "PAIRED_RAIL_STATE_NOT_AVAILABLE",
			});
	const sourceReference = isObject(cantState.sourceReference)
		? cloneAndFreeze(cantState.sourceReference)
		: Object.freeze({
				status: "unknown",
				reason: "SOURCE_REFERENCE_NOT_AVAILABLE",
			});
	const transformation = isObject(cantState.referenceTransformation)
		? cloneAndFreeze(cantState.referenceTransformation)
		: Object.freeze({
				status: "not-performed",
				reason: "COMPLETE_SOURCE_CONVENTION_NOT_AVAILABLE",
			});

	return Object.freeze({
		status:
			pairedRails.status === "known" &&
			sourceReference.status === "known" &&
			transformation.status === "known" &&
			transformation.targetConvention === WORKING_REFERENCE &&
			transformation.reversible === true
				? "known"
				: "partial",
		workingReference: WORKING_REFERENCE,
		scalarCrossLevelStatus: "partial-evidence",
		pairedRails,
		sourceReference,
		transformation,
	});
}

export function createSynchronizedAlignmentProfileProjection({
	evaluation,
	profileSnapshot,
} = {}) {
	if (
		!isObject(evaluation) ||
		evaluation.status !== "evaluated" ||
		typeof evaluation.alignmentId !== "string" ||
		!Number.isFinite(evaluation.s) ||
		!isObject(profileSnapshot) ||
		!["present", "absent"].includes(profileSnapshot.presence)
	) {
		throw new TypeError(
			"createSynchronizedAlignmentProfileProjection requires an evaluated result and profile snapshot"
		);
	}

	const state = Object.freeze({
		presence: profileSnapshot.presence,
		vertical: cloneAndFreeze(profileSnapshot.vertical),
		cant: cloneAndFreeze(profileSnapshot.cant),
		chainageMappings: cloneAndFreeze(
			profileSnapshot.chainageMappings ?? []
		),
	});

	return Object.freeze({
		contractVersion:
			SYNCHRONIZED_ALIGNMENT_PROFILE_PROJECTION_VERSION,
		status: "projected",
		alignmentId: evaluation.alignmentId,
		cursor: Object.freeze({
			parameterKind: "intrinsic-s",
			s: evaluation.s,
		}),
		revision: cloneAndFreeze(profileSnapshot.revision ?? null),
		profileStatePresence: profileSnapshot.presence,
		vertical: cloneAndFreeze(evaluation.vertical),
		cant: Object.freeze({
			...cloneAndFreeze(evaluation.cant),
			reference: cantReferenceProjection(profileSnapshot.cant),
		}),
		chainage: cloneAndFreeze(evaluation.chainage),
		state,
	});
}
