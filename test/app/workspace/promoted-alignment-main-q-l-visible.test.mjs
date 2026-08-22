import assert from "node:assert/strict";
import test from "node:test";
import { createAlignmentBimWorkspaceController } from "../../../app/controllers/workspace/createAlignmentBimWorkspaceController.js";

function element() {
	return { classList: { toggle() {} }, dataset: {}, textContent: "", setAttribute() {}, addEventListener() {}, removeEventListener() {} };
}

test("Main q and L expose the same raw Alignment identity and shared s", () => {
	const shell = element(), status = element();
	const buttons = { main: element(), q: element(), l: element() };
	let listener;
	const state = { workspace_selection: { primaryId: "ALIGN-7" }, cursor: { s: 24.733637747336378 } };
	const controller = createAlignmentBimWorkspaceController({
		documentRef: {
			getElementById: () => shell,
			querySelector(selector) {
				if (selector === "[data-workspace-view-status]") return status;
				const mode = selector.match(/data-workspace-view-mode="([^"]+)/)?.[1];
				return buttons[mode] ?? null;
			},
		},
		threeViewer: { setWorkspaceViewMode: () => true, scheduleResize() {} },
		store: { getState: () => state, subscribe(fn) { listener = fn; return () => {}; } },
	});
	controller.start();
	assert.equal(status.textContent, "World / Map · ALIGN-7 · s 24.733637747336378");
	controller.activate("q");
	assert.equal(status.textContent, "Alignment / Lok-View · ALIGN-7 · s 24.733637747336378");
	state.cursor.s = 75;
	listener();
	controller.activate("l");
	assert.equal(status.textContent, "Intrinsic alignment bands · ALIGN-7 · s 75");
});
