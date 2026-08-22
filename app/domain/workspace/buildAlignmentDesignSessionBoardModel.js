const DISCIPLINES = Object.freeze([
	["horizontal", "Horizontal", "openHorizontal"],
	["vertical", "Vertical / Gradiente", "openVertical"],
	["cant", "Cant / Cross-level", "openCant"],
	["chainage", "Chainage", "openChainage"],
	["source", "Source / Review", "openReview"],
]);

export function buildAlignmentDesignSessionBoardModel({ intelligence = null, horizontalSource = null, profileProjection = null, selection = null, latestReceipt = null } = {}) {
	const objectId = clean(intelligence?.context?.objectId);
	const s = finite(intelligence?.context?.s);
	if (!objectId) return Object.freeze({ status: "absent", context: Object.freeze({ objectId: null, revision: null, s: null }), areas: Object.freeze([]) });
	const horizontalExact = clean(horizontalSource?.objectId) === objectId;
	const profileExact = clean(profileProjection?.alignmentId) === objectId;
	const selectionExact = clean(selection?.primaryId) === objectId;
	const capabilities = intelligence?.capabilities ?? {};
	const areas = DISCIPLINES.map(([id, label, action]) => {
		const capability = id === "source" ? sourceCapability(intelligence?.context, capabilities) : capabilities[id] ?? {};
		const count = id === "horizontal"
			? horizontalExact ? nonnegativeInteger(horizontalSource?.segmentCount) : null
			: ["vertical", "cant", "chainage"].includes(id) && profileExact ? nonnegativeInteger(profileProjection?.laneCoverage?.[id]?.elementCount) : null;
		const selectedElementId = selectionExact && selection?.elementDiscipline === id ? clean(selection?.elementId) : null;
		const receipt = latestReceipt?.objectId === objectId && latestReceipt?.discipline === id && Object.is(latestReceipt?.revision,intelligence?.context?.revision) ? latestReceipt : null;
		return Object.freeze({ id, label, status: allowedStatus(capability?.status), count, selectedElementId, action, enabled: true, reason: capability?.reason ?? null, provenancePresent: Boolean(capability?.provenancePresent), receipt });
	});
	return Object.freeze({ status: "active", mode: intelligence?.mode ?? "main", context: Object.freeze({ objectId, revision: intelligence?.context?.revision ?? null, s }), areas: Object.freeze(areas) });
}

function sourceCapability(context, capabilities) {
	const entries = ["horizontal", "vertical", "cant", "chainage", "topology"].map((key) => capabilities?.[key]).filter(Boolean);
	const sourceBearing = Boolean(context?.evidenceId || context?.provenance || entries.some((entry) => entry?.evidenceId || entry?.sourceRefs?.length || entry?.reviewProvenancePresent || entry?.reviewedCandidateId || entry?.relationStatus));
	if (!sourceBearing) return { status: "not-covered", reason: "Keine Quellevidenz im aktiven Objekt belegt", provenancePresent: false };
	if (entries.some((entry) => entry?.status === "review-required" || entry?.relationStatus === "open-candidates")) return { status: "review-required", reason: "Quellevidenz benötigt Prüfung", provenancePresent: entries.some((entry) => entry?.provenancePresent) };
	if (entries.some((entry) => entry?.status === "missing")) return { status: "missing", reason: "Quellevidenz unvollständig", provenancePresent: entries.some((entry) => entry?.provenancePresent) };
	return { status: entries.some((entry) => entry?.status === "constructive" || entry?.status === "partial-evidence") ? "partial-evidence" : "not-covered", reason: null, provenancePresent: entries.some((entry) => entry?.provenancePresent) };
}

function allowedStatus(value) { return ["constructive", "partial-evidence", "missing", "not-covered", "review-required"].includes(value) ? value : "not-covered"; }
function clean(value) { return String(value ?? "").trim() || null; }
function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function nonnegativeInteger(value) { const number = Number(value); return Number.isInteger(number) && number >= 0 ? number : null; }

export default buildAlignmentDesignSessionBoardModel;
