import { getLanguage } from "@app/i18n/strings.js";
import { getWorkspaceSelection } from "@src/shared/runtime/workspaceSelectionAccess.js";

const result = { passed: false, phase: "waiting", failures: [], levelsCovered: [], selectionPassed: false, separatorInteractionPassed: false, restoredRendererRecoveryPassed: false, rendererCollapseRecoveryPassed: false, editingPassed: false, comparePassed: false, languagePassed: false, boundaryPassed: false, restorationPassed: false, restorationDiagnostics: [], completedAt: null };
window.__transEdDepthE2E = result;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(test, label, timeout = 30000) { const started = Date.now(); while (Date.now() - started < timeout) { if (await test()) return; await sleep(40); } throw new Error(`readiness timeout: ${JSON.stringify({ dependency: label, elapsedMs: Date.now() - started, dependencyPhase: window.__alignmentCreationE2E?.phase ?? null, dependencyPromiseExists: Boolean(window.__alignmentCreationE2EPromise), prerequisiteFailed: window.__alignmentCreationE2E?.passed === false && Boolean(window.__alignmentCreationE2E?.completedAt), runtimeSurfaces: { messaging: Boolean(window.messaging), store: Boolean(window.__ufAIM_store), transEd: Boolean(window.__ufAIM_teBridge) } })}`); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function assert(value, message) { if (!value) throw new Error(message); }
function unwrap(value) { return value?.state ?? value?.payload ?? value ?? null; }
async function language(lang) {
	if (getLanguage() === lang) return;
	document.getElementById("btnLang")?.click();
	const option = document.querySelector(`[data-lang-code="${CSS.escape(lang)}"]`);
	assert(option, `language ${lang} unavailable`); option.click();
	await waitFor(() => getLanguage() === lang && document.documentElement.lang === lang, `${lang} language activation`);
}

window.__transEdDepthE2EPromise = (async () => {
	let snapshot = null; let editedId = null;
	try {
		result.phase = "readiness";
		await waitFor(() => window.__alignmentCreationE2E?.completedAt && window.__ufAIM_teBridge && window.__ufAIM_store && window.messaging, "Alignment Creation completion and TransEd runtime");
		const bridge = window.__ufAIM_teBridge; const store = window.__ufAIM_store;
		const catalogueBefore = await window.messaging.sendCmdAwait("Transition.GetCatalogue", {});
		snapshot = { ui: bridge.snapshotState(), language: getLanguage(), selection: structuredClone(getWorkspaceSelection(store.getState())), aeOpen: !!store.getState().ae_open, objects: structuredClone(unwrap(await window.messaging.sendCmdAwait("Spot.GetState", {}))?.objects ?? []) };

		result.phase = "catalogue"; await bridge.open();
		for (const level of catalogueBefore.levels.map((entry) => entry.id)) { assert(await bridge.selectLevel(level), `unreachable level ${level}`); result.levelsCovered.push(level); }
		assert(same(result.levelsCovered, ["constant", "simpleFcn", "protoFcn", "halfWave", "transition"]), "not all transitionDB levels covered");

		result.phase = "selection"; editedId = catalogueBefore.records.transition.find((entry) => !catalogueBefore.workingCopyIds.includes(entry.id))?.id;
		assert(editedId, "no clean transition record available"); await bridge.selectLevel("transition"); await bridge.selectRecord(editedId);
		const state = bridge.getDebugState(); assert(state.recordId === editedId && document.getElementById("teRecordTitle")?.textContent, "selection did not propagate to details");
		assert(document.getElementById("transBoard")?.children.length > 0, "selected transition has no graph"); result.selectionPassed = true;
		assert(!document.querySelector('#teW1[type="range"], #teW2[type="range"]'), "standalone w1/w2 sliders remain in normal UI");
		const hostRectBeforeDrag = document.getElementById("transBoard").getBoundingClientRect();
		const w1Separator = document.querySelector('[data-transed-separator="w1"]');
		assert(w1Separator?.getAttribute("role") === "slider", "w1 plot separator is not keyboard accessible");
		const dragX = hostRectBeforeDrag.left + ((0.3 + 0.05) / 1.1) * hostRectBeforeDrag.width;
		for (const type of ["pointerdown", "pointermove", "pointerup"]) {
			w1Separator.dispatchEvent(new PointerEvent(type, {
				bubbles: true,
				pointerId: 501,
				pointerType: "mouse",
				clientX: dragX,
				clientY: hostRectBeforeDrag.top + hostRectBeforeDrag.height / 2,
				buttons: type === "pointerup" ? 0 : 1,
			}));
		}
		await waitFor(() => Math.abs(Number(store.getState().te_w1) - 0.3) < 0.01, "w1 separator drag state");
		assert(Number(store.getState().te_w1) <= Number(store.getState().te_w2), "separator drag violated w1 <= w2");
		const beyondW2X = hostRectBeforeDrag.right + 100;
		for (const type of ["pointerdown", "pointermove", "pointerup"]) {
			w1Separator.dispatchEvent(new PointerEvent(type, {
				bubbles: true,
				pointerId: 502,
				pointerType: "mouse",
				clientX: beyondW2X,
				clientY: hostRectBeforeDrag.top + hostRectBeforeDrag.height / 2,
				buttons: type === "pointerup" ? 0 : 1,
			}));
		}
		await waitFor(() => Number(store.getState().te_w1) === Number(store.getState().te_w2), "w1 separator upper-order clamp");
		const numericW1 = document.getElementById("teW1");
		numericW1.value = "0.200";
		numericW1.dispatchEvent(new Event("input", { bubbles: true }));
		await waitFor(() => Math.abs(Number(store.getState().te_w1) - 0.2) < 0.001, "numeric w1 edit state");
		await waitFor(() => {
			const boardRect = document.getElementById("transBoard").getBoundingClientRect();
			const separatorRect = document.querySelector('[data-transed-separator="w1"]')?.getBoundingClientRect();
			const expectedX = boardRect.left + ((0.2 + 0.05) / 1.1) * boardRect.width;
			return separatorRect && Math.abs(separatorRect.left - expectedX) < 8;
		}, "numeric w1 edit separator synchronization");
		assert(document.querySelector('[data-transed-plot-role="primary-function-renderer"]')?.getBoundingClientRect().width > 200, "plot collapsed after separator interaction");
		result.separatorInteractionPassed = true;
		const ownedHost = document.getElementById("transBoard");
		const restoredHost = ownedHost.cloneNode(false);
		restoredHost.style.width = "1px";
		restoredHost.style.height = "1px";
		ownedHost.replaceWith(restoredHost);
		await bridge.open();
		await waitFor(() => {
			const host = document.getElementById("transBoard");
			const renderer = host?.querySelector(":scope > svg, :scope > canvas");
			const hostRect = host?.getBoundingClientRect();
			const rendererRect = renderer?.getBoundingClientRect();
			return host !== ownedHost
				&& hostRect?.width > 200
				&& hostRect?.height > 180
				&& rendererRect?.width > 200
				&& rendererRect?.height > 180;
		}, "TransEd recovery from restored 1x1 renderer host");
		result.restoredRendererRecoveryPassed = true;
		const activeHost = document.getElementById("transBoard");
		const collapsedRenderer = activeHost.querySelector(":scope > svg, :scope > canvas");
		assert(collapsedRenderer, "primary function renderer missing before collapse regression");
		collapsedRenderer.style.width = "1px";
		collapsedRenderer.style.height = "1px";
		collapsedRenderer.setAttribute("width", "1");
		collapsedRenderer.setAttribute("height", "1");
		await waitFor(() => {
			const host = document.getElementById("transBoard");
			const renderer = host?.querySelector(":scope > svg, :scope > canvas");
			const rendererRect = renderer?.getBoundingClientRect();
			return renderer !== collapsedRenderer
				&& renderer?.dataset.transedPlotRole === "primary-function-renderer"
				&& rendererRect?.width > 200
				&& rendererRect?.height > 180;
		}, "TransEd recovery from post-initialization 1x1 function renderer");
		result.rendererCollapseRecoveryPassed = true;

		result.phase = "editing"; const original = catalogueBefore.records.transition.find((entry) => entry.id === editedId).value.normLengthPartition;
		const valid = [0.2, 0.6, 0.2]; const applied = await bridge.applyWorkingCopy(valid); assert(applied.ok, "valid owning-level edit rejected");
		const rejected = await bridge.applyWorkingCopy([0.2, 0.2, 0.2]); assert(rejected.ok === false && rejected.code === "TRANSITION_PARTITION_INVALID", "invalid edit lacks structured rejection");
		const afterReject = await window.messaging.sendCmdAwait("Transition.GetPresetSpec", { presetId: editedId }); assert(same(afterReject.descriptor.normLengthPartition, valid), "invalid edit mutated working copy");
		await bridge.resetWorkingCopy(); const reset = await window.messaging.sendCmdAwait("Transition.GetPresetSpec", { presetId: editedId }); assert(same(reset.descriptor.normLengthPartition, original), "reset did not restore database state"); result.editingPassed = true;

		result.phase = "compare"; const comparison = await bridge.renderCompare(); assert(comparison?.primary?.presetId !== comparison?.secondary?.presetId, "compare does not use two genuine records"); assert(same(comparison.modes, ["k", "k1", "k2"]), "compare omits derivative modes"); result.comparePassed = true;

		result.phase = "language"; await language("en"); await waitFor(() => document.getElementById("teBreadcrumb")?.textContent?.startsWith("Catalogue"), "English TransEd refresh"); await language("de"); await waitFor(() => document.getElementById("teBreadcrumb")?.textContent?.startsWith("Katalog"), "German TransEd refresh"); result.languagePassed = true;

		result.phase = "boundary"; assert(same(getWorkspaceSelection(store.getState()), snapshot.selection), "TransEd changed SPOT selection"); assert(same(unwrap(await window.messaging.sendCmdAwait("Spot.GetState", {}))?.objects ?? [], snapshot.objects), "TransEd changed SPOT objects"); assert(!!store.getState().ae_open === snapshot.aeOpen, "TransEd changed Alignment Editor state"); assert(!document.querySelector("#transOverlay #alignmentEditorOverlay, #transOverlay [data-alignment-editor]"), "Alignment Editor DOM found inside TransEd"); result.boundaryPassed = true;
		result.passed = true;
	} catch (error) { result.failures.push(String(error?.message ?? error)); }
	finally {
		result.phase = "restore";
		try {
			if (editedId) await window.__ufAIM_teBridge?.resetWorkingCopy?.();
			if (snapshot) { await language(snapshot.language); await window.__ufAIM_teBridge?.restoreState?.(snapshot.ui); }
			const actual = snapshot ? { selection: getWorkspaceSelection(window.__ufAIM_store.getState()), aeOpen: !!window.__ufAIM_store.getState().ae_open, language: getLanguage(), ui: window.__ufAIM_teBridge.snapshotState() } : null;
			const expected = snapshot ? { selection: snapshot.selection, aeOpen: snapshot.aeOpen, language: snapshot.language, ui: snapshot.ui } : null;
			if (!same(actual, expected)) { result.restorationDiagnostics.push({ path: "transEdState", expected, actual, responsibleHarness: "transEdDepth", timing: "after harness cleanup" }); throw new Error("TransEd state restore mismatch"); }
			result.restorationPassed = true;
		} catch (error) { result.passed = false; result.failures.push(String(error?.message ?? error)); }
		result.passed = result.passed && result.restorationPassed && result.failures.length === 0; result.phase = result.passed ? "passed" : "failed"; result.completedAt = new Date().toISOString();
		console[result.passed ? "log" : "error"](`TransEdDepth E2E ${result.passed ? "PASSED" : "FAILED"} ${JSON.stringify(result)}`);
	}
	return result;
})();
