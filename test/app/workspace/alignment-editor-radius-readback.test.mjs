import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const repositoryUrl = new URL("../../../", import.meta.url);
const aliases = { "@app/": "app/", "@src/": "src/", "@spot/": "src/model/spot/", "@transition/": "src/domain/transition/", "@utils/": "src/lib/utils/" };
registerHooks({ resolve(specifier, context, nextResolve) {
	for (const [prefix, path] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(path + specifier.slice(prefix.length), repositoryUrl).href, context);
	return nextResolve(specifier, context);
} });
const { makeAlignmentEditorBridge } = await import("../../../app/controllers/bridges/alignmentEditorBridge.js");
const { AlignmentEditorController } = await import("../../../app/controllers/alignmentEditorController.js");

// Real Bridge, controller, mapper and sparse materializer; only DOM/runtime
// transport are doubles. This does not exercise browser number validation.
class NodeDouble {
	constructor(id = "") {
		this.id = id; this.value = ""; this.textContent = ""; this.dataset = {};
		this.children = []; this.events = new Map(); this.classes = new Set();
		this.classList = {
			contains: (name) => this.classes.has(name),
			toggle: (name, on = !this.classes.has(name)) => { if (on) this.classes.add(name); else this.classes.delete(name); },
		};
	}
	get options() { return this.children; }
	append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
	replaceChildren(...children) { this.children = []; this.append(...children); }
	remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); }
	setAttribute() {}
	addEventListener(name, fn) { const listeners = this.events.get(name) ?? []; listeners.push(fn); this.events.set(name, listeners); }
	emit(name) { for (const fn of this.events.get(name) ?? []) fn({ target: this }); }
	querySelector(selector) {
		const key = selector === "[data-authoring-change-preview]" ? "authoringChangePreview" : selector === "[data-authoring-draft-notice]" ? "authoringDraftNotice" : null;
		return key ? this.children.find((child) => Object.hasOwn(child.dataset, key)) ?? null : null;
	}
}

function harness(object) {
	const originalDocument = globalThis.document, originalWindow = globalThis.window;
	const ids = ["alignmentEditorOverlay", "aeElementSel", "aeElementType", "aeLength", "aeCurvature", "aeRadius", "aeTransitionType", "aeW1", "aeW2", "aeSignedContext", "aeConsequence", "aeApply", "aeUndo", "aeReset", "aeStatus"];
	const nodes = Object.fromEntries(ids.map((id) => [id, new NodeDouble(id)]));
	nodes.alignmentEditorOverlay.classList.toggle("hidden", true);
	globalThis.document = { getElementById: (id) => nodes[id] ?? null, querySelector: () => null, createElement: () => new NodeDouble() };
	globalThis.window = new NodeDouble();
	const state = { ae_open: false, workspace_selection: { primaryId: object.id, contextIds: [] } };
	const commands = [];
	const readbacks = [];
	const store = {
		getState: () => state, subscribe: () => () => {},
		actions: { setAeOpen: (open) => { state.ae_open = open; }, setWorkspaceSelection: (selection) => { state.workspace_selection = selection; } },
	};
	const bridge = makeAlignmentEditorBridge({
		store,
		ui: { openAlignmentEditor: () => nodes.alignmentEditorOverlay.classList.toggle("hidden", false), closeAlignmentEditor: () => nodes.alignmentEditorOverlay.classList.toggle("hidden", true) },
		messaging: { async sendCmdAwait(name) {
			commands.push(name);
			if (name === "Spot.GetState") { const readback = deepFreeze(structuredClone(object)); readbacks.push(readback); return { objects: [readback] }; }
			if (name === "Transition.ListPresets") return { items: [] };
			throw new Error(`Unexpected write or command: ${name}`);
		} },
	});
	bridge.wire();
	return { bridge, nodes, commands, readbacks, dispose() { bridge.stop(); if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument; if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; } };
}

function deepFreeze(value) {
	if (value && typeof value === "object") { for (const item of Object.values(value)) deepFreeze(item); Object.freeze(value); }
	return value;
}

function importedArc(curvature = 0.00016393442461703844) {
	return { id: "A1", type: "alignment", data: { kernel: {
		startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
		sparse: [{ id: "el_0005", type: "fixed", curvature, arcLength: 154.90471 }],
	} } };
}

function nativeElement(element) {
	return { id: "A1", type: "alignment", data: { alignmentData: {
		type: "AlignmentData", id: "A1", name: "Radius readback fixture",
		editModel: { startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }, elements: [{ id: "E1", type: "arc", length: 100, ...element }] },
	} } };
}

async function expectRadius(object, expected, { hidden = false } = {}) {
	const before = structuredClone(object), f = harness(object);
	try {
		assert.equal(await f.bridge.open(), true);
		assert.equal(f.nodes.aeRadius.value, expected);
		assert.equal(f.nodes.aeRadius.classList.contains("hidden"), hidden);
		assert.deepEqual(object, before);
		assert.deepEqual(f.readbacks, [before]);
		assert.deepEqual(f.commands, ["Spot.GetState", "Transition.ListPresets"]);
	} finally { f.dispose(); }
}

test("BROWSER081 el_0005: real sparse materialization populates signed radius before any input", async () => {
	const object = importedArc(), before = structuredClone(object), f = harness(object);
	try {
		assert.equal(await f.bridge.open({ elementId: "el_0005" }), true);
		assert.equal(f.nodes.aeElementType.value, "Bogen");
		assert.equal(f.nodes.aeCurvature.value, "0.00016393442461703844");
		assert.match(f.nodes.aeConsequence.textContent, /R 6100\.00/);
		assert.equal(f.nodes.aeRadius.value, String(1 / 0.00016393442461703844));
		assert.deepEqual(object, before);
		assert.deepEqual(f.commands, ["Spot.GetState", "Transition.ListPresets"]);
	} finally { f.dispose(); }
});

test("absent radius uses the existing signed reciprocal only for a finite non-negligible arc curvature", async (t) => {
	for (const curvature of [.004, -.004, 1.0001e-12, -1.0001e-12, "0.004", "-0.004"]) {
		await t.test(String(curvature), async () => {
			await expectRadius(nativeElement({ parameters: { curvature } }), String(1 / Number(curvature)));
			await expectRadius(nativeElement({ curvature }), String(1 / Number(curvature)));
		});
	}
	await expectRadius(importedArc(-.004), "-250");
	await expectRadius(nativeElement({ curvature: -.004, parameters: { curvature: .004 } }), "250");
});

test("explicit radius keeps the existing nullish display precedence without changing its authority", async (t) => {
	for (const [name, element, expected] of [
		["parameter number", { parameters: { radius: 250, curvature: .004 } }, "250"],
		["negative number", { radius: -250, curvature: -.004 }, "-250"],
		["numeric string", { parameters: { radius: "250", curvature: .004 } }, "250"],
		["parameter wins over root", { parameters: { radius: 250, curvature: .004 }, radius: 999 }, "250"],
		["null parameter falls through to explicit root", { parameters: { radius: null, curvature: .004 }, radius: 250 }, "250"],
		["undefined parameter falls through to root", { parameters: { radius: undefined, curvature: .004 }, radius: 250 }, "250"],
		// Deliberately contradictory synthetic data: display must not silently
		// choose a new canonical authority or repair existing state.
		["explicit mismatch is not overwritten", { parameters: { radius: 300, curvature: .004 } }, "300"],
		["explicit zero is shown not replaced or declared valid", { radius: 0, curvature: .004 }, "0"],
	]) await t.test(name, () => expectRadius(nativeElement(element), expected));
});

test("explicit invalid radius is not concealed by a plausible derived value", async (t) => {
	for (const [name, radius] of [["null", null], ["empty", ""], ["space", " \t"], ["NaN", NaN], ["Infinity", Infinity], ["negative Infinity", -Infinity], ["text", "invalid"], ["false", false], ["true", true], ["array", [250]], ["object", {}]]) {
		await t.test(name, async () => {
			await expectRadius(nativeElement({ radius, curvature: .004 }), "");
			await expectRadius(nativeElement({ parameters: { radius, curvature: .004 } }), "");
		});
	}
	await expectRadius(nativeElement({ radius: 250, parameters: { radius: "", curvature: .004 } }), "");
	await expectRadius(nativeElement({ radius: 250, parameters: { radius: false, curvature: .004 } }), "");
});

test("absent, invalid, zero or near-zero curvature does not synthesize a radius", async (t) => {
	for (const [name, curvature] of [["absent", undefined], ["null", null], ["zero", 0], ["negative zero", -0], ["tiny", 1e-13], ["negative tiny", -1e-13], ["threshold", 1e-12], ["negative threshold", -1e-12], ["NaN", NaN], ["Infinity", Infinity], ["negative Infinity", -Infinity], ["empty", ""], ["space", " "], ["text", "invalid"], ["true", true], ["false", false], ["array", [.004]], ["object", {}]]) {
		await t.test(name, () => expectRadius(nativeElement({ parameters: { curvature } }), ""));
	}
});

test("non-arcs never acquire a reciprocal radius; missing selection clears readback", async () => {
	for (const type of ["straight", "transition"]) {
		await expectRadius(nativeElement({ type, curvature: .004 }), "", { hidden: true });
		await expectRadius(nativeElement({ type, curvature: .004, radius: 250 }), "250", { hidden: true });
	}
	const f = harness(importedArc());
	try {
		await f.bridge.open();
		f.nodes.aeElementSel.value = "missing";
		f.nodes.aeElementSel.emit("change");
		assert.equal(f.nodes.aeRadius.value, "");
		assert.equal(f.nodes.aeCurvature.value, "");
		assert.equal(f.nodes.aeApply.disabled, true);
	} finally { f.dispose(); }
});

test("draft values survive close and refresh while Reset returns to derived canonical display without writes", async () => {
	const object = importedArc(), before = structuredClone(object), f = harness(object);
	try {
		await f.bridge.open();
		f.nodes.aeRadius.value = "-6200";
		f.nodes.aeRadius.emit("input");
		assert.equal(f.nodes.aeCurvature.value, String(-1 / 6200));
		f.bridge.close();
		await f.bridge.open();
		assert.equal(f.nodes.aeRadius.value, "-6200");
		assert.equal(f.nodes.aeCurvature.value, String(-1 / 6200));
		f.nodes.aeReset.emit("click");
		assert.equal(f.nodes.aeRadius.value, "6100.00006");
		assert.equal(f.nodes.aeCurvature.value, "0.00016393442461703844");
		f.nodes.aeRadius.value = "";
		f.nodes.aeRadius.emit("input");
		await f.bridge.refresh();
		assert.equal(f.nodes.aeRadius.value, "", "an intentionally empty draft is not silently refilled");
		f.nodes.aeReset.emit("click");
		assert.equal(f.nodes.aeRadius.value, "6100.00006");
		assert.deepEqual(object, before);
		assert.ok(f.commands.every((name) => ["Spot.GetState", "Transition.ListPresets"].includes(name)));
		for (const readback of f.readbacks) assert.deepEqual(readback, before);
	} finally { f.dispose(); }
});

test("readback does not select radius edit authority; real input events and Reset retain their existing authority", async () => {
	// Intercept only the command boundary for this test: no geometry or
	// persistence is exercised or claimed by this payload-authority assertion.
	const originalUpdate = AlignmentEditorController.prototype.updateArcOnActiveAlignment;
	const updates = [];
	AlignmentEditorController.prototype.updateArcOnActiveAlignment = async function (args) { updates.push(args); return { changed: false }; };
	const f = harness(importedArc());
	const apply = async () => { f.nodes.aeApply.emit("click"); await new Promise((resolve) => setImmediate(resolve)); return updates.at(-1); };
	try {
		await f.bridge.open();
		assert.deepEqual(await apply(), { elementId: "el_0005", length: 154.90471, curvature: 0.00016393442461703844 });
		f.nodes.aeRadius.value = "6110";
		f.nodes.aeRadius.emit("input");
		await f.bridge.refresh();
		assert.deepEqual(await apply(), { elementId: "el_0005", length: 154.90471, radius: 6110 });
		f.nodes.aeCurvature.value = "-0.004";
		f.nodes.aeCurvature.emit("input");
		assert.equal(f.nodes.aeRadius.value, "-250");
		assert.deepEqual(await apply(), { elementId: "el_0005", length: 154.90471, curvature: -.004 });
		f.nodes.aeReset.emit("click");
		assert.deepEqual(await apply(), { elementId: "el_0005", length: 154.90471, curvature: 0.00016393442461703844 });
		assert.equal(updates.length, 4);
		assert.ok(f.commands.every((name) => ["Spot.GetState", "Transition.ListPresets"].includes(name)));
	} finally { f.dispose(); AlignmentEditorController.prototype.updateArcOnActiveAlignment = originalUpdate; }
});
