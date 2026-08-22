// src/model/spot/ui/buildSpotUiState.js
//
// buildSpotUiState
//
// Transforms canonical SPOT state into a window-consumable UI shape.
//
// Rules:
// - SPOT remains canonical parameter storage
// - only canonical SpotObjects are rendered
// - no import candidates / no promotable counting / no file counting
// - no geometry computation here
// - no window-local focus or selection semantics
//
// Canonical SpotObject shape expected here:
// {
//   id,
//   type,
//   data: {
//     kernel
//   },
//   crsId,
//   meta
// }
//
// Output:
// {
//   rows: [...],
//   stats: {
//     total,
//     missingKernelCount,
//     missingCrsCount
//   }
// }

function getObjects(spotState) {
	return Object.values(spotState?.objects ?? {}).filter(isObject);
}

function getObjectId(object) {
	return object?.id ?? null;
}

function getObjectType(object) {
	return String(object?.type ?? "unknown");
}

function getObjectLabel(object) {
	return (
		object?.meta?.label ??
		object?.meta?.objectId ??
		object?.data?.name ??
		object?.id ??
		"object"
	);
}

function getKernel(object) {
	return isObject(object?.data?.kernel)
		? object.data.kernel
		: null;
}

function hasKernel(object) {
	return Boolean(getKernel(object));
}

function getCrsId(object) {
	return object?.crsId ?? null;
}

function hasCrs(object) {
	return Boolean(getCrsId(object));
}

function buildSourceLabel(object) {
	const source = object?.meta?.source ?? {};
	const fileName = source?.fileName ?? null;
	const objectName = source?.objectName ?? null;

	if (fileName && objectName) {
		return `${fileName} → ${objectName}`;
	}

	if (fileName) {
		return fileName;
	}

	if (objectName) {
		return objectName;
	}

	if (typeof source === "string" && source.trim()) {
		return source.trim();
	}

	return null;
}

function buildMissing(object) {
	const missing = [];

	if (!hasKernel(object)) {
		missing.push("kernel");
	}

	if (!hasCrs(object)) {
		missing.push("crsId");
	}

	return missing;
}

function buildNotes(object) {
	return buildMissing(object).map((key) => `${key}=missing`);
}

function readGeoreference(object) {
	return object?.data?.georeference ?? object?.data?.extended?.spatialRef ?? null;
}

function buildSpatialSummary(object) {
	const geo = readGeoreference(object);
	const mode = String(geo?.mode ?? geo?.resolutionState ?? object?.crsStatus ?? "").toLowerCase();
	if (mode.includes("geographic") || mode.includes("supported") || geo?.resolvedEpsg) {
		return { mode: "geographic", label: "Geographic reference resolved" };
	}
	return { mode: "local", label: "Local Cartesian" };
}

function collectEvidence(object) {
	const candidates = [
		object?.data?.extended?.unresolvedAttachments,
		object?.data?.extended?.extras?.unresolvedAttachments,
		object?.data?.meta?.unresolvedAttachments,
		object?.meta?.unresolvedAttachments,
	];
	return candidates.find(Array.isArray) ?? [];
}

function collectWarnings(object, evidence) {
	const warnings = [
		...(Array.isArray(object?.meta?.warnings) ? object.meta.warnings : []),
		...(Array.isArray(object?.data?.meta?.diagnostics) ? object.data.meta.diagnostics : []),
	];
	for (const item of evidence) {
		warnings.push(item?.message ?? `${item?.kind ?? "Attachment"} evidence ${item?.status ?? "unresolved"}`);
	}
	return warnings.map((value) => typeof value === "string" ? value : value?.decision ?? value?.message ?? value?.code).filter(Boolean);
}

function buildSourceKind(object) {
	const source = object?.meta?.source;
	if (source === "editor" || source?.kind === "editor") return "created";
	return source ? "imported" : "created";
}

function getUiStatus(object) {
	const kernel = hasKernel(object);
	const crs = hasCrs(object);

	if (kernel && crs) {
		return "ok";
	}

	if (!kernel || !crs) {
		return "incomplete";
	}

	return "unknown";
}

function buildRow(object) {
	const spotId = getObjectId(object);
	const crsId = getCrsId(object);
	const evidence = collectEvidence(object);
	const warnings = collectWarnings(object, evidence);
	const spatial = buildSpatialSummary(object);
	const routeContext = buildGndRouteContext(object);
	const navigatorContext = buildGndNavigatorContext(object);

	return {
		spotId,
		objectId: spotId,

		label: getObjectLabel(object),
		type: getObjectType(object),
		status: getUiStatus(object),

		sourceLabel: buildSourceLabel(object),
		sourceKind: buildSourceKind(object),
		spatialMode: spatial.mode,
		spatialLabel: spatial.label,
		lastChange: object?.meta?.modifiedAt ?? object?.meta?.createdAt ?? null,
		warnings,
		unresolvedEvidence: evidence.map((item) => ({
			kind: item?.kind ?? "attachment",
			status: item?.status ?? "unresolved",
			evidenceClass: item?.evidenceClass ?? null,
			message: item?.message ?? null,
			ambiguityReason: item?.ambiguityReason ?? item?.rejectionReason ?? null,
		})),
		gndRoute: routeContext,
		gndNavigator: navigatorContext,

		missing: buildMissing(object),
		notes: buildNotes(object),

		hasKernel: hasKernel(object),
		hasCrs: Boolean(crsId),

		crsId,
		details: {
			id: spotId,
			crsId,
			crsStatus: object?.crsStatus ?? null,
			source: object?.meta?.source ?? null,
			lifecycle: object?.meta?.lifecycle ?? null,
		},
	};
}

function buildGndRouteContext(object) {
	const snapshot = object?.meta?.sourceEvidence ?? object?.data?.sourceEvidence ?? null;
	const targetId = String(object?.meta?.importItemId ?? "").trim();
	const assignments = (snapshot?.sevenLineRoleEvidence?.assignments ?? []).filter((entry) => (entry?.targetItemIds ?? []).some((id) => String(id) === targetId));
	if (!assignments.length) return null;
	const routes = [...new Set(assignments.map((entry) => String(entry.route ?? "").trim()).filter(Boolean))];
	const roles = [...new Set(assignments.map((entry) => String(entry.directionCode ?? "").trim()).filter(Boolean))];
	const relation = snapshot?.relationEvidence ?? {};
	return { route: routes.length === 1 ? routes[0] : null, role: roles.length === 1 ? roles[0] : null, status: routes.length === 1 && roles.length === 1 ? "qualified" : "review-required", sourceAssociationStatus: relation.status ?? "missing", reviewRevision: Number(relation.reviewRevision ?? 0) };
}

function buildGndNavigatorContext(object) {
	const snapshot = object?.meta?.sourceEvidence ?? object?.data?.sourceEvidence ?? null;
	const targetId = String(object?.meta?.importItemId ?? "").trim();
	const assignments = (snapshot?.sevenLineRoleEvidence?.assignments ?? []).filter((entry) => (entry?.targetItemIds ?? []).some((id) => String(id) === targetId));
	if (!assignments.length) return null;
	const routes = [...new Set(assignments.map((entry) => String(entry.route ?? "").trim()).filter(Boolean))];
	const roles = [...new Set(assignments.map((entry) => String(entry.directionCode ?? "").trim()).filter(Boolean))];
	const relation = snapshot?.relationEvidence ?? {};
	const relationCandidates = (relation.candidates ?? []).filter((candidate) => String(candidate?.to ?? candidate?.toId ?? "").trim() === targetId);
	const reviewedCandidateId = relation.reviewedCandidateId ?? relation.confirmedCandidateId ?? null;
	const reviewed = relationCandidates.some((candidate) => String(candidate?.id ?? "") === String(reviewedCandidateId ?? ""));
	const sourceAssociationStatus = reviewed ? "reviewed" : relationCandidates.length ? "open-candidates" : "missing";
	const route = routes.length === 1 ? routes[0] : null;
	const role = roles.length === 1 ? roles[0] : null;
	const sourceFingerprint = String(snapshot?.source?.sha256 ?? snapshot?.source?.fingerprint ?? "").trim() || null;
	const routeAssignments = route ? (snapshot?.sevenLineRoleEvidence?.assignments ?? []).filter((entry) => String(entry?.route ?? "").trim() === route) : [];
	const directionCodes = new Set(routeAssignments.map((entry) => String(entry?.directionCode ?? "").trim()));
	const diagnostics = [...new Set([
		...(directionCodes.has("1") && directionCodes.has("2") && !directionCodes.has("3") ? ["KM_LINE_REQUIRED"] : []),
	])];
	return {
		route,
		role,
		status: route && role ? "qualified" : "review-required",
		sourceFingerprint,
		sourceAssociationStatus,
		reviewRevision: sourceAssociationStatus === "reviewed" ? Number(relation.reviewRevision ?? 0) : 0,
		sevenLine: buildSevenLineSummary(routeAssignments, relation, targetId),
		diagnostics,
	};
}

function buildSevenLineSummary(assignments, relation, targetId) {
	const definitions = [["EH", "1"], ["EH", "2"], ["EU", "2"], ["EL", "2"], ["EK", "3"], ["EL", "1"], ["EU", "1"]];
	const codes = new Set(assignments.map((entry) => String(entry?.directionCode ?? "")));
	const singleTrack = codes.has("0") && !codes.has("1") && !codes.has("2");
	const states = definitions.map(([family, role], index) => {
		if (singleTrack && [1, 2, 3].includes(index)) return "not-applicable";
		const effectiveRole = singleTrack && [0, 5, 6].includes(index) ? "0" : role;
		const present = assignments.some((entry) => String(entry?.family ?? "").toUpperCase() === family && String(entry?.directionCode ?? "") === effectiveRole);
		if (!present) return "missing";
		if (family === "EL") return "constructive";
		if (family === "EH" || family === "EU") return hasExactReviewedSourceAssociation({ relation, targetId, family, assignments: assignments.filter((entry) => String(entry?.family ?? "").toUpperCase() === family && String(entry?.directionCode ?? "") === effectiveRole) }) ? "partial" : "review-required";
		return "partial";
	});
	return Object.freeze({ total: 7, constructive: states.filter((value) => value === "constructive").length, partial: states.filter((value) => value === "partial").length, reviewRequired: states.filter((value) => value === "review-required").length, missing: states.filter((value) => value === "missing").length, notApplicable: states.filter((value) => value === "not-applicable").length });
}

function hasExactReviewedSourceAssociation({ relation, targetId, family, assignments }) {
	const reviewedCandidateId = relation?.reviewedCandidateId ?? relation?.confirmedCandidateId ?? null;
	if (!reviewedCandidateId || !targetId) return false;
	const candidate = (relation?.candidates ?? []).find((entry) => String(entry?.id ?? "") === String(reviewedCandidateId) && String(entry?.to ?? entry?.toId ?? "").trim() === targetId);
	if (!candidate || candidate.claimScope !== "source-association-only") return false;
	const source = candidate?.provenance?.source ?? candidate?.source ?? {};
	if (String(source?.family ?? "").toUpperCase() !== family) return false;
	const attachmentSourceIds = (source?.attachment ?? candidate?.attachment ?? []).map((entry) => String(entry?.sourceId ?? entry ?? "").trim()).filter(Boolean);
	if (!attachmentSourceIds.length) return false;
	const assignmentSourceIds = new Set(assignments.flatMap((entry) => entry?.sourceIds ?? []).map((id) => String(id).trim()).filter(Boolean));
	return attachmentSourceIds.every((id) => assignmentSourceIds.has(id));
}

function buildStats(rows) {
	return {
		total: rows.length,
		missingKernelCount: rows.filter((row) => !row.hasKernel).length,
		missingCrsCount: rows.filter((row) => !row.hasCrs).length,
	};
}

export function buildSpotUiState(spotState = {}) {
	const objects = getObjects(spotState);
	const rows = objects.map(buildRow);

	rows.sort((a, b) => {
		return String(a.label).localeCompare(String(b.label));
	});

	return {
		rows,
		stats: buildStats(rows),
	};
}

function isObject(value) {
	return !!value &&
		typeof value === "object" &&
		!Array.isArray(value);
}
