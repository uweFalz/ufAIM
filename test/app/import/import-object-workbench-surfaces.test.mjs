import assert from "node:assert/strict";
import test from "node:test";
import { makeGndImportWorkbenchController } from "../../../app/gndImportWorkbench/gndImportWorkbenchController.js";

function installDocument() {
	class Node {
		constructor() { this.children = []; this.dataset = {}; this.className = ""; this.textContent = ""; this.childElementCount = 0; }
		append(...children) { this.children.push(...children); this.childElementCount = this.children.length; }
		replaceChildren(...children) { this.children = [...children]; this.childElementCount = this.children.length; }
		setAttribute(name, value) { if (name.startsWith("data-")) this.dataset[name.slice(5)] = String(value); }
		addEventListener() {}
		querySelector() { return null; }
	}
	const makeClasses = (...initial) => { const values = new Set(initial); return { add: (v) => values.add(v), remove: (v) => values.delete(v), contains: (v) => values.has(v), toggle(v, force) { if (force) values.add(v); else values.delete(v); } }; };
	const overlay = { classList: makeClasses("hidden") };
	const objectsOverlay = { classList: makeClasses("hidden") };
	const shell = { classList: makeClasses("is-cockpit-collapsed") };
	let objectsClicks = 0, cockpitClicks = 0;
	const ids = {
		gndImportWorkbenchOverlay: overlay,
		gndImportWorkbenchBody: new Node(),
		spotOverlay: objectsOverlay,
		ufShell: shell,
		btnSpot: { click() { objectsClicks += 1; objectsOverlay.classList.remove("hidden"); }, addEventListener() {} },
		btnCockpit: { click() { cockpitClicks += 1; shell.classList.remove("is-cockpit-collapsed"); }, addEventListener() {} },
	};
	globalThis.document = {
		documentElement: { style: {}, dataset: {} },
		createElement: () => new Node(), createDocumentFragment: () => new Node(), querySelectorAll: () => [],
		getElementById: (id) => ids[id] ?? null,
	};
	globalThis.window = { addEventListener() {} };
	return { overlay, objectsOverlay, shell, counts: () => ({ objectsClicks, cockpitClicks }) };
}

test("verified explicit promotion opens Objects and Cockpit on the same canonical identity", async () => {
	const surfaces = installDocument();
	let accepted = false, cockpitRefreshes = 0;
	const item = { id: "IMPORT-A1", evidenceId: "E1", status: { promotable: true } };
	const canonical = { id: "SPOT-A1", meta: { importItemId: "IMPORT-A1" } };
	const messaging = { async sendCmdAwait(name) {
		if (name === "Import.GetState") return { items: [item], rejectedItems: [] };
		if (name === "Import.GetResultEvidence") return { records: [] };
		if (name === "Spot.GetState") return { objects: accepted ? [canonical] : [] };
		throw new Error(name);
	} };
	const cockpit = {
		async refreshImportState() {},
		async acceptImportItem(id, { show }) { assert.equal(id, "IMPORT-A1"); assert.equal(show, true); accepted = true; return true; },
		async refreshAll() { cockpitRefreshes += 1; },
	};
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging, cockpit });
	await controller.refresh();
	assert.equal(await controller.promote("IMPORT-A1"), "SPOT-A1");
	assert.equal(controller.getState().promotedObjectId, "SPOT-A1");
	assert.equal(cockpitRefreshes, 1);
	assert.equal(surfaces.overlay.classList.contains("hidden"), true);
	assert.equal(surfaces.objectsOverlay.classList.contains("hidden"), false);
	assert.equal(surfaces.shell.classList.contains("is-cockpit-collapsed"), false);
	assert.deepEqual(surfaces.counts(), { objectsClicks: 1, cockpitClicks: 1 });
});

test("failed canonical readback opens no object surface and reports no false success", async () => {
	const surfaces = installDocument();
	const item = { id: "IMPORT-A1", status: { promotable: true } };
	const messaging = { async sendCmdAwait(name) { if (name === "Import.GetState") return { items: [item], rejectedItems: [] }; if (name === "Import.GetResultEvidence") return { records: [] }; if (name === "Spot.GetState") return { objects: [] }; } };
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging, cockpit: { async refreshImportState() {}, async acceptImportItem() { return true; } } });
	await controller.refresh();
	assert.equal(await controller.promote("IMPORT-A1"), false);
	assert.deepEqual(surfaces.counts(), { objectsClicks: 0, cockpitClicks: 0 });
});
