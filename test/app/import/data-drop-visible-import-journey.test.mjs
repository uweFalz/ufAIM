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
	const classes = new Set(["hidden"]);
	const classList = { add(value) { classes.add(value); }, remove(value) { classes.delete(value); }, contains(value) { return classes.has(value); }, toggle(value, force) { if (force) classes.add(value); else classes.delete(value); } };
	const overlay = { classList };
	const root = new Node();
	globalThis.document = {
		documentElement: { style: { outline: "", outlineOffset: "" }, dataset: {} },
		createElement: () => new Node(),
		createDocumentFragment: () => new Node(),
		querySelectorAll: () => [],
		getElementById(id) { if (id === "gndImportWorkbenchOverlay") return overlay; if (id === "gndImportWorkbenchBody") return root; return null; },
	};
	globalThis.window = { addEventListener() {} };
	return { overlay, root };
}

function textOf(node) { return `${node?.textContent ?? ""} ${(node?.children ?? []).map(textOf).join(" ")}`; }

test("drag and drop activity opens an immediate visible target and acknowledges exact files", () => {
	const { overlay } = installDocument();
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging: {}, cockpit: {} });
	controller.start();
	controller.handleImportActivity(Object.freeze({ state: "drag-active", fileCount: 0 }));
	assert.equal(overlay.classList.contains("hidden"), false);
	assert.equal(document.documentElement.dataset.importDragActive, "true");
	assert.equal(document.documentElement.style.outline, "4px solid #00d4ff");
	assert.equal(controller.getState().dropState.state, "drag-active");
	controller.handleImportActivity(Object.freeze({ state: "accepted", fileCount: 2, fileNames: Object.freeze(["one.mdb", "two.xyz"]), job: null }));
	assert.equal(document.documentElement.dataset.importDragActive, undefined);
	assert.equal(document.documentElement.style.outline, "");
	const state = controller.getState();
	assert.equal(state.lifecycle.state, "accepted");
	assert.deepEqual(state.lifecycle.fileNames, ["one.mdb", "two.xyz"]);
	assert.deepEqual(state.fileOutcomes, []);
});

test("nested drag activity does not stack the frame and idle or destroy always restores it", () => {
	installDocument();
	document.documentElement.style.outline = "1px solid black";
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging: {}, cockpit: {} });
	controller.start();
	controller.handleImportActivity({ state: "drag-active" });
	controller.handleImportActivity({ state: "drag-active" });
	assert.equal(document.documentElement.style.outline, "4px solid #00d4ff");
	controller.handleImportActivity({ state: "idle" });
	assert.equal(document.documentElement.style.outline, "1px solid black");
	controller.handleImportActivity({ state: "drag-active" });
	controller.destroy();
	assert.equal(document.documentElement.style.outline, "1px solid black");
	assert.equal(document.documentElement.dataset.importDragActive, undefined);
});

test("processing exposes exact ImportJob phase and heartbeat while terminal evidence survives idle", async () => {
	installDocument();
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging: { async sendCmdAwait(name) { return name === "Import.GetState" ? { items: [], rejectedItems: [] } : { records: [] }; } }, cockpit: {} });
	controller.handleImportActivity(Object.freeze({ state: "processing", fileCount: 1, fileNames: ["slow.mdb"], job: { phase: "extracting", heartbeatAt: "2026-08-06T00:00:01.000Z" } }));
	assert.equal(controller.getState().jobSnapshot.phase, "extracting");
	assert.equal(controller.getState().jobSnapshot.heartbeatAt, "2026-08-06T00:00:01.000Z");
	const outcome = Object.freeze({ fileName: "slow.mdb", parserId: "gndEdit", status: "partial", reason: "conflicting-evidence", itemCount: 1, rejectedCount: 1, evidencePublished: true });
	await controller.handleTerminalOutcome(Object.freeze({ state: "completed", fileCount: 1, fileNames: ["slow.mdb"], outcome: { fileOutcomes: [outcome], jobs: [{ phase: "succeeded", heartbeatAt: "2026-08-06T00:00:02.000Z" }] } }));
	controller.handleImportActivity(Object.freeze({ state: "idle" }));
	assert.equal(controller.getState().lifecycle.state, "completed");
	assert.deepEqual(controller.getState().fileOutcomes, [outcome]);
});

test("large Workbench refresh is single-flight and renders compact 422-item state", async () => {
	const { root } = installDocument();
	const items = Array.from({ length: 422 }, (_, index) => ({ id: `I${index + 1}`, evidenceId: "E1", evidenceItemId: `Q${index + 1}`, kind: "alignment", source: { objectName: `Alignment ${index + 1}` }, payload: { name: `Alignment ${index + 1}` }, derived: { sparseAlignment: { elements: [] } }, status: { valid: true, promotable: true, rejected: false, accepted: false } }));
	const record = { schema: "ufAIM.import-result-evidence", version: 1, evidenceId: "E1", source: { fileName: "TRASSENDATEN_DS260801.MDB", format: "gndEdit", sha256: "physical" }, inventory: [], diagnostics: [], relationCandidates: [], unresolvedEvidence: [], truthfulnessStatus: "safe-construction-available", sourceEnvelope: { projection: "workbench-summary", tables: [{ name: "EL", rowCount: 422, tableIndex: 0, rowsDeferred: true }] } };
	let release;
	const pending = new Promise((resolve) => { release = resolve; });
	const calls = [];
	const messaging = { async sendCmdAwait(name, payload) { calls.push({ name, payload }); if (name === "Spot.GetState") return { objects: [] }; await pending; return name === "Import.GetState" ? { items, rejectedItems: [] } : { records: [record] }; } };
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging, cockpit: {} });
	controller.start();
	const first = controller.refresh(); const second = controller.refresh();
	assert.strictEqual(first, second);
	release(); await Promise.all([first, second]);
	assert.equal(controller.getState().phase, "ready");
	assert.equal(calls.filter((entry) => entry.name === "Import.GetState").length, 1);
	assert.equal(calls.filter((entry) => entry.name === "Import.GetResultEvidence").length, 1);
	assert.deepEqual(calls.find((entry) => entry.name === "Import.GetResultEvidence").payload, { projection: "workbench" });
	assert.match(textOf(root), /422 übernehmbar/);
	assert.match(textOf(root), /Alignment 422/);
});

test("terminal drop outcome opens the workbench and retains exact unsupported facts without fabrication", async () => {
	installDocument();
	const messaging = { async sendCmdAwait(name) { return name === "Import.GetState" ? { items: [], rejectedItems: [] } : { records: [] }; } };
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging, cockpit: {} });
	const outcome = Object.freeze({ fileName: "unsupported.xyz", parserId: null, status: "unsupported", reason: "UNSUPPORTED_FILE_TYPE", itemCount: 0, rejectedCount: 0, evidencePublished: false, failed: false });
	const state = await controller.handleTerminalOutcome(Object.freeze({ state: "completed", fileCount: 1, outcome: { fileOutcomes: Object.freeze([outcome]) } }));
	assert.deepEqual(state.fileOutcomes, [outcome]);
	assert.deepEqual(state.items, []); assert.deepEqual(state.rejectedItems, []); assert.deepEqual(state.records, []);
});

test("explicit promotion uses show true and succeeds only after canonical ImportSession and SPOT verification", async () => {
	installDocument();
	const item = { id: "I1", status: { promotable: true, rejected: false, accepted: false } };
	let accepted = false, showValue = null;
	const messaging = { async sendCmdAwait(name) { if (name === "Import.GetState") return { items: [{ ...item, status: { ...item.status, accepted } }], rejectedItems: [] }; if (name === "Import.GetResultEvidence") return { records: [{ evidenceId: "E1", source: {}, truthfulnessStatus: "construction-available", diagnostics: [], unresolvedEvidence: [] }] }; if (name === "Spot.GetState") return { objects: accepted ? [{ id: "O1", meta: { importItemId: "I1" } }] : [] }; throw new Error(name); } };
	const cockpit = { async refreshImportState() {}, async acceptImportItem(id, options) { assert.equal(id, "I1"); showValue = options.show; accepted = true; return true; } };
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging, cockpit });
	await controller.refresh();
	assert.equal(await controller.promote("I1"), "O1");
	assert.equal(showValue, true); assert.equal(controller.getState().promotedItemId, "I1"); assert.equal(controller.getState().promotedObjectId, "O1");
});

test("failed or unverified promotion remains failed and never reports an active object", async () => {
	installDocument();
	const item = { id: "I1", status: { promotable: true, rejected: false, accepted: false } };
	const messaging = { async sendCmdAwait(name) { if (name === "Import.GetState") return { items: [item], rejectedItems: [] }; if (name === "Import.GetResultEvidence") return { records: [] }; if (name === "Spot.GetState") return { objects: [] }; } };
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging, cockpit: { async refreshImportState() {}, async acceptImportItem() { return false; } } });
	await controller.refresh(); assert.equal(await controller.promote("I1"), false);
	assert.equal(controller.getState().promotedObjectId, null); assert.equal(controller.getState().feedback, "gnd_workbench.transfer_failed");
});

test("canonical wrapped SPOT state yields the same exact promoted object identity", async () => {
	installDocument(); let accepted = false;
	const item = { id: "I1", status: { promotable: true, rejected: false, accepted: false } };
	const messaging = { async sendCmdAwait(name) { if (name === "Import.GetState") return { items: [{ ...item, status: { ...item.status, accepted } }], rejectedItems: [] }; if (name === "Import.GetResultEvidence") return { records: [] }; if (name === "Spot.GetState") return { state: { objects: { O1: { id: "O1", meta: { importItemId: "I1" } } } } }; } };
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging, cockpit: { async refreshImportState() {}, async acceptImportItem() { accepted = true; return true; } } });
	await controller.refresh(); assert.equal(await controller.promote("I1"), "O1");
});

test("command payload SPOT envelope yields the same exact promoted object identity", async () => {
	installDocument();
	const item = { id: "I1", status: { promotable: true, rejected: false, accepted: false } };
	const messaging = { async sendCmdAwait(name) { if (name === "Import.GetState") return { items: [item], rejectedItems: [] }; if (name === "Import.GetResultEvidence") return { records: [] }; if (name === "Spot.GetState") return { payload: { objects: { O1: { id: "O1", meta: { importItemId: "I1" } } } } }; } };
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging, cockpit: { async refreshImportState() {}, async acceptImportItem() { return true; } } });
	await controller.refresh(); assert.equal(await controller.promote("I1"), "O1");
});

test("empty hydrated start delegates file choice and Alignment creation through existing productive facades", async () => {
	installDocument();
	let fileChoices = 0, creates = 0, activations = 0;
	const buttonImport = { click() { fileChoices += 1; } };
	const originalGet = document.getElementById;
	document.getElementById = (id) => id === "btnImport" ? buttonImport : originalGet.call(document, id);
	const messaging = { async sendCmdAwait(name) { if (name === "Spot.GetState") return { objects: creates ? [{ id: "A1", type: "alignment", meta: { label: "A" } }] : [] }; return { items: [], rejectedItems: [], records: [] }; } };
	const controller = makeGndImportWorkbenchController({
		store: { actions: {} }, messaging, importController: {},
		alignmentCreation: { async create() { creates += 1; return { spotObject: { id: "A1" }, alignmentData: { id: "A1" } }; } },
		cockpit: { async activateSpotObject(id) { assert.equal(id, "A1"); activations += 1; return true; } },
	});
	assert.deepEqual(await controller.refreshWorkspaceState(), []);
	controller.chooseFiles();
	assert.equal(fileChoices, 1);
	assert.equal(await controller.createAlignment(), "A1");
	assert.equal(creates, 1);
	assert.equal(activations, 1);
	assert.equal(controller.getState().workspaceObjects[0].id, "A1");
});

test("hydrated persisted objects are reopened by exact canonical identity", async () => {
	installDocument();
	const activated = [];
	const controller = makeGndImportWorkbenchController({
		store: { actions: {} },
		messaging: { async sendCmdAwait(name) { if (name === "Spot.GetState") return { state: { objects: { A1: { id: "A1", type: "alignment" } } } }; return { items: [], rejectedItems: [], records: [] }; } },
		promotedAlignmentJourney: { async activateCanonicalAlignment(id) { activated.push(id); return { ok: true, objectId: id }; } },
	});
	assert.deepEqual((await controller.refreshWorkspaceState()).map((entry) => entry.id), ["A1"]);
	assert.equal(await controller.reopenObject("A1"), true);
	assert.deepEqual(activated, ["A1"]);
	assert.equal(await controller.reopenObject("missing"), false);
	assert.deepEqual(activated, ["A1"]);
});
