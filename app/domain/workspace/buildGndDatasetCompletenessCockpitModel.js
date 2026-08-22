import { buildGndRelationReviewModel } from "./buildGndRelationReviewModel.js";

const FAMILIES = Object.freeze(["PP", "EL", "EH", "EU", "EK"]);

export function buildGndDatasetCompletenessCockpitModel({ lifecycle = null, fileOutcomes = [], routeWorkspaces = [], records = [] } = {}) {
	const sources = buildSources(lifecycle, fileOutcomes);
	const recordMap = new Map(records.map((record) => [String(record?.evidenceId ?? ""), record]));
	const groups = routeWorkspaces.map((route) => buildGroup(route, recordMap));
	return Object.freeze({
		sourceCount: Number(lifecycle?.fileCount ?? sources.length),
		sources: Object.freeze(sources),
		status: datasetStatus(lifecycle, fileOutcomes),
		groups: Object.freeze(groups),
	});
}

function buildSources(lifecycle, outcomes) {
	const states = Array.isArray(lifecycle?.fileStates) ? lifecycle.fileStates : [];
	const names = Array.isArray(lifecycle?.fileNames) ? lifecycle.fileNames : [];
	const outcomeByName = new Map((outcomes ?? []).map((entry) => [String(entry?.fileName ?? ""), entry]));
	const rows = states.length ? states : names.map((fileName, sourceIndex) => ({ sourceIndex, fileName, state: outcomeByName.get(String(fileName))?.status ?? lifecycle?.state ?? "accepted" }));
	return rows.map((row, index) => Object.freeze({
		sourceIndex: Number.isInteger(row?.sourceIndex) ? row.sourceIndex : index,
		path: String(row?.fileName ?? ""),
		status: String(row?.state ?? outcomeByName.get(String(row?.fileName ?? ""))?.status ?? "unknown"),
	}));
}

function buildGroup(route, recordMap) {
	const records = route.evidenceIds.map((id) => recordMap.get(String(id))).filter(Boolean);
	const reviews = records.map(buildGndRelationReviewModel);
	const exactTargetIds = new Set(route.roles.flatMap((role) => role.targetItemIds ?? []).map(String));
	const boundAssociations = reviews.flatMap((review) => review.candidates
		.filter((candidate) => exactTargetIds.has(String(candidate.to ?? "")))
		.map((candidate) => Object.freeze({ evidenceId: review.evidenceId, candidateId: candidate.id, status: candidate.status })));
	const familyStatus = Object.fromEntries(FAMILIES.map((family) => [family, statusForFamily(family, route)]));
	const sourcePaths = [...new Set(records.map((record) => String(record?.source?.fileName ?? "")).filter(Boolean))];
	return Object.freeze({
		id: route.id,
		route: route.route,
		sourceFingerprint: route.sourceFingerprint,
		sourcePaths: Object.freeze(sourcePaths),
		status: route.status,
		families: Object.freeze(familyStatus),
		roles: route.roles,
		diagnostics: route.diagnostics,
		associationStatus: boundAssociations.some((entry) => entry.status === "reviewed") ? "reviewed" : boundAssociations.length ? "open-candidates" : "missing",
		associationActions: Object.freeze(boundAssociations),
		promotableItemIds: route.promotableItemIds,
		canonicalObjectIds: route.canonicalObjectIds,
	});
}

function statusForFamily(family, route) {
	if (family === "PP") return route.roles.some((role) => role.status === "present") ? "source-evidence" : "missing";
	const statuses = route.roles.map((role) => role.families?.[family]);
	if (statuses.includes("constructive")) return "constructive";
	if (statuses.includes("source-evidence")) return "source-evidence-only";
	return "missing";
}

function datasetStatus(lifecycle, outcomes) {
	if (["accepted", "processing"].includes(String(lifecycle?.state ?? ""))) return "processing";
	const statuses = (outcomes ?? []).map((entry) => String(entry?.status ?? ""));
	const failed = statuses.some((status) => ["failed", "unsupported", "rejected", "unknown"].includes(status));
	const usable = statuses.some((status) => !["failed", "unsupported", "rejected", "unknown"].includes(status));
	if (failed && usable) return "partial";
	if (failed) return "failed";
	return lifecycle?.state === "completed" ? "completed" : "ready";
}

export default buildGndDatasetCompletenessCockpitModel;
