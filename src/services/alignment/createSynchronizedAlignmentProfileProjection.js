export const SYNCHRONIZED_ALIGNMENT_PROFILE_PROJECTION_VERSION =
	"app-service/synchronized-alignment-profile-projection/0.3";

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
	if (cantState.type === "RailPairCantConstructiveState") {
		return Object.freeze({
			status: "known",
			workingReference: cantState.anchorRule.kind,
			scalarCrossLevelStatus: "derived",
			pairedRails: cloneAndFreeze({
				status: "known",
				leftRailId: cantState.railPair.leftRailId,
				rightRailId: cantState.railPair.rightRailId,
				separation: cantState.railPair.separation,
			}),
			sourceReference: cloneAndFreeze(cantState.anchorRule),
			transformation: Object.freeze({
				status: "not-required",
				reason: "PAIRED_RAIL_CONSTRUCTION_IS_AUTHORITATIVE",
			}),
		});
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

function measureValue(value) {
	if (isObject(value) && Number.isFinite(Number(value.value))) return Number(value.value);
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : null;
}

function sourceOrigin(attachments) {
	return measureValue(attachments?.alignmentStation?.start);
}

function sourceVerticalRecords(attachments) {
	const origin = sourceOrigin(attachments);
	if (!Number.isFinite(origin)) return [];
	const profile = attachments?.profile?.profAlign;
	const records = [];
	for (const [kind, entries] of [
		["PVI", profile?.pvis],
		["ParaCurve", profile?.paraCurves],
	]) {
		for (const [index, entry] of (Array.isArray(entries) ? entries : []).entries()) {
			const sourceStation = measureValue(entry?.station);
			const elevation = measureValue(entry?.elevation);
			if (!Number.isFinite(sourceStation) || !Number.isFinite(elevation)) continue;
			records.push({
				id: `source-vertical-${kind.toLowerCase()}-${index + 1}`,
				type: kind,
				s: sourceStation - origin,
				sourceStation,
				elevation,
				...(kind === "ParaCurve" ? { length: measureValue(entry?.length) } : {}),
				declaredStationUnit: attachments?.units?.linearUnit ?? null,
				declaredElevationUnit: attachments?.units?.elevationUnit ?? null,
			});
		}
	}
	return records.filter((entry) => Number.isFinite(entry.s)).sort((left, right) => left.s - right.s || left.id.localeCompare(right.id));
}

function sourceCantRecords(attachments) {
	const origin = sourceOrigin(attachments);
	if (!Number.isFinite(origin)) return [];
	const records = [];
	for (const [index, entry] of (Array.isArray(attachments?.cant) ? attachments.cant : []).entries()) {
		if (entry?.type !== "CantStation") continue;
		const sourceStation = measureValue(entry?.station);
		const appliedCant = measureValue(entry?.appliedCant);
		if (!Number.isFinite(sourceStation) || !Number.isFinite(appliedCant)) continue;
		records.push({
			id: `source-cant-station-${index + 1}`,
			type: "CantStation",
			s: sourceStation - origin,
			sourceStation,
			appliedCant,
			crossLevel: appliedCant,
			transitionType: entry?.transitionType ?? null,
			curvature: entry?.curvature ?? null,
			declaredStationUnit: entry?.station?.unit ?? attachments?.units?.linearUnit ?? null,
			declaredCantUnit: entry?.appliedCant?.unit ?? attachments?.units?.elevationUnit ?? null,
		});
	}
	return records.filter((entry) => Number.isFinite(entry.s)).sort((left, right) => left.s - right.s || left.id.localeCompare(right.id));
}

function sourceSpeedRecords(attachments) {
	const origin = sourceOrigin(attachments);
	if (!Number.isFinite(origin)) return [];
	const records = [];
	for (const [index, entry] of (Array.isArray(attachments?.cant) ? attachments.cant : []).entries()) {
		if (!["CantStation", "SpeedStation"].includes(entry?.type)) continue;
		const sourceStation = measureValue(entry?.station);
		const speed = measureValue(entry?.speed);
		if (!Number.isFinite(sourceStation) || !Number.isFinite(speed)) continue;
		records.push({
			id: `source-speed-${entry.type === "SpeedStation" ? "station" : "cant-station"}-${index + 1}`,
			type: entry.type,
			s: sourceStation - origin,
			sourceStation,
			speed,
			declaredStationUnit: entry?.station?.unit ?? attachments?.units?.linearUnit ?? null,
			declaredSpeedUnit: entry?.speed?.unit ?? null,
		});
	}
	return records.filter((entry) => Number.isFinite(entry.s)).sort((left, right) => left.s - right.s || left.id.localeCompare(right.id));
}

function sourceEvidenceValue(records, s) {
	const exact = records.filter((entry) => Object.is(entry.s, s));
	const before = [...records].reverse().find((entry) => entry.s < s) ?? null;
	const after = records.find((entry) => entry.s > s) ?? null;
	return {
		status: exact.length > 0 ? "exact-source-record" : before || after ? "bracketed-source-evidence" : "not-covered",
		s,
		exact,
		before,
		after,
	};
}

function sourceEvidenceDomain(records) {
	if (records.length === 0) return null;
	return {
		parameterKind: "intrinsic-s",
		startS: records[0].s,
		endS: records.at(-1).s,
	};
}

function sourceVerticalProjection(attachments, s) {
	const records = sourceVerticalRecords(attachments);
	if (records.length === 0) return null;
	return Object.freeze({
		status: "source-evidence",
		representation: "source-declared-profile-records",
		admission: "evidence-only",
		admissible: false,
		reason: attachments?.admission?.vertical?.reason ?? "SOURCE_PROFILE_NOT_ADMITTED_AS_CONSTRUCTIVE_STATE",
		domain: cloneAndFreeze(sourceEvidenceDomain(records)),
		sourceRecords: cloneAndFreeze(records),
		value: cloneAndFreeze(sourceEvidenceValue(records, s)),
		provenance: cloneAndFreeze({ association: attachments?.association, source: attachments?.source }),
	});
}

function sourceCantProjection(attachments, s) {
	const records = sourceCantRecords(attachments);
	if (records.length === 0) return null;
	return Object.freeze({
		status: "source-evidence",
		representation: "source-declared-scalar-cant",
		admission: "evidence-only",
		admissible: false,
		reason: attachments?.admission?.cant?.reason ?? "PAIRED_RAIL_CONSTRUCTION_NOT_AVAILABLE",
		domain: cloneAndFreeze(sourceEvidenceDomain(records)),
		sourceRecords: cloneAndFreeze(records),
		value: cloneAndFreeze(sourceEvidenceValue(records, s)),
		reference: Object.freeze({
			status: "partial",
			workingReference: WORKING_REFERENCE,
			scalarCrossLevelStatus: "partial-evidence",
			pairedRails: Object.freeze({ status: "unknown", reason: "PAIRED_RAIL_STATE_NOT_AVAILABLE" }),
			sourceReference: Object.freeze({ status: "unknown", reason: "SOURCE_REFERENCE_NOT_AVAILABLE" }),
			transformation: Object.freeze({ status: "not-performed", reason: "COMPLETE_SOURCE_CONVENTION_NOT_AVAILABLE" }),
		}),
		provenance: cloneAndFreeze({ association: attachments?.association, source: attachments?.source }),
	});
}

function sourceSpeedProjection(attachments, s) {
	const records = sourceSpeedRecords(attachments);
	if (records.length === 0) return null;
	return Object.freeze({
		status: "source-evidence",
		representation: "source-declared-speed-records",
		admission: "evidence-only",
		admissible: false,
		reason: attachments?.admission?.speed?.reason ?? "SOURCE_SPEED_NOT_ADMITTED_AS_CONSTRUCTIVE_STATE",
		domain: cloneAndFreeze(sourceEvidenceDomain(records)),
		sourceRecords: cloneAndFreeze(records),
		value: cloneAndFreeze(sourceEvidenceValue(records, s)),
		provenance: cloneAndFreeze({ association: attachments?.association, source: attachments?.source }),
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
		...(isObject(profileSnapshot.sourceAttachments)
			? { sourceAttachments: cloneAndFreeze(profileSnapshot.sourceAttachments) }
			: {}),
	});
	const railPairCant = profileSnapshot.cant?.type === "RailPairCantConstructiveState";
	const evaluatedRailPair = railPairCant && evaluation.cant?.status === "evaluated"
		? evaluation.cant.value
		: null;
	const constructiveCantProjection = railPairCant
		? Object.freeze({
			...cloneAndFreeze(evaluation.cant),
			representation: "rail-pair",
			left: evaluatedRailPair === null ? null : Object.freeze({
				railId: profileSnapshot.cant.railPair.leftRailId,
				...cloneAndFreeze(evaluatedRailPair.left),
			}),
			right: evaluatedRailPair === null ? null : Object.freeze({
				railId: profileSnapshot.cant.railPair.rightRailId,
				...cloneAndFreeze(evaluatedRailPair.right),
			}),
			crossLevel: evaluatedRailPair?.crossLevel ?? null,
			commonOffset: evaluatedRailPair?.commonOffset ?? null,
			reference: cantReferenceProjection(profileSnapshot.cant),
		})
		: Object.freeze({
			...cloneAndFreeze(evaluation.cant),
			...(profileSnapshot.cant === null ? {} : { representation: "legacy-scalar" }),
			reference: cantReferenceProjection(profileSnapshot.cant),
		});
	const verticalProjection = profileSnapshot.vertical === null
		? sourceVerticalProjection(profileSnapshot.sourceAttachments, evaluation.s) ?? cloneAndFreeze(evaluation.vertical)
		: cloneAndFreeze(evaluation.vertical);
	const cantProjection = profileSnapshot.cant === null
		? sourceCantProjection(profileSnapshot.sourceAttachments, evaluation.s) ?? constructiveCantProjection
		: constructiveCantProjection;
	const speedProjection = sourceSpeedProjection(profileSnapshot.sourceAttachments, evaluation.s)
		?? Object.freeze({ status: "absent", reason: "SOURCE_SPEED_EVIDENCE_NOT_AVAILABLE" });

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
		vertical: verticalProjection,
		cant: cantProjection,
		speed: speedProjection,
		chainage: cloneAndFreeze(evaluation.chainage),
		state,
	});
}
