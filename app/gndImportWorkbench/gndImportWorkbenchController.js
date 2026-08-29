import { renderGndImportWorkbench } from "./gndImportWorkbenchView.js";
import { buildGndRelationReviewModel } from "../domain/workspace/buildGndRelationReviewModel.js";
import { buildGndSevenLineRoleAssembly } from "../domain/workspace/buildGndSevenLineRoleAssembly.js";
import { buildGndRouteWorkspaceModel } from "../domain/workspace/buildGndRouteWorkspaceModel.js";
import { buildGndDatasetCompletenessCockpitModel } from "../domain/workspace/buildGndDatasetCompletenessCockpitModel.js";
import { pickDirectoryFiles, supportsDirectoryPicker } from "../io/input/directoryPicker.js";

export function makeGndImportWorkbenchController({ store, messaging, cockpit, importController, alignmentCreation, alignmentEditorBridge, promotedAlignmentJourney, alignmentIntelligence, windowRef = globalThis.window } = {}) {
	const directoryPickerSupported = supportsDirectoryPicker(windowRef) === true;
	const state = { phase: "idle", records: [], items: [], rejectedItems: [], previewTracks: [], fileOutcomes: [], lifecycle: null, dropState: null, jobSnapshot: null, feedback: null, busyItemId: null, activeItemId: null, promotedItemId: null, promotedObjectId: null, activeEvidenceId: null, relationReviewModel: null, sevenLineRoleAssembly: null, routeWorkspaces: [], datasetCompleteness: null, alignmentIntelligenceModel: null, workspacePhase: "loading", workspaceObjects: [], workspaceFeedback: null, newAlignmentPhase: "idle", directoryPickerSupported };
	let root;
	let overlay;
	let prior = null;
	let unsub = null;
	let unsubTerminalOutcomes = null;
	let unsubImportActivity = null;
	let jobFrame = null;
	let lastJobEvidence = null;
	let dragFrameRestore = null;
	let stopToolResponsive = null;
	let refreshPromise = null;
	const onToolEscape = (event) => { if (event?.key === "Escape" && !overlay?.classList.contains("hidden")) close(); };

	function refresh() {
		if (refreshPromise) return refreshPromise;
		refreshPromise = refreshOnce().finally(() => {
			refreshPromise = null;
		});
		return refreshPromise;
	}

	async function refreshOnce() {
		state.phase = "loading";
		render();
		try {
			const [session, evidence] = await Promise.all([
				messaging.sendCmdAwait("Import.GetState", {}),
				messaging.sendCmdAwait("Import.GetResultEvidence", { projection: "workbench" }),
			]);
			state.items = session?.items ?? [];
			state.rejectedItems = session?.rejectedItems ?? [];
			state.previewTracks = importController?.getVisibleTracks?.() ?? [];
			state.records = evidence?.records ?? [];
			if (!state.records.some((record) => String(record?.evidenceId ?? "") === String(state.activeEvidenceId ?? ""))) {
				state.activeEvidenceId = state.records[0]?.evidenceId ?? null;
			}
			const activeRecord = state.records.find((record) => String(record?.evidenceId ?? "") === String(state.activeEvidenceId ?? "")) ?? null;
			state.relationReviewModel = activeRecord ? buildGndRelationReviewModel(activeRecord) : null;
			const activeItems = state.items.filter((item) => String(item?.evidenceId ?? "") === String(state.activeEvidenceId ?? ""));
			if (!activeItems.some((item) => String(item?.id ?? "") === String(state.activeItemId ?? ""))) {
				state.activeItemId = activeItems.find((item) => item?.status?.promotable === true)?.id ?? activeItems[0]?.id ?? null;
			}
			state.sevenLineRoleAssembly = activeRecord ? buildGndSevenLineRoleAssembly(activeRecord, { targetItemId: activeItems.find((item) => String(item.id) === String(state.activeItemId))?.evidenceItemId ?? state.activeItemId }) : null;
			state.routeWorkspaces = buildGndRouteWorkspaceModel({ records: state.records, items: state.items, objects: state.workspaceObjects });
			state.alignmentIntelligenceModel = activeRecord ? alignmentIntelligence?.setFinding?.(activeRecord) ?? null : null;
			state.phase = "ready";
		} catch {
			state.phase = "error";
		}
		render();
		return state;
	}

	async function setRelationDecision(candidateId, action) {
		const review = state.relationReviewModel;
		if (!review?.evidenceId) return false;
		state.feedback = null;
		const result = await messaging.sendCmdAwait("Import.SetRelationDecision", { evidenceId: review.evidenceId, candidateId: String(candidateId ?? ""), action, expectedRevision: review.revision });
		await refresh();
		const canonical = state.records.find((record) => record?.evidenceId === review.evidenceId);
		const next = buildGndRelationReviewModel(canonical);
		const expected = action === "review" ? String(candidateId) : null;
		const ok = result?.ok === true && next.reviewedCandidateId === expected;
		state.feedback = ok ? (action === "review" ? "source-association-reviewed" : "source-association-review-withdrawn") : result?.code ?? "source-association-review-failed";
		state.relationReviewModel = next;
		render();
		return ok;
	}

	async function reviewDatasetAssociation(evidenceId, candidateId) {
		state.activeEvidenceId = String(evidenceId ?? "");
		const record = state.records.find((entry) => String(entry?.evidenceId ?? "") === state.activeEvidenceId) ?? null;
		state.relationReviewModel = record ? buildGndRelationReviewModel(record) : null;
		return setRelationDecision(candidateId, "review");
	}

	async function refreshWorkspaceState() {
		state.workspacePhase = "loading";
		render();
		try {
			const spot = await messaging.sendCmdAwait("Spot.GetState", {});
			state.workspaceObjects = spotObjects(spot);
			state.routeWorkspaces = buildGndRouteWorkspaceModel({ records: state.records, items: state.items, objects: state.workspaceObjects });
			state.workspacePhase = "ready";
		} catch {
			state.workspaceObjects = [];
			state.workspacePhase = "error";
		}
		render();
		return state.workspaceObjects;
	}

	async function promoteRoute(routeWorkspaceId) {
		const route = state.routeWorkspaces.find((entry) => entry.id === String(routeWorkspaceId ?? ""));
		if (!route?.promotableItemIds?.length) return false;
		state.feedback = null;
		for (const itemId of route.promotableItemIds) {
			const ok = await cockpit.acceptImportItem(itemId, { show: false });
			if (ok !== true) { state.feedback = "gnd_workbench.transfer_failed"; render(); return false; }
		}
		await refresh();
		const spot = await messaging.sendCmdAwait("Spot.GetState", {});
		state.workspaceObjects = spotObjects(spot);
		state.routeWorkspaces = buildGndRouteWorkspaceModel({ records: state.records, items: state.items, objects: state.workspaceObjects });
		const canonical = state.routeWorkspaces.find((entry) => entry.id === route.id)?.canonicalObjectIds?.[0] ?? null;
		if (canonical) await promotedAlignmentJourney?.activateCanonicalAlignment?.(canonical);
		state.feedback = "gnd_workbench.route_transfer_ok";
		render();
		return route.promotableItemIds.length;
	}

	function showOverlay() {
		if (overlay?.classList.contains("hidden")) prior = captureSurfaceState();
		document.getElementById("btnSpotClose")?.click();
		document.getElementById("btnAlignmentEditorClose")?.click();
		document.getElementById("btnVerticalProfileAuthoringClose")?.click();
		document.getElementById("btnCantAuthoringClose")?.click();
		document.getElementById("btnChainageAuthoringClose")?.click();
		stopToolResponsive?.();
		stopToolResponsive = watchGndWorkbenchToolSurface(overlay, "workbench", windowRef);
		overlay?.classList.remove("hidden");
		overlay?.setAttribute?.("aria-hidden", "false");
		document.getElementById("btnGndImportWorkbench")?.classList.add("btn--primary");
		render();
	}

	async function open() {
		showOverlay();
		await refresh();
		root?.querySelector("button, summary, [tabindex]")?.focus();
	}

	function close({ restore = true, preserveImportStatus = false } = {}) {
		stopToolResponsive?.(); stopToolResponsive = null;
		stopJobObservation();
		removeDragFrame();
		overlay?.classList.add("hidden");
		overlay?.setAttribute?.("aria-hidden", "true");
		clearToolSurface("workbench");
		document.getElementById("btnGndImportWorkbench")?.classList.remove("btn--primary");
		store.actions?.clearPreviewItem?.();
		if (restore) restoreSurfaceState(prior);
		prior = null;
		state.dropState = null;
		if (!preserveImportStatus) {
			state.lifecycle = null;
			state.jobSnapshot = null;
			state.fileOutcomes = [];
		}
		document.getElementById("geoStage")?.focus?.();
	}

	async function preview(itemId) {
		state.feedback = null;
		state.activeItemId = String(itemId ?? "");
		await cockpit.refreshImportState();
		await cockpit.previewImportItem(itemId);
		render();
	}

	async function promote(itemId) {
		const item = state.items.find((entry) => String(entry.id) === String(itemId));
		if (!item || item?.status?.promotable !== true || item?.status?.rejected === true || item?.status?.accepted === true) return false;
		state.busyItemId = itemId;
		state.feedback = null;
		state.promotedItemId = null;
		state.promotedObjectId = null;
		state.alignmentIntelligenceModel = alignmentIntelligence?.setFinding?.(state.records.find((record) => String(record?.evidenceId ?? "") === String(item?.evidenceId ?? "")) ?? null) ?? null;
		render();
		await cockpit.refreshImportState();
		const useWorkspaceJourney = typeof promotedAlignmentJourney?.activateCanonicalAlignment === "function";
		const ok = useWorkspaceJourney
			? await cockpit.acceptImportItem(itemId, { show: false })
			: await cockpit.acceptImportItem(itemId, { show: true });
		state.busyItemId = null;
		await refresh();
		const spot = await messaging.sendCmdAwait("Spot.GetState", {});
		const promoted = spotObjects(spot).find((entry) =>
			String(entry?.id ?? "") === String(itemId) ||
			String(entry?.meta?.importItemId ?? "") === String(itemId)
		) ?? null;
		if (ok !== true || !promoted?.id) {
			state.feedback = "gnd_workbench.transfer_failed";
			state.promotedItemId = null;
			state.promotedObjectId = null;
			render();
			return false;
		}
		const journey = useWorkspaceJourney
			? await promotedAlignmentJourney.activateCanonicalAlignment(String(promoted.id))
			: { ok: true };
		if (journey.ok !== true) {
			state.feedback = journey?.code ?? "gnd_workbench.transfer_failed";
			state.promotedItemId = null;
			state.promotedObjectId = null;
			render();
			return false;
		}
		state.feedback = "gnd_workbench.transfer_ok";
		state.promotedItemId = String(itemId);
		state.promotedObjectId = String(promoted.id);
		state.workspaceObjects = spotObjects(spot);
		state.workspacePhase = "ready";
		render();
		await cockpit?.refreshAll?.();
		close({ restore: false });
		if (!useWorkspaceJourney) showPromotedObjectSurfaces();
		return state.promotedObjectId;
	}

	function chooseFiles() {
		document.getElementById("btnImport")?.click();
	}

	async function chooseDirectory() {
		state.directoryPickerSupported = supportsDirectoryPicker(windowRef) === true;
		if (state.directoryPickerSupported !== true) return false;
		try {
			const files = await pickDirectoryFiles({ windowRef });
			if (!files.length) return false;
			return await importController?.importFiles?.(files) ?? false;
		} catch (error) {
			if (error?.name === "AbortError") return false;
			state.workspaceFeedback = "DIRECTORY_SELECTION_FAILED";
			render();
			return false;
		}
	}

	function openObjects() {
		close({ restore: false });
		document.getElementById("btnSpot")?.click();
	}

	async function createAlignment(name) {
		if (state.newAlignmentPhase === "creating") return false;
		const explicitName = String(name ?? "").trim();
		if (name !== undefined && !explicitName) { state.workspaceFeedback = "Name für das neue Alignment erforderlich"; state.newAlignmentPhase = "error"; render(); return false; }
		state.workspaceFeedback = null;
		state.newAlignmentPhase = "creating";
		render();
		try {
			const result = name === undefined ? await alignmentCreation?.create?.() : await alignmentCreation?.create?.({ name: explicitName });
			const requestedId = String(result?.spotObject?.id ?? result?.alignmentData?.id ?? "").trim();
			if (!requestedId) throw new Error("ALIGNMENT_CREATION_NOT_ACKNOWLEDGED");
			const objects = await refreshWorkspaceState();
			const canonical = objects.find((entry) => String(entry?.id ?? "") === requestedId);
			if (!canonical) throw new Error("ALIGNMENT_CREATION_NOT_CANONICAL");
			const activated = await cockpit?.activateSpotObject?.(requestedId);
			if (activated !== true) throw new Error("ALIGNMENT_CREATION_NOT_ACTIVATED");
			state.workspaceFeedback = "alignment-created";
			state.newAlignmentPhase = "created";
			close({ restore: false });
			await alignmentEditorBridge?.open?.({ objectId: requestedId, discipline: "horizontal", source: "guided-start-create" });
			return requestedId;
		} catch (error) {
			state.workspaceFeedback = error?.message ?? "ALIGNMENT_CREATION_FAILED";
			state.newAlignmentPhase = "error";
			render();
			return false;
		}
	}

	async function reopenObject(objectId) {
		const requestedId = String(objectId ?? "").trim();
		const objects = await refreshWorkspaceState();
		if (!requestedId || !objects.some((entry) => String(entry?.id ?? "") === requestedId)) {
			state.workspaceFeedback = "WORKSPACE_OBJECT_NOT_FOUND";
			render();
			return false;
		}
		if (typeof promotedAlignmentJourney?.activateCanonicalAlignment !== "function") {
			state.workspaceFeedback = "WORKSPACE_REOPEN_JOURNEY_UNAVAILABLE";
			render();
			return false;
		}
		try {
			const result = await promotedAlignmentJourney.activateCanonicalAlignment(requestedId);
			if (result?.ok !== true) {
				state.workspaceFeedback = result?.code ?? "WORKSPACE_REOPEN_NOT_ACKNOWLEDGED";
				render();
				return false;
			}
			if (String(result.objectId ?? "").trim() !== requestedId) {
				state.workspaceFeedback = "WORKSPACE_REOPEN_IDENTITY_MISMATCH";
				render();
				return false;
			}
			state.workspaceFeedback = null;
			close({ restore: false });
			return true;
		} catch (error) {
			state.workspaceFeedback = String(error?.code ?? "WORKSPACE_REOPEN_FAILED");
			render();
			return false;
		}
	}

	async function handleTerminalOutcome(detail) {
		stopJobObservation();
		removeDragFrame();
		state.dropState = null;
		state.lifecycle = detail ? {
			...detail,
			fileStates: detail?.outcome?.fileStates ?? detail?.fileStates ?? null,
		} : null;
		state.jobSnapshot = terminalJob(detail) ?? state.jobSnapshot;
		state.fileOutcomes = Array.isArray(detail?.outcome?.fileOutcomes)
			? [...detail.outcome.fileOutcomes]
			: [{
				fileName: null,
				parserId: null,
				status: String(detail?.state ?? "unknown"),
				reason: detail?.message ?? detail?.code ?? null,
				itemCount: 0,
				rejectedCount: 0,
				evidencePublished: false,
				failed: detail?.state === "failed" || detail?.state === "rejected",
			}];
		await refresh();
		close({ preserveImportStatus: true });
		// Terminal observers use this only as an acknowledgement. A shallow
		// snapshot avoids cloning the potentially large Workbench model again.
		return { ...state };
	}

	function handleImportActivity(detail) {
		const lifecycleState = String(detail?.state ?? "unknown");
		if (lifecycleState === "idle") {
			removeDragFrame();
			state.dropState = null;
			render();
			return getState();
		}
		if (lifecycleState === "drag-active") {
			applyDragFrame();
			state.dropState = detail;
			showOverlay();
			return getState();
		}
		removeDragFrame();
		if (lifecycleState === "accepted") {
			state.fileOutcomes = [];
			state.feedback = null;
			state.records = [];
			state.items = [];
			state.rejectedItems = [];
		}
		state.dropState = null;
		state.lifecycle = detail;
		if (detail?.job) state.jobSnapshot = detail.job;
		showOverlay();
		if (["accepted", "processing"].includes(lifecycleState)) startJobObservation();
		return getState();
	}

	function startJobObservation() {
		if (jobFrame != null || typeof requestAnimationFrame !== "function") return;
		const observe = () => {
			jobFrame = null;
			const snapshot = importController?.getActiveImportJob?.() ?? null;
			const evidence = snapshot ? `${snapshot.phase}:${snapshot.heartbeatAt}` : null;
			if (snapshot && evidence !== lastJobEvidence) {
				lastJobEvidence = evidence;
				state.jobSnapshot = snapshot;
				render();
			}
			if (["accepted", "processing"].includes(String(state.lifecycle?.state ?? ""))) {
				jobFrame = requestAnimationFrame(observe);
			}
		};
		jobFrame = requestAnimationFrame(observe);
	}

	function stopJobObservation() {
		if (jobFrame != null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(jobFrame);
		jobFrame = null;
		lastJobEvidence = null;
	}

	function applyDragFrame() {
		const target = document.documentElement;
		if (!target || dragFrameRestore) return;
		dragFrameRestore = {
			outline: target.style?.outline ?? "",
			outlineOffset: target.style?.outlineOffset ?? "",
		};
		if (target.style) {
			target.style.outline = "4px solid #00d4ff";
			target.style.outlineOffset = "-4px";
		}
		target.dataset.importDragActive = "true";
	}

	function removeDragFrame() {
		const target = document.documentElement;
		if (!target) return;
		if (dragFrameRestore && target.style) {
			target.style.outline = dragFrameRestore.outline;
			target.style.outlineOffset = dragFrameRestore.outlineOffset;
		}
		delete target.dataset.importDragActive;
		dragFrameRestore = null;
	}

	function render() {
		state.directoryPickerSupported = supportsDirectoryPicker(windowRef) === true;
		state.datasetCompleteness = buildGndDatasetCompletenessCockpitModel(state);
		renderGndImportWorkbench(root, state);
	}

	function showPromotedObjectSurfaces() {
		const objectsOverlay = document.getElementById("spotOverlay");
		if (objectsOverlay?.classList.contains("hidden")) document.getElementById("btnSpot")?.click();
		const shell = document.getElementById("ufShell");
		if (shell?.classList.contains("is-cockpit-collapsed")) document.getElementById("btnCockpit")?.click();
	}

	function start() {
		root = document.getElementById("gndImportWorkbenchBody");
		overlay = document.getElementById("gndImportWorkbenchOverlay");
		document.getElementById("btnGndImportWorkbench")?.addEventListener("click", open);
		document.getElementById("btnGndImportWorkbenchClose")?.addEventListener("click", close);
		for (const id of ["btnSpot", "btnTrans", "btnAlignmentEditor", "btnToggleBands", "btnToggleSection", "btnToggleDebug", "btnCockpit"]) {
			document.getElementById(id)?.addEventListener("click", () => {
				if (!overlay?.classList.contains("hidden")) close({ restore: false });
			}, { capture: true });
		}
		root?.addEventListener("click", async (event) => {
			const evidenceButton = event.target.closest("[data-import-evidence-select]");
			if (evidenceButton) {
				state.activeEvidenceId = evidenceButton.dataset.importEvidenceSelect;
				const record = state.records.find((entry) => String(entry?.evidenceId ?? "") === String(state.activeEvidenceId));
				const item = state.items.find((entry) => String(entry?.evidenceId ?? "") === String(state.activeEvidenceId));
				state.activeItemId = item?.id ?? null;
				state.alignmentIntelligenceModel = record ? alignmentIntelligence?.setFinding?.(record) ?? null : null;
				render();
				return;
			}
			if (event.target.closest("[data-import-choose-files]")) return chooseFiles();
			if (event.target.closest("[data-import-choose-directory]")) return chooseDirectory();
			if (event.target.closest("[data-import-retry]")) return chooseFiles();
			if (event.target.closest("[data-workspace-retry]")) return refreshWorkspaceState();
			if (event.target.closest("[data-open-workspace-objects]")) return openObjects();
			if (event.target.closest("[data-create-alignment]")) return createAlignment(root?.querySelector?.("[data-new-alignment-name]")?.value);
			const reopenButton = event.target.closest("[data-reopen-workspace-object]");
			if (reopenButton) return reopenObject(reopenButton.dataset.reopenWorkspaceObject);
			const previewButton = event.target.closest("[data-gnd-preview]");
			if (previewButton) return preview(previewButton.dataset.gndPreview);
			const promoteButton = event.target.closest("[data-gnd-promote]");
			if (promoteButton) return promote(promoteButton.dataset.gndPromote);
			const promoteRouteButton = event.target.closest("[data-gnd-promote-route]");
			if (promoteRouteButton) return promoteRoute(promoteRouteButton.dataset.gndPromoteRoute);
			const datasetReviewButton = event.target.closest("[data-dataset-source-association-review]");
			if (datasetReviewButton) return reviewDatasetAssociation(datasetReviewButton.dataset.evidenceId, datasetReviewButton.dataset.datasetSourceAssociationReview);
			const reviewAssociation = event.target.closest("[data-gnd-source-association-review]");
			if (reviewAssociation) return setRelationDecision(reviewAssociation.dataset.gndSourceAssociationReview, "review");
			const withdrawReview = event.target.closest("[data-gnd-source-association-withdraw-review]");
			if (withdrawReview) return setRelationDecision(withdrawReview.dataset.gndSourceAssociationWithdrawReview, "withdraw-review");
			const rawButton = event.target.closest("[data-gnd-raw-table]");
			if (rawButton) {
				const evidenceId = rawButton.closest("[data-evidence-id]")?.dataset.evidenceId;
				const pre = rawButton.parentElement?.querySelector("[data-raw-evidence]");
				if (!pre || !evidenceId) return;
				pre.textContent = "Quelldaten werden geladen …";
				try {
					const response = await messaging.sendCmdAwait("Import.GetResultEvidence", { evidenceId });
					const table = response?.record?.sourceEnvelope?.tables?.[Number(rawButton.dataset.gndRawTable)];
					pre.textContent = JSON.stringify({ ...table, rows: table?.rows?.slice?.(0, 100) ?? [] }, null, 2);
				} catch (error) {
					pre.textContent = `Quelldaten nicht verfügbar: ${String(error?.message ?? error)}`;
				}
			}
		});
		window.addEventListener("ufaim:language-changed", render);
		windowRef?.addEventListener?.("keydown", onToolEscape);
		unsub = messaging.onEvt?.("Import.StateChanged", () => {
			if (!overlay?.classList.contains("hidden")) void refresh();
		});
		unsubTerminalOutcomes = importController?.subscribeTerminalOutcomes?.(handleTerminalOutcome) ?? null;
		unsubImportActivity = importController?.subscribeImportActivity?.(handleImportActivity) ?? null;
		void refreshWorkspaceState().then(showOverlay, showOverlay);
	}

	function getState() { return structuredClone(state); }
	function destroy() { unsub?.(); unsubTerminalOutcomes?.(); unsubImportActivity?.(); windowRef?.removeEventListener?.("keydown", onToolEscape); close(); }
	return { start, destroy, open, close, refresh, refreshWorkspaceState, preview, promote, promoteRoute, setRelationDecision, reviewDatasetAssociation, chooseFiles, chooseDirectory, openObjects, createAlignment, reopenObject, handleTerminalOutcome, handleImportActivity, getState };
}

function terminalJob(detail) {
	const jobs = detail?.outcome?.jobs;
	return Array.isArray(jobs) && jobs.length ? jobs[jobs.length - 1] : null;
}

function spotObjects(state) {
	const canonical = state?.state ?? state?.payload ?? state;
	return Array.isArray(canonical?.objects) ? canonical.objects : Object.values(canonical?.objects ?? {});
}

function captureSurfaceState() {
	return {
		panels: [...document.querySelectorAll("#overlay-root > .uf-panel")].filter((panel) => !panel.hasAttribute("data-tool-surface") && !panel.classList.contains("hidden")).map((panel) => panel.id),
		cockpitCollapsed: document.getElementById("ufShell")?.classList.contains("is-cockpit-collapsed") ?? false,
	};
}
function restoreSurfaceState(snapshot) {
	if (!snapshot) return;
	for (const id of snapshot.panels) document.getElementById(id)?.classList.remove("hidden");
	document.getElementById("ufShell")?.classList.toggle("is-cockpit-collapsed", snapshot.cockpitCollapsed);
}
function configureToolSurface(surface, kind, windowRef) {
	const narrow = windowRef?.matchMedia?.("(max-width: 760px)")?.matches === true;
	surface?.setAttribute?.("role", narrow ? "dialog" : "complementary");
	surface?.setAttribute?.("aria-modal", String(narrow));
	surface?.setAttribute?.("data-tool-presentation", narrow ? "sheet" : "dock");
	const shell = document.getElementById("ufShell");
	if (shell?.dataset) {
		if (narrow && shell.dataset.toolDock === kind) delete shell.dataset.toolDock;
		else if (!narrow) shell.dataset.toolDock = kind;
	}
}
export function watchGndWorkbenchToolSurface(surface, kind, windowRef) {
	const query = windowRef?.matchMedia?.("(max-width: 760px)") ?? null;
	const apply = () => configureToolSurface(surface, kind, { matchMedia: () => query ?? { matches: false } });
	apply();
	query?.addEventListener?.("change", apply);
	if (!query?.addEventListener) query?.addListener?.(apply);
	return () => { query?.removeEventListener?.("change", apply); if (!query?.removeEventListener) query?.removeListener?.(apply); };
}
function clearToolSurface(kind) {
	const shell = document.getElementById("ufShell");
	if (shell?.dataset?.toolDock === kind) delete shell.dataset.toolDock;
}
