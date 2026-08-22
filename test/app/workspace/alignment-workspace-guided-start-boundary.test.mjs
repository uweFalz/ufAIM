import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("guided start remains an App orchestration surface over existing actions", async () => {
	const [controller, view] = await Promise.all([read("app/gndImportWorkbench/gndImportWorkbenchController.js"), read("app/gndImportWorkbench/gndImportWorkbenchView.js")]);
	assert.match(controller, /Spot\.GetState/);
	assert.match(controller, /document\.getElementById\("btnSpot"\)\?\.click\(\)/);
	assert.match(controller, /document\.getElementById\("btnImport"\)\?\.click\(\)/);
	assert.match(controller, /refreshWorkspaceState\(\)\.then\(showOverlay, showOverlay\)/);
	assert.match(view, /ganze Verzeichnisse hineinziehen/);
	assert.match(view, /Übernehmen & anzeigen/);
	assert.doesNotMatch(controller + view, /auto.?promot|setTimeout|setInterval|IndexedDB|SharedWorker|parseGND|appendCant|createVertical/i);
});

test("busy feedback is bound only to real accepted or processing states", async () => {
	const view = await read("app/gndImportWorkbench/gndImportWorkbenchView.js");
	assert.match(view, /\["accepted", "processing"\]\.includes\(state\)/);
	assert.match(view, /data-import-busy|dataset\.importBusy/);
	assert.doesNotMatch(view, /fake|simulated|setTimeout|setInterval/i);
});

test("package has no Kernel parser persistence or Viewer coupling", async () => {
	const source = (await Promise.all([read("app/gndImportWorkbench/gndImportWorkbenchController.js"), read("app/gndImportWorkbench/gndImportWorkbenchView.js"), read("app/styles/gndImportWorkbench.css")])).join("\n");
	assert.doesNotMatch(source, /technetViewer|docs\/knowledgeKernel|src\/aim-core|IndexedDbSpotStateAdapter|runImportPipeline/);
});
