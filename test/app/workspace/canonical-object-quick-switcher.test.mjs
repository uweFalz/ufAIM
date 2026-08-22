import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalObjectQuickSwitcherModel } from "../../../app/domain/workspace/buildCanonicalObjectQuickSwitcherModel.js";
import { createCanonicalObjectQuickSwitcherController } from "../../../app/controllers/workspace/createCanonicalObjectQuickSwitcherController.js";

const rows = [
	{ spotId: "A", label: "Nord", spatialMode: "local", gndRoute: { route: "1720", role: "1", sourceAssociationStatus: "reviewed" }, gndNavigator: { sourceFingerprint: "fp-a" } },
	{ spotId: "B", label: "Sued", spatialMode: "qualified", gndRoute: { route: "1720", role: "2", sourceAssociationStatus: "open-candidates" }, gndNavigator: { sourceFingerprint: "fp-b" } },
];

test("model preserves exact canonical identities and separate source fingerprints", () => {
	const model = buildCanonicalObjectQuickSwitcherModel({ uiState: { rows }, activeObjectId: "B" });
	assert.equal(model.total, 2);
	assert.deepEqual(model.rows.map(({ objectId, sourceFingerprint }) => [objectId, sourceFingerprint]), [["A", "fp-a"], ["B", "fp-b"]]);
	assert.equal(model.activeObjectId, "B");
	assert.deepEqual(buildCanonicalObjectQuickSwitcherModel({ uiState: { rows }, query: "nord" }).rows.map((row) => row.objectId), ["A"]);
	assert.deepEqual(buildCanonicalObjectQuickSwitcherModel({ uiState: { rows }, query: "B" }).rows.map((row) => row.objectId), ["B"]);
	assert.equal(buildCanonicalObjectQuickSwitcherModel({ uiState: { rows }, query: "1720" }).rows.length, 2);
});

test("controller refreshes canonically and changes focus only after successful activation", async () => {
	const renders = [], activations = [], closes = [];
	let failRefresh = true;
	let activationResult = { ok: false, code: "missing" };
	const view = { setHandlers(value) { this.handlers = value; }, render(model) { renders.push(model); } };
	const controller = createCanonicalObjectQuickSwitcherController({
		view,
		refreshCanonicalUiState: async () => { if (failRefresh) throw new Error("worker unavailable"); return { rows }; },
		activateCanonicalAlignment: async (id) => { activations.push(id); return activationResult; },
		getActiveObjectId: () => "A",
		openSurface: () => {}, closeSurface: () => closes.push("closed"),
	});
	assert.equal(await controller.open(), false);
	assert.equal(controller.getModel().phase, "error");
	failRefresh = false;
	assert.equal(await view.handlers.retry(), true);
	assert.equal(controller.getModel().phase, "ready");
	assert.equal(await view.handlers.activate("B"), false);
	assert.deepEqual(activations, ["B"]);
	assert.deepEqual(closes, []);
	activationResult = { ok: true, objectId: "B" };
	assert.equal(await view.handlers.activate("B"), true);
	assert.deepEqual(closes, ["closed"]);
	assert.ok(renders.some((model) => model.phase === "loading"));
});

test("every peer opener closes one open switcher and stop removes the capture listener", async () => {
	let listener = null, addCount = 0, removeCount = 0, closes = 0;
	const documentRef = {
		addEventListener(type, handler, capture) { assert.deepEqual([type, capture], ["click", true]); listener = handler; addCount += 1; },
		removeEventListener(type, handler, capture) { assert.deepEqual([type, handler, capture], ["click", listener, true]); removeCount += 1; },
	};
	const view = { setHandlers(value) { this.handlers = value; }, render() {} };
	const controller = createCanonicalObjectQuickSwitcherController({ view, documentRef, refreshCanonicalUiState: async () => ({ rows: [] }), openSurface() {}, closeSurface() { closes += 1; } });
	assert.equal(addCount, 1);
	for (const id of ["btnGndImportWorkbench", "btnSpot", "btnCommandPalette", "btnAlignmentEditor", "btnVerticalProfileAuthoring", "btnCantAuthoring", "btnChainageAuthoring"]) {
		await controller.open();
		listener({ target: { id, closest: () => ({ id }) } });
		assert.equal(closes, id === "btnGndImportWorkbench" ? 1 : closes);
		listener({ target: { id, closest: () => ({ id }) } });
	}
	assert.equal(closes, 7);
	await controller.open();
	listener({ target: { id: "unrelated", closest: () => ({ id: "unrelated" }) } });
	assert.equal(closes, 7);
	await controller.open();
	assert.equal(addCount, 1, "reopen must not duplicate the document listener");
	controller.stop();
	assert.equal(closes, 8);
	assert.equal(removeCount, 1);
});
