const CATEGORY = Object.freeze({ horizontal: "Horizontal", vertical: "Vertical", cant: "Cant", chainage: "Chainage", source: "Source", space: "Space" });
const ACTION = Object.freeze({ horizontal: "openHorizontal", vertical: "openVertical", cant: "openCant", chainage: "openChainage", source: "openReview", space: "openObjects" });
const NON_CLEAR = new Set(["partial-evidence", "missing", "not-covered", "review-required", "error", "rejected", "unavailable", "target-missing", "open-candidates", "unassigned"]);

export function buildDesignIssueNavigatorModel({ intelligence = null, profileProjection = null, selection = null } = {}) {
	const context = intelligence?.context ?? {};
	const objectId = clean(context.objectId);
	if (!objectId) return frozen({ status: "empty", mode: mode(intelligence?.mode), context: { objectId: null, revision: null }, issues: [], message: "Keine transportierten Befunde" });
	const revision = context.revision ?? null;
	const collected = [];
	for (const [discipline, capabilityKey] of [["horizontal","horizontal"],["vertical","vertical"],["cant","cant"],["chainage","chainage"],["source","topology"],["space","crs"]]) {
		const value = intelligence?.capabilities?.[capabilityKey];
		if (!value || !NON_CLEAR.has(String(value.status ?? value.relationStatus ?? ""))) continue;
		collected.push(issue({ objectId, revision, discipline, status: value.status ?? value.relationStatus, code: value.code, reason: value.reason, provenancePresent: provenance(value), source: "intelligence-capability" }));
	}
	const exactProfile = clean(profileProjection?.alignmentId) === objectId && sameRevision(profileProjection?.revision, revision);
	if (exactProfile) {
		for (const discipline of ["vertical", "cant", "chainage"]) {
			const lane = profileProjection?.[discipline];
			if (lane && NON_CLEAR.has(String(lane.status ?? "")) && (lane.reason || lane.code)) collected.push(issue({ objectId, revision, discipline, status: lane.status, code: lane.code, reason: lane.reason, provenancePresent: provenance(lane), source: "profile-projection" }));
		}
		for (const diagnostic of profileProjection?.diagnostics ?? []) {
			const discipline = normalizeDiscipline(diagnostic?.discipline);
			if (!discipline) continue;
			collected.push(issue({ objectId, revision, discipline, elementId: diagnostic.elementId ?? diagnostic.targetId, mappingId: diagnostic.mappingId, status: diagnostic.status ?? "review-required", issueId: diagnostic.issueId, code: diagnostic.code, reason: diagnostic.reason ?? diagnostic.message, provenancePresent: provenance(diagnostic), source: "profile-diagnostic" }));
		}
	}
	for (const row of intelligence?.sevenLineRoleAssembly?.rows ?? []) {
		if (!NON_CLEAR.has(String(row?.status ?? ""))) continue;
		const discipline = sevenLineDiscipline(row?.id);
		collected.push(issue({ objectId, revision, discipline, status: row.status, code: row.code, reason: row.reason, provenancePresent: provenance(row), source: "seven-line" }));
	}
	for (const diagnostic of intelligence?.sevenLineRoleAssembly?.diagnostics ?? []) collected.push(issue({ objectId, revision, discipline: "source", status: "review-required", code: diagnostic, reason: diagnostic, provenancePresent: provenance(intelligence?.context), source: "seven-line-diagnostic" }));
	const issues = dedupeStable(collected).sort(priority(mode(intelligence?.mode)));
	return frozen({ status: issues.length ? "active" : "empty", mode: mode(intelligence?.mode), context: { objectId, revision }, issues, message: issues.length ? null : "Keine transportierten Befunde" });
}

function issue({ objectId, revision, discipline, elementId = null, mappingId = null, status, issueId = null, code = null, reason = null, provenancePresent = false, source }) {
	const targetElement = clean(elementId), targetMapping = clean(mappingId), stable = clean(issueId) || clean(code);
	return { id: null, stableKey: stable ? JSON.stringify([objectId, revision, discipline, targetElement, targetMapping, stable]) : null, objectId, revision, discipline, category: CATEGORY[discipline], elementId: targetElement || null, mappingId: targetMapping || null, status: String(status ?? "not-covered"), code: clean(code) || null, reason: reason == null ? null : String(reason), provenancePresent: Boolean(provenancePresent), source, action: "openIssue", targetAction: ACTION[discipline] };
}
function dedupeStable(entries) { const seen=new Set();let unkeyed=0;const result=[];for(const entry of entries){if(entry.stableKey){if(seen.has(entry.stableKey))continue;seen.add(entry.stableKey);entry.id=entry.stableKey;}else{entry.id=JSON.stringify([entry.objectId,entry.revision,entry.discipline,entry.elementId,entry.mappingId,entry.source,unkeyed++]);}delete entry.stableKey;result.push(entry);}return result; }
function priority(activeMode) { const order=activeMode==="l"?["vertical","cant","chainage","horizontal","source","space"]:activeMode==="q"?["horizontal","vertical","cant","chainage","source","space"]:["space","horizontal","source","vertical","cant","chainage"];return(a,b)=>order.indexOf(a.discipline)-order.indexOf(b.discipline); }
function sevenLineDiscipline(id){const value=String(id??"");if(value.startsWith("gradient"))return"vertical";if(value.startsWith("cant"))return"cant";if(value.startsWith("curvature"))return value.includes("kilomet")?"chainage":"horizontal";return"source";}
function normalizeDiscipline(value){const key=clean(value)?.toLowerCase();return Object.hasOwn(CATEGORY,key)?key:null;}
function provenance(value){return Boolean(value?.provenancePresent||value?.evidenceId||value?.sourceRefs?.length||value?.reviewProvenancePresent||value?.provenance);}
function sameRevision(left,right){return left!=null&&right!=null&&Object.is(left,right);}
function clean(value){const result=String(value??"").trim();return result||null;}
function mode(value){return["main","q","l"].includes(value)?value:"main";}
function frozen(value){value.context=Object.freeze(value.context);value.issues=Object.freeze(value.issues.map((entry)=>Object.freeze({...entry})));return Object.freeze(value);}

export default buildDesignIssueNavigatorModel;
