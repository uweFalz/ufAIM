import { getWorkspaceSelection } from "@src/shared/runtime/workspaceSelectionAccess.js";

const result = { passed: false, phase: "waiting", failures: [], creationPassed: false, constructionPassed: false, selectionPassed: false, undoPassed: false, boundaryPassed: false, restorationPassed: false, restorationDiagnostics: [], completedAt: null };
window.__alignmentCreationE2E = result;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(test, label, timeout = 30000) { const started = Date.now(); while (Date.now() - started < timeout) { if (await test()) return; await sleep(40); } throw new Error(`readiness timeout: ${JSON.stringify({ dependency: label, elapsedMs: Date.now() - started, dependencyPhase: window.__spotWorkspaceE2E?.phase ?? null, dependencyPromiseExists: Boolean(window.__spotWorkspaceE2EPromise), prerequisiteFailed: window.__spotWorkspaceE2E?.passed === false && Boolean(window.__spotWorkspaceE2E?.completedAt), runtimeSurfaces: { messaging: Boolean(window.messaging), store: Boolean(window.__ufAIM_store), alignmentCreation: Boolean(window.__ufAIM_alignmentCreation), curvatureBand: Boolean(window.__ufAIM_curvatureBand), viewer: Boolean(window.__ufAIM_viewController) } })}`); }
function unwrap(value) { return value?.state ?? value?.payload ?? value ?? null; }
function list(value) { return Array.isArray(value?.objects) ? value.objects : Object.values(value?.objects ?? {}); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); }
function same(a, b) { return JSON.stringify(stable(a)) === JSON.stringify(stable(b)); }
function assert(value, message) { if (!value) throw new Error(message); }
function alignmentIdentity(value) { return value?.spotObject?.id ?? value?.alignmentData?.id ?? null; }
async function spotObjects() { return list(unwrap(await window.messaging.sendCmdAwait("Spot.GetState", {}))); }

window.__alignmentCreationE2EPromise = (async () => {
	let snapshot = null; let historyDepth = 0;
	try {
		result.phase = "readiness";
		await waitFor(() => window.__ufAIM_alignmentCreation && window.__ufAIM_curvatureBand && window.__ufAIM_viewController && window.__ufAIM_store && window.messaging, "alignment creation runtime");
		const creation = window.__ufAIM_alignmentCreation; const store = window.__ufAIM_store;
		snapshot = { objects: structuredClone(await spotObjects()), selection: structuredClone(getWorkspaceSelection(store.getState())), teOpen: !!store.getState().te_open, aeOpen: !!store.getState().ae_open };
		historyDepth = creation.getUndoDepth();
		for (const object of await spotObjects()) await window.messaging.sendCmdAwait("Spot.RemoveObject", { objectId: object.id, source: "alignment-creation-e2e-setup" });
		store.actions?.clearWorkspaceSelection?.(); await creation.render(); assert((await spotObjects()).length === 0, "application did not reach isolated empty start");

		result.phase = "creation";
		const created = await creation.create(); const id = created?.spotObject?.id;
		assert(created?.changed && id, "native alignment creation failed"); assert(created.spotObject.crsId == null && created.spotObject.crsStatus === "local-cartesian", "created alignment is not local Cartesian");
		assert(created.alignmentData?.source?.kind === "native" && created.alignmentData?.source?.native === true, "native provenance missing");
		assert(created.alignmentData?.placement?.engineeringCrsId === "engineering-nullCRS" && created.alignmentData?.placement?.geographicOrigin == null, "truthful null-CRS placement missing");
		assert(getWorkspaceSelection(store.getState()).primaryId === id, "created alignment not selected"); result.creationPassed = true;

		result.phase = "construction";
		const straight = await creation.add("straight"); const transitionArc = await creation.add("transition");
		assert(straight?.changed && transitionArc?.changed, "straight/transition/arc construction failed");
		const types = transitionArc.alignmentData.editModel.elements.map((element) => element.type); assert(same(types, ["straight", "transition", "arc"]), "constructed sequence is incoherent");
		const beforeInvalid = structuredClone(transitionArc.alignmentData); const invalid = await creation.add("arc"); assert(invalid?.ok === false && invalid?.status === "rejected", "adjacent fixed operation lacks structured rejection");
		const afterInvalid = (await creation.getDebugState()).activeObject.data.alignmentData; assert(same(beforeInvalid, afterInvalid), "invalid operation partially mutated alignment");
		result.constructionPassed = true;

		result.phase = "selection";
		const arcId = transitionArc.alignmentData.editModel.elements.at(-1).id;
		store.actions.setWorkspaceSelection({ primaryId: id, contextIds: [], elementId: arcId, source: "alignment-creation-e2e", crsId: null });
		await window.__ufAIM_curvatureBand.refresh();
		await waitFor(() => document.querySelector(`#curvatureBand [data-element-id="${CSS.escape(arcId)}"]`) && window.__ufAIM_viewController.getDebugState?.().objectId === id, "band and viewer synchronization");
		assert(window.__ufAIM_curvatureBand.getDebugState().elementId === arcId, "CurvatureBand selection mismatch");
		const changed = await creation.updateSelectedArc(0.003); assert(changed?.changed, "permitted curvature update failed"); result.selectionPassed = true;

		result.phase = "undo";
		const elementsBeforeRemoval = structuredClone(changed.alignmentData.editModel.elements);
		const alignmentIdBeforeRemoval = alignmentIdentity(changed);
		const removed = await creation.removeSelected(); assert(removed?.changed && removed.alignmentData.editModel.elements.length === 2, "selected element removal failed");
		assert(alignmentIdentity(removed) === alignmentIdBeforeRemoval, "alignment identity changed during element removal");
		assert(same(removed.alignmentData.editModel.elements, elementsBeforeRemoval.slice(0, 2)), "unrelated elements changed during removal");
		const fallbackId = elementsBeforeRemoval[1].id;
		assert(getWorkspaceSelection(store.getState()).elementId === fallbackId, "removal fallback did not select the preceding element");
		const persistedAfterRemoval = (await creation.getDebugState()).activeObject;
		assert(persistedAfterRemoval?.data?.alignmentData?.editModel?.elements?.every((element) => element.id !== arcId), "removed element remains in authoritative SPOT state");
		assert(window.__ufAIM_curvatureBand.getDebugState().elementId === fallbackId, "CurvatureBand retained the removed selection");
		assert(window.__ufAIM_viewController.getDebugState().selectedElementId === fallbackId, "Viewer retained the removed selection");
		const undone = await creation.undo(); assert(undone?.changed && undone?.status === "undone", "structural undo failed");
		const restored = (await creation.getDebugState()).activeObject.data.alignmentData; assert(restored.editModel.elements.length === 3, "undo did not restore preceding valid state"); result.undoPassed = true;

		result.phase = "boundary";
		assert(store.getState().te_open === snapshot.teOpen, "Alignment creation changed TransEd state"); assert(store.getState().ae_open === snapshot.aeOpen, "Alignment creation opened Alignment Editor without request");
		assert(!document.getElementById("geoStage")?.classList.contains("is-geographic"), "local alignment fabricated geographic viewer state"); result.boundaryPassed = true;
		result.passed = true;
	} catch (error) { result.failures.push(String(error?.message ?? error)); }
	finally {
		result.phase = "restore";
		try {
			if (snapshot) {
				for (const object of await spotObjects()) await window.messaging.sendCmdAwait("Spot.RemoveObject", { objectId: object.id, source: "alignment-creation-e2e-cleanup" });
				if (snapshot.objects.length) await window.messaging.sendCmdAwait("Spot.AddObjects", { objects: snapshot.objects, source: "alignment-creation-e2e-restore" });
				window.__ufAIM_store.actions.setWorkspaceSelection(snapshot.selection); window.__ufAIM_alignmentCreation.restoreUndoDepth(historyDepth);
				await window.__ufAIM_alignmentCreation.render(); await window.__ufAIM_curvatureBand.refresh(); await window.__ufAIM_cockpit?.refreshSpotState?.(); window.__ufAIM_cockpit?.render?.();
				const actual = { objects: await spotObjects(), selection: getWorkspaceSelection(window.__ufAIM_store.getState()), teOpen: !!window.__ufAIM_store.getState().te_open, aeOpen: !!window.__ufAIM_store.getState().ae_open };
				if (!same(actual, snapshot)) { result.restorationDiagnostics.push({ path: "appState", expected: snapshot, actual, responsibleHarness: "alignmentCreation", timing: "after harness cleanup" }); throw new Error("alignment creation restore mismatch"); }
			}
			result.restorationPassed = true;
		} catch (error) { result.passed = false; result.failures.push(String(error?.message ?? error)); }
		result.passed = result.passed && result.restorationPassed && result.failures.length === 0; result.phase = result.passed ? "passed" : "failed"; result.completedAt = new Date().toISOString();
		console[result.passed ? "log" : "error"](`AlignmentCreation E2E ${result.passed ? "PASSED" : "FAILED"} ${JSON.stringify(result)}`);
	}
	return result;
})();
