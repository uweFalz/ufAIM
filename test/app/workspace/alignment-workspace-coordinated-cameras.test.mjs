import assert from "node:assert/strict";
import test from "node:test";
import { createAlignmentBimWorkspaceController } from "../../../app/controllers/workspace/createAlignmentBimWorkspaceController.js";

function element() {
	return { dataset: {}, textContent: "", classList: { toggle() {} }, setAttribute() {}, addEventListener() {}, removeEventListener() {} };
}

test("Main q and L coordinate one canonical identity and cursor without rewriting either", async () => {
	const previousRaf = globalThis.requestAnimationFrame;
	globalThis.requestAnimationFrame = (fn) => { fn(); return 1; };
	try {
		const shell = element(), status = element(), buttons = { main: element(), q: element(), l: element() };
		const state = { workspace_selection: { primaryId: "A" }, cursor: { s: 25 } };
		let notify = () => {};
		const cameraCalls = [], viewerCalls = [];
		const controller = createAlignmentBimWorkspaceController({
			documentRef: { getElementById: () => shell, querySelector(selector) { if (selector === "[data-workspace-view-status]") return status; return buttons[selector.match(/data-workspace-view-mode="([^"]+)/)?.[1]] ?? null; } },
			threeViewer: { setWorkspaceViewMode(mode) { viewerCalls.push(mode); return true; }, scheduleResize() {} },
			store: { getState: () => state, subscribe(fn) { notify = fn; return () => {}; } },
		});
		controller.setCameraCoordinator({ fitActive(options) { cameraCalls.push(options); return true; }, getDebugState() { return { georeference: { validationStatus: "qualified", resolvedEpsg: "EPSG:5683" } }; } });
		controller.start();
		controller.activate("q");
		state.cursor.s = 75; notify();
		controller.activate("l");
		assert.equal(state.workspace_selection.primaryId, "A");
		assert.equal(state.cursor.s, 75);
		assert.ok(viewerCalls.filter((mode) => mode === "q").length >= 2, "q camera must follow the shared cursor");
		assert.deepEqual(cameraCalls.at(-1), { includePins: false, includeChunks: false, includeContext: false });
		assert.match(status.textContent, /A · s 75/);
		assert.equal(status.dataset.workspaceCameraContext, "intrinsic s");
	} finally { globalThis.requestAnimationFrame = previousRaf; }
});

test("object change refits the complete active Alignment exactly through the existing view service", () => {
	const shell = element(), status = element(), buttons = { main: element(), q: element(), l: element() };
	const state = { workspace_selection: { primaryId: "A" }, cursor: { s: 0 } }; let notify;
	let fits = 0;
	const controller = createAlignmentBimWorkspaceController({ documentRef: { getElementById: () => shell, querySelector(selector) { if (selector === "[data-workspace-view-status]") return status; return buttons[selector.match(/data-workspace-view-mode="([^"]+)/)?.[1]] ?? null; } }, threeViewer: { setWorkspaceViewMode: () => true, scheduleResize() {} }, store: { getState: () => state, subscribe(fn) { notify = fn; return () => {}; } } });
	controller.setCameraCoordinator({ fitActive() { fits += 1; return true; }, getDebugState: () => ({}) });
	controller.start(); const afterStart = fits;
	state.cursor.s = 10; notify(); assert.equal(fits, afterStart);
	state.workspace_selection.primaryId = "B"; notify(); assert.equal(fits, afterStart + 1);
});
