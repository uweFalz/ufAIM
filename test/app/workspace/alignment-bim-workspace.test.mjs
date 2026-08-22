import assert from "node:assert/strict";
import test from "node:test";
import { createAlignmentBimWorkspaceController } from "../../../app/controllers/workspace/createAlignmentBimWorkspaceController.js";

function element() {
	return {
		classList: { toggle() {} },
		dataset: {},
		textContent: "",
		listeners: {},
		setAttribute() {},
		addEventListener(type, handler) { this.listeners[type] = handler; },
		removeEventListener(type) { delete this.listeners[type]; },
	};
}

test("workspace modes keep Main, q and L as views over one runtime", () => {
	const shell = element();
	const status = element();
	const buttons = { main: element(), q: element(), l: element() };
	const calls = [];
	const documentRef = {
		getElementById(id) { return id === "ufShell" ? shell : null; },
		querySelector(selector) {
			if (selector === "[data-workspace-view-status]") return status;
			const match = selector.match(/data-workspace-view-mode="([^"]+)/);
			return match ? buttons[match[1]] : null;
		},
	};
	const controller = createAlignmentBimWorkspaceController({
		documentRef,
		threeViewer: {
			setWorkspaceViewMode(mode) { calls.push(mode); return mode !== "q" || calls.length > 2; },
			scheduleResize() {},
		},
	});
	controller.start();
	assert.equal(controller.getActiveMode(), "main");
	assert.equal(controller.activate("q"), false);
	assert.equal(controller.getActiveMode(), "main");
	assert.match(status.textContent, /aktive Alignment-Geometrie/);
	assert.equal(controller.activate("l"), true);
	assert.equal(shell.dataset.workspaceView, "l");
	assert.equal(controller.activate("q"), true);
	assert.equal(shell.dataset.workspaceView, "q");
});
