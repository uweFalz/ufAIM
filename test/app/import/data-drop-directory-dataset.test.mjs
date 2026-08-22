import assert from "node:assert/strict";
import test from "node:test";
import { pickDirectoryFiles } from "../../../app/io/input/directoryPicker.js";
import { makeGndImportWorkbenchController } from "../../../app/gndImportWorkbench/gndImportWorkbenchController.js";

class MockFile {
	constructor(parts, name, options = {}) { this.parts = parts; this.name = name; this.type = options.type ?? ""; this.lastModified = options.lastModified ?? 0; }
}
const file = (name) => ({ kind: "file", name, async getFile() { return new MockFile([], name, { type: "application/octet-stream", lastModified: 7 }); } });
const directory = (name, children) => ({ kind: "directory", name, async *values() { yield* children; } });

test("directory selection recursively preserves relative paths and same-name siblings", async () => {
	const root = directory("project", [directory("right", [file("track.mdb")]), directory("left", [file("track.mdb")]), file("notes.xyz")]);
	const files = await pickDirectoryFiles({ windowRef: { File: MockFile, async showDirectoryPicker() { return root; } } });
	assert.deepEqual(files.map((entry) => entry.name), ["left/track.mdb", "notes.xyz", "right/track.mdb"]);
	assert.notEqual(files[0].name, files[2].name);
});

test("large directory remains one exact 327-file serial dataset", async () => {
	const children = Array.from({ length: 327 }, (_, index) => file(`part-${String(index).padStart(3, "0")}.mdb`));
	const root = directory("large", children);
	let batches = 0, received = null;
	const windowRef = { File: MockFile, async showDirectoryPicker() { return root; } };
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, windowRef, importController: { async importFiles(files) { batches += 1; received = files; return { status: "succeeded" }; } } });
	const result = await controller.chooseDirectory();
	assert.equal(result.status, "succeeded");
	assert.equal(batches, 1);
	assert.equal(received.length, 327);
	assert.equal(received[0].name, "part-000.mdb");
	assert.equal(received[326].name, "part-326.mdb");
});

test("picker cancellation and unavailable capability do not start an import", async () => {
	let imports = 0;
	const unavailable = makeGndImportWorkbenchController({ store: { actions: {} }, windowRef: {}, importController: { importFiles() { imports += 1; } } });
	assert.equal(await unavailable.chooseDirectory(), false);
	const cancellingWindow = { async showDirectoryPicker() { const error = new Error("cancelled"); error.name = "AbortError"; throw error; } };
	const cancelled = makeGndImportWorkbenchController({ store: { actions: {} }, windowRef: cancellingWindow, importController: { importFiles() { imports += 1; } } });
	assert.equal(await cancelled.chooseDirectory(), false);
	assert.equal(imports, 0);
});

test("terminal dataset keeps valid and unsupported siblings separately visible", async () => {
	globalThis.window = {};
	globalThis.document = { documentElement: { style: {}, dataset: {} }, querySelectorAll() { return []; }, getElementById() { return null; } };
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging: { async sendCmdAwait(name) { return name === "Import.GetState" ? { items: [], rejectedItems: [] } : { records: [] }; } }, cockpit: {} });
	await controller.handleTerminalOutcome({ state: "completed", fileCount: 2, fileNames: ["valid/track.mdb", "notes/track.mdb"], outcome: { status: "partial", fileStates: [{ fileName: "valid/track.mdb", state: "completed" }, { fileName: "notes/track.mdb", state: "unsupported" }], fileOutcomes: [{ fileName: "valid/track.mdb", status: "ok", itemCount: 1 }, { fileName: "notes/track.mdb", status: "unsupported", itemCount: 0 }] } });
	const state = controller.getState();
	assert.equal(state.lifecycle.fileStates[0].state, "completed");
	assert.equal(state.lifecycle.fileStates[1].state, "unsupported");
	assert.equal(state.fileOutcomes[0].itemCount, 1);
	assert.equal(state.fileOutcomes.length, 2);
});
