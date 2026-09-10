import { buildExistingAlignmentIntelligenceModel } from "../../domain/workspace/buildExistingAlignmentIntelligenceModel.js";
import { buildGndSevenLineRoleAssembly } from "../../domain/workspace/buildGndSevenLineRoleAssembly.js";
import { buildAlignmentEngineeringHudModel } from "../../domain/workspace/buildAlignmentEngineeringHudModel.js";
import { buildAlignmentEngineeringTaskRailModel } from "../../domain/workspace/buildAlignmentEngineeringTaskRailModel.js";
import { buildMainGeoreferenceQualificationModel } from "../../domain/workspace/buildMainGeoreferenceQualificationModel.js";
import { buildQLokEngineeringViewModel } from "../../domain/workspace/buildQLokEngineeringViewModel.js";
import { buildCrossViewElementSelectionModel } from "../../domain/workspace/buildCrossViewElementSelectionModel.js";
import { buildAlignmentWorkspaceContextBarModel } from "../../domain/workspace/buildAlignmentWorkspaceContextBarModel.js";
import { buildAlignmentDesignSessionBoardModel } from "../../domain/workspace/buildAlignmentDesignSessionBoardModel.js";
import { buildCanonicalAuthoringReceiptRailModel } from "../../domain/workspace/createCanonicalAuthoringReceiptRail.js";
import { buildDesignIssueNavigatorModel } from "../../domain/workspace/buildDesignIssueNavigatorModel.js";

function evidenceByFamily(record) {
	const result = {};
	for (const entry of record?.familyEvidence ?? record?.inventory ?? []) {
		const family = String(entry?.family ?? familyFromInventoryName(entry?.name) ?? "").toUpperCase();
		if (!["EL", "EH", "EU", "EK"].includes(family)) continue;
		const rowCount = Number(entry?.rowCount ?? 0);
		const constructive = entry?.constructive === true || (
			family === "EL" && rowCount > 0 && String(record?.truthfulnessStatus ?? "").includes("construction-available")
		);
		result[family] = {
			status: entry?.status ?? (constructive ? "constructive" : rowCount > 0 ? "partial-evidence" : "missing"),
			code: entry?.code ?? null,
			reason: entry?.reason ?? null,
			evidenceId: record?.evidenceId ?? null,
			sourceRefs: entry?.sourceRefs ?? [],
		};
	}
	return result;
}

function familyFromInventoryName(name) {
	return /(?:^|_)(EL|EH|EU|EK)$/i.exec(String(name ?? ""))?.[1] ?? null;
}

function issueDock(targetAction, docks = {}) {
	if (targetAction === "openVertical") return docks.vertical;
	if (targetAction === "openCant") return docks.cant;
	if (targetAction === "openChainage") return docks.chainage;
	return null;
}

export function canOpenDesignIssueTarget({ target = {}, activeObjectId, focusHorizontal, docks = {}, profileProjection, openReview, openObjects } = {}) {
	if (!target.objectId || String(target.objectId) !== String(activeObjectId ?? "")) return false;
	if (target.targetAction === "openHorizontal") return typeof focusHorizontal === "function";
	if (target.targetAction === "openReview") return typeof openReview === "function";
	if (target.targetAction === "openObjects") return typeof openObjects === "function";
	const dock = issueDock(target.targetAction, docks);
	if (typeof dock?.open !== "function") return false;
	if (target.targetAction === "openChainage" && target.mappingId) {
		if (!target.elementId || String(profileProjection?.alignmentId ?? "") !== String(target.objectId)) return false;
		const matches = (profileProjection?.selectableElements?.chainage ?? []).filter((entry) =>
			String(entry?.elementId ?? entry?.id ?? "") === String(target.elementId)
			&& String(entry?.mappingId ?? "") === String(target.mappingId));
		if (matches.length !== 1) return false;
	}
	return true;
}

export async function openDesignIssueTarget(options = {}) {
	const { target = {}, focusHorizontal, docks = {}, openReview, openObjects, setSelection, activateLongitudinal, focusLane } = options;
	if (!canOpenDesignIssueTarget(options)) return false;
	if (target.targetAction === "openHorizontal") return Boolean(await focusHorizontal(target));
	if (target.targetAction === "openReview") { openReview(); return true; }
	if (target.targetAction === "openObjects") { openObjects(); return true; }
	const opened = await issueDock(target.targetAction, docks).open({ objectId: target.objectId, elementId: target.elementId });
	if (opened !== true) return false;
	if (target.elementId) setSelection?.({ objectId: target.objectId, discipline: target.discipline, elementId: target.elementId });
	activateLongitudinal?.();
	focusLane?.(target.discipline);
	return true;
}

export function createExistingAlignmentIntelligenceJourneyController({
	store,
	workspace,
	viewController,
	profileSource = null,
	receiptSource = null,
	view,
} = {}) {
	if (typeof store?.getState !== "function" || typeof view?.render !== "function") {
		throw new TypeError("createExistingAlignmentIntelligenceJourneyController: incomplete dependencies");
	}
	let finding = { evidenceId: null };
	let context = {};
	let serviceEvidence = {};
	let unsubscribe = null;
	let unsubscribeMode = null;
	let unsubscribeProfile = null;
	let unsubscribeReceipt = null;
	let profileProjection = profileSource?.getCurrentProjection?.() ?? null;

	function render() {
		const state = store.getState();
		const objectId = String(state?.workspace_selection?.primaryId ?? context.objectId ?? "").trim() || null;
		const s = Number(state?.cursor?.s);
		const main = viewController?.getDebugState?.() ?? {};
		const horizontal = objectId && main?.objectId === objectId && Number(main?.segmentCount) > 0
			? { status: "constructive", evidenceId: context.evidenceId ?? finding.evidenceId }
			: finding.EL;
		const crs = ["qualified", "valid"].includes(main?.georeference?.validationStatus)
			? { status: "constructive", value: { mode: "qualified-crs", crs: main.georeference.resolvedEpsg ?? main.georeference.horizontal?.resolvedEpsg ?? null }, reason: null }
			: { status: "not-covered", value: { mode: "local-cartesian", context: "local engineering" }, reason: localSpatialReason(main?.georeference) };
		const profile = profileCapabilities(profileProjection, finding);
		const canonicalRevision=profileProjection?.alignmentId===objectId&&profileProjection?.revision!=null?profileProjection.revision:context.revision;
		const intelligence = buildExistingAlignmentIntelligenceModel({
			mode: workspace?.getActiveMode?.() ?? "main",
			context: { ...context, objectId, revision:canonicalRevision, s },
			evidence: finding,
			sevenLineRoleAssembly: finding.sevenLineRoleAssembly,
			projections: {
				...serviceEvidence,
				horizontal: { ...horizontal, value: main?.cursor ? { curvature: main.cursor.curvature ?? null, tangent: main.cursor.tangent ?? null } : null, provenancePresent: Boolean(horizontal?.evidenceId) },
				crs,
				...profile,
				section: serviceEvidence.section ?? { status: "not-covered", reason: "Reference frame only · no qualified rail or section evidence" },
			},
		});
		const georeferenceQualification = buildMainGeoreferenceQualificationModel({ mode: intelligence.mode, context: intelligence.context, debugObjectId: main?.objectId, georeference: main?.georeference, cursor: main?.cursor });
		const modelBase = {
			...intelligence,
			hud: buildAlignmentEngineeringHudModel(intelligence),
			taskRail: buildAlignmentEngineeringTaskRailModel(intelligence),
			georeferenceQualification,
		};
		const elementSelection = buildCrossViewElementSelectionModel({ state, mode: intelligence.mode, horizontalSource: main, profileSource: profileProjection });
		const latestReceipt=receiptSource?.getLatest?.()??null;
		receiptSource?.setCanonicalContext?.(modelBase.context);
		const designSessionBoard = buildAlignmentDesignSessionBoardModel({ intelligence: modelBase, horizontalSource: main, profileProjection, selection: state?.workspace_selection, latestReceipt });
		const receiptRail=buildCanonicalAuthoringReceiptRailModel({receipt:latestReceipt,selection:state?.workspace_selection,activeRevision:modelBase.context.revision,horizontalSource:main,profileSource:profileProjection});
		const issueNavigator=buildDesignIssueNavigatorModel({intelligence:modelBase,profileProjection,selection:state?.workspace_selection});
		const model = Object.freeze({ ...modelBase, contextBar: buildAlignmentWorkspaceContextBarModel({ intelligence: modelBase, georeferenceQualification }), qLokEngineeringView: buildQLokEngineeringViewModel({ intelligence: modelBase, profileProjection }), elementSelection, designSessionBoard, receiptRail,issueNavigator });
		view.render(model);
		return model;
	}

	function setFinding(record) {
		finding = { evidenceId: record?.evidenceId ?? null, provenance: record?.source ?? null, sevenLineRoleAssembly: record?.sevenLineRoleAssembly ?? buildGndSevenLineRoleAssembly(record, { targetItemId: record?.candidate?.itemId ?? null }), ...evidenceByFamily(record) };
		return render();
	}

	function setPromotedEvidence(evidence) {
		if (!evidence) {
			finding = { evidenceId: null };
			serviceEvidence = { ...serviceEvidence, topology: undefined };
			context = { ...context, evidenceId: null, provenance: null, route: null, sourceRole: null };
			return render();
		}
		finding = { evidenceId: evidence.evidenceId ?? null, provenance: evidence.provenance ?? null, sevenLineRoleAssembly: evidence.sevenLineRoleAssembly ?? null, EL: evidence.EL, EH: evidence.EH, EU: evidence.EU, EK: evidence.EK };
		serviceEvidence = { ...serviceEvidence, topology: evidence.relation };
		context = { ...context, evidenceId: evidence.evidenceId ?? null, provenance: evidence.provenance ?? null, route: evidence.routeContext?.route ?? null, sourceRole: evidence.routeContext?.sourceRole ?? null };
		return render();
	}

	function setActiveContext(next) {
		context = { ...context, ...next };
		return render();
	}

	function setServiceEvidence(next) {
		serviceEvidence = { ...serviceEvidence, ...(next ?? {}) };
		return render();
	}

	function start() {
		unsubscribe = store.subscribe?.(render) ?? null;
		unsubscribeMode = view.wireModeChanges?.(render) ?? null;
		unsubscribeProfile = profileSource?.subscribeProjection?.((value) => { profileProjection = value; render(); }) ?? null;
		unsubscribeReceipt=receiptSource?.subscribe?.(render)??null;
		return render();
	}

	function dispose() { unsubscribe?.(); unsubscribeMode?.(); unsubscribeProfile?.(); unsubscribeReceipt?.(); unsubscribe = null; unsubscribeMode = null; unsubscribeProfile = null; unsubscribeReceipt=null; }
	return { start, dispose, render, setFinding, setPromotedEvidence, setActiveContext, setServiceEvidence };
}

function profileCapabilities(projection, finding) {
	if (!projection) return {};
	const vertical = projection.vertical?.status === "evaluated"
		? { status: "constructive", value: { elevation: projection.vertical.value?.elevation, gradient: projection.vertical.value?.gradient }, provenancePresent: true }
		: projection.vertical?.status === "source-evidence"
			? { status: "partial-evidence", value: projection.vertical.value, provenancePresent: true, admissible: false }
			: finding?.EH;
	const cant = projection.cant?.status === "evaluated"
		? { status: "constructive", value: { crossLevel: projection.cant.value?.crossLevel, twist: projection.cant.value?.twist }, provenancePresent: true }
		: projection.cant?.status === "source-evidence"
			? { status: "partial-evidence", value: projection.cant.value, provenancePresent: true, admissible: false }
			: finding?.EU;
	const speed = projection.speed?.status === "source-evidence"
		? {
			status: "partial-evidence",
			value: compactSourceSpeedValue(projection.speed.value),
			provenancePresent: true,
			admission: projection.speed.admission ?? "evidence-only",
			admissible: false,
			reason: projection.speed.reason ?? "SOURCE_SPEED_NOT_ADMITTED_AS_CONSTRUCTIVE_STATE",
		}
		: { status: "missing", reason: projection.speed?.reason ?? "SOURCE_SPEED_EVIDENCE_NOT_AVAILABLE" };
	const chainage = ["evaluated", "unique", "complete"].includes(projection.chainage?.status) ? { status: "constructive", value: projection.chainage, provenancePresent: true } : finding?.EK;
	return { vertical, cant, speed, chainage };
}

function compactSourceSpeedValue(value) {
	const exact = Array.isArray(value?.exact) ? value.exact[0] ?? null : null;
	if (exact) return sourceSpeedFact(exact, "exact-source-record");
	const before = value?.before ?? null;
	const after = value?.after ?? null;
	if (before && after && Object.is(before.speed, after.speed) && Object.is(before.declaredSpeedUnit, after.declaredSpeedUnit)) {
		return sourceSpeedFact(before, "equal-bracketing-source-records");
	}
	return Object.freeze({
		support: value?.status ?? "not-covered",
		before: before ? sourceSpeedFact(before, "before") : null,
		after: after ? sourceSpeedFact(after, "after") : null,
	});
}

function sourceSpeedFact(record, support) {
	return Object.freeze({
		sourceSpeed: record?.speed ?? null,
		unit: record?.declaredSpeedUnit ?? "not-declared",
		support,
		sourceType: record?.type ?? null,
	});
}

function localSpatialReason(georeference) {
	const fallback = String(georeference?.fallbackReason ?? "local-cartesian");
	if (fallback === "local-cartesian") return "local-cartesian";
	if (["missing-crs", "local-lsys-variant"].includes(fallback)) return "local engineering · CRS not qualified";
	if (["malformed-crs", "unsupported-source-family", "conflicting-crs", "outside-validity"].includes(fallback)) return "local engineering · CRS evidence requires review";
	return "local engineering · geographic projection unavailable";
}

export default createExistingAlignmentIntelligenceJourneyController;
