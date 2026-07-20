import { createAlignmentSpotObject } from "@src/model/spot/model/createAlignmentSpotObject.js";
import { buildSparseFromEditModel } from "@src/domain/alignment/editor/buildSparseAlignment.js";
import { getWorkspacePrimaryId } from "@src/shared/runtime/workspaceSelectionAccess.js";

const result = { passed: false, phase: "waiting", failures: [], fixtureId: null, completedAt: null };
window.__curvatureBandE2E = result;
const runtimeErrors = [];
const onRuntimeError = (event) => {
	const message = String(event?.error?.stack ?? event?.message ?? "");
	if (message.includes("curvatureBandController") || message.includes("CurvatureBand")) runtimeErrors.push(message);
};
const onUnhandledRejection = (event) => {
	const message = String(event?.reason?.stack ?? event?.reason ?? "");
	if (message.includes("curvatureBandController") || message.includes("CurvatureBand")) runtimeErrors.push(message);
};
window.addEventListener("error", onRuntimeError);
window.addEventListener("unhandledrejection", onUnhandledRejection);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeoutMs = 15000) { const started = Date.now(); while (Date.now() - started < timeoutMs) { if (await Promise.resolve(predicate())) return; await sleep(35); } throw new Error(`timeout waiting for ${label}`); }
function assert(condition, message) { if (!condition) throw new Error(`CurvatureBand E2E: ${message}`); }
function unwrap(raw) { return raw?.state ?? raw?.payload ?? raw ?? null; }
async function readObject(messaging, id) { const state = unwrap(await messaging.sendCmdAwait("Spot.GetState", {})); const objects = Array.isArray(state?.objects) ? state.objects : Object.values(state?.objects ?? {}); return objects.find((o) => String(o?.id) === String(id)) ?? null; }
function pointer(type, y, pointerId = 71) { return new PointerEvent(type, { bubbles: true, clientX: 400, clientY: y, pointerId, pointerType: "mouse", buttons: type === "pointerup" ? 0 : 1 }); }

(async function runCurvatureBandE2E() {
	try {
		await waitFor(() => window.__geoRuntimeAcceptanceE2E?.completedAt, "prior Geo acceptance completion", 30000);
		await waitFor(() => window.__ufAIM_curvatureBand && window.__ufAIM_store && window.messaging, "curvature-band runtime");
		result.phase = "fixture";
		const id = `curvature_band_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
		result.fixtureId = id;
		const alignmentData = { type: "AlignmentData", id, name: "Curvature band E2E", source: { kind: "import-compatible-synthetic" }, editModel: { startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }, elements: [
			{ id: "S0", type: "straight", parameters: { length: 80 }, length: 80 },
			{ id: "T1", type: "transition", parameters: { length: 35, transitionType: "clothoid" }, length: 35, transitionType: "clothoid" },
			{ id: "A2", type: "arc", parameters: { length: 100, curvature: 1 / 300 }, length: 100, curvature: 1 / 300 },
		] } };
		const sparse = buildSparseFromEditModel(alignmentData); alignmentData.sparseAlignment = sparse;
		const object = createAlignmentSpotObject({ id, name: alignmentData.name, kernel: sparse, sparseAlignment: sparse, alignmentData, meta: { source: alignmentData.source } });
		await window.messaging.sendCmdAwait("Spot.AddObjects", { objects: [object] });
		window.__ufAIM_store.actions.setWorkspacePrimary({ objectId: id, source: "curvature-band-e2e" });
		await waitFor(() => getWorkspacePrimaryId(window.__ufAIM_store.getState()) === id && document.querySelector('[data-element-id="A2"]'), "band fixture rendering");

		result.phase = "selection";
		let arc = document.querySelector('[data-element-id="A2"]');
		arc.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		arc.dispatchEvent(pointer("pointerdown", 80));
		assert(window.__ufAIM_curvatureBand.getDebugState().dragging, "pointer-down starts an edit session");
		assert(window.__ufAIM_store.getState().workspace_selection.elementId === "A2", "arc plateau selects stable A2");
		window.dispatchEvent(pointer("pointermove", 20, 999));
		window.dispatchEvent(pointer("pointerup", 20, 999));
		assert(window.__ufAIM_curvatureBand.getDebugState().dragging && !window.__ufAIM_store.getState().preview_item, "non-owning pointer cannot move or finish the session");
		const signatureBefore = window.__ufAIM_viewController.getDebugState().projectionSignature;
		window.dispatchEvent(pointer("pointermove", 35));
		await waitFor(() => window.__ufAIM_store.getState().preview_source?.type === "curvature-band", "domain preview session");
		await waitFor(() => window.__ufAIM_viewController.getDebugState().projectionSignature !== signatureBefore, "coupled plan preview refresh");
		assert(window.__ufAIM_curvatureBand.getDebugState().curvature > 1 / 300, "upward drag increases positive curvature");

		result.phase = "cancel";
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		await waitFor(() => !window.__ufAIM_store.getState().preview_item, "preview cancellation");
		assert(!window.__ufAIM_curvatureBand.getDebugState().dragging, "Escape ends the owned pointer session");
		let persisted = await readObject(window.messaging, id);
		assert(Math.abs(persisted.data.alignmentData.editModel.elements.find((e) => e.id === "A2").parameters.curvature - 1 / 300) < 1e-12, "Escape leaves persisted curvature unchanged");

		result.phase = "pointer-cancel";
		arc = document.querySelector('[data-element-id="A2"]');
		arc.dispatchEvent(pointer("pointerdown", 75, 74));
		window.dispatchEvent(pointer("pointermove", 40, 74));
		await waitFor(() => Boolean(window.__ufAIM_store.getState().preview_item), "pointer-cancel preview");
		window.dispatchEvent(pointer("pointercancel", 40, 74));
		await waitFor(() => !window.__ufAIM_store.getState().preview_item && !window.__ufAIM_curvatureBand.getDebugState().dragging, "pointer cancellation cleanup");
		persisted = await readObject(window.messaging, id);
		assert(Math.abs(persisted.data.alignmentData.editModel.elements.find((e) => e.id === "A2").parameters.curvature - 1 / 300) < 1e-12, "pointer cancellation does not persist");

		result.phase = "lost-capture";
		arc = document.querySelector('[data-element-id="A2"]');
		const bandSvg = document.getElementById("curvatureBandSvg");
		const captureMethods = { set: bandSvg.setPointerCapture, has: bandSvg.hasPointerCapture, release: bandSvg.releasePointerCapture };
		try {
			bandSvg.setPointerCapture = () => {};
			bandSvg.hasPointerCapture = () => true;
			bandSvg.releasePointerCapture = () => {};
			arc.dispatchEvent(pointer("pointerdown", 75, 75));
			window.dispatchEvent(pointer("pointermove", 45, 75));
			await waitFor(() => Boolean(window.__ufAIM_store.getState().preview_item), "lost-capture preview");
			bandSvg.dispatchEvent(pointer("lostpointercapture", 45, 75));
			await waitFor(() => !window.__ufAIM_store.getState().preview_item && !window.__ufAIM_curvatureBand.getDebugState().dragging, "lost-capture cleanup");
		} finally {
			bandSvg.setPointerCapture = captureMethods.set;
			bandSvg.hasPointerCapture = captureMethods.has;
			bandSvg.releasePointerCapture = captureMethods.release;
		}
		persisted = await readObject(window.messaging, id);
		assert(Math.abs(persisted.data.alignmentData.editModel.elements.find((e) => e.id === "A2").parameters.curvature - 1 / 300) < 1e-12, "lost capture does not persist");

		result.phase = "signed-commit";
		arc = document.querySelector('[data-element-id="A2"]');
		arc.dispatchEvent(pointer("pointerdown", 70, 72));
		window.dispatchEvent(pointer("pointermove", 260, 72));
		await waitFor(() => window.__ufAIM_curvatureBand.getDebugState().curvature < 0, "signed negative preview");
		window.dispatchEvent(pointer("pointerup", 260, 72));
		await waitFor(async () => (await readObject(window.messaging, id))?.data?.alignmentData?.editModel?.elements?.find((e) => e.id === "A2")?.parameters?.curvature < 0, "signed curvature commit");
		persisted = await readObject(window.messaging, id);
		assert(persisted.data.alignmentData.editModel.elements.find((e) => e.id === "A2").id === "A2", "element identity remains stable");
		assert(window.__ufAIM_store.getState().workspace_selection.elementId === "A2", "selection remains stable after commit");
		assert(runtimeErrors.length === 0, `no uncaught curvature-band runtime errors: ${runtimeErrors.join(" | ")}`);

		result.phase = "import-equivalence";
		const importedId = `${id}_imported`;
		const imported = createAlignmentSpotObject({ id: importedId, name: "Imported curvature band E2E", kernel: sparse, sparseAlignment: sparse, alignmentData: null, meta: { source: { kind: "import", format: "synthetic" } } });
		await window.messaging.sendCmdAwait("Spot.AddObjects", { objects: [imported] });
		window.__ufAIM_store.actions.setWorkspacePrimary({ objectId: importedId, source: "curvature-band-e2e-import" });
		await waitFor(() => document.querySelector('[data-element-id="A2"]') && window.__ufAIM_curvatureBand.getDebugState().activeObjectId === importedId, "imported alignment band rendering");
		arc = document.querySelector('[data-element-id="A2"]');
		arc.dispatchEvent(pointer("pointerdown", 80, 73));
		window.dispatchEvent(pointer("pointermove", 45, 73));
		window.dispatchEvent(pointer("pointerup", 45, 73));
		await waitFor(async () => Boolean((await readObject(window.messaging, importedId))?.data?.alignmentData?.editModel), "imported alignment materialized commit");
		const importedCommitted = await readObject(window.messaging, importedId);
		assert(importedCommitted.data.alignmentData.editModel.elements.find((e) => e.id === "A2")?.id === "A2", "imported edit preserves element identity");
		result.passed = true; result.phase = "complete";
	} catch (error) { const message = String(error?.message ?? error); result.failures.push({ phase: result.phase, message }); result.error = message; }
	finally {
		window.removeEventListener("error", onRuntimeError);
		window.removeEventListener("unhandledrejection", onUnhandledRejection);
		if (runtimeErrors.length) {
			result.passed = false;
			for (const message of runtimeErrors) result.failures.push({ phase: result.phase, message });
		}
		result.completedAt = new Date().toISOString();
		console.log(`CurvatureBand E2E RESULT ${JSON.stringify(result)}`);
		console[result.passed ? "log" : "error"](`CurvatureBand E2E ${result.passed ? "PASSED" : "FAILED"}`);
	}
})();
