import assert from "node:assert/strict";
import test from "node:test";
import { createAlignmentBimWorkspaceController } from "../../../app/controllers/workspace/createAlignmentBimWorkspaceController.js";

function element() {
	return {
		classList: { values: new Set(), toggle(name, force) { force ? this.values.add(name) : this.values.delete(name); }, contains(name) { return this.values.has(name); } },
		dataset: {},
		textContent: "",
		listeners: {},
		setAttribute() {},
		addEventListener(type, handler) { this.listeners[type] = handler; },
		removeEventListener(type) { delete this.listeners[type]; },
	};
}

test("physical import tracks reveal and fit the main canvas before promotion", () => {
	const shell = element();
	const status = element();
	const startSurface = element();
	const buttons = { main: element(), q: element(), l: element() };
	const state = { workspace_selection: { primaryId: null }, workspace_visible_tracks: [], preview_item: null, cursor: { s: 0 } };
	let notify = () => {};
	let fits = 0;
	const documentRef = {
		getElementById(id) { return id === "ufShell" ? shell : null; },
		querySelector(selector) {
			if (selector === "[data-workspace-view-status]") return status;
			if (selector === "[data-workspace-start-surface]") return startSurface;
			const match = selector.match(/data-workspace-view-mode="([^"]+)/);
			return match ? buttons[match[1]] : null;
		},
	};
	const controller = createAlignmentBimWorkspaceController({
		documentRef,
		threeViewer: { setWorkspaceViewMode: () => true, scheduleResize() {} },
		store: { getState: () => state, subscribe(fn) { notify = fn; return () => {}; } },
	});
	controller.setCameraCoordinator({ fitActive() { fits += 1; return true; }, getDebugState: () => ({}) });
	controller.start();
	assert.equal(shell.dataset.workspaceEmpty, "true");
	assert.equal(startSurface.classList.contains("hidden"), false);
	const fitsBeforeImport = fits;
	state.workspace_visible_tracks = [{ id: "import-track", polyline2d: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }];
	notify();
	assert.equal(shell.dataset.workspaceEmpty, "false");
	assert.equal(startSurface.classList.contains("hidden"), true);
	assert.match(status.textContent, /Importgeometrie/);
	assert.equal(fits, fitsBeforeImport + 1);
});

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
