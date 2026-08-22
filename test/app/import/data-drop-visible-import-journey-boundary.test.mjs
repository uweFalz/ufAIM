import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const ROOT = new URL("../../../", import.meta.url), read = (path) => readFile(new URL(path, ROOT), "utf8");

test("import observer is narrow and Workbench is the only injected consumer", async () => {
	const [controller, init] = await Promise.all([read("app/controllers/importController.js"), read("app/runtime/init/initFeatures.js")]);
	assert.match(controller, /subscribeTerminalOutcomes/); assert.match(controller, /fileDropLifecycleHistory\.push\(detail\)/);
	assert.match(controller, /subscribeImportActivity/); assert.match(controller, /fileNames/);
	assert.match(init, /importController:\s*ctx\.importController/);
	assert.match(init, /alignmentCreation:\s*ctx\.alignmentCreation/);
	assert.doesNotMatch(controller, /gndImportWorkbench|Spot\.|Cockpit/);
});

test("Workbench remains a read-model adapter with no parser storage geometry or automatic promotion authority", async () => {
	const [controller, view] = await Promise.all([read("app/gndImportWorkbench/gndImportWorkbenchController.js"), read("app/gndImportWorkbench/gndImportWorkbenchView.js")]);
	assert.match(controller, /acceptImportItem\(itemId, \{ show: true \}\)/);
	assert.match(controller, /Spot\.GetState/); assert.match(controller, /promotedItemId/);
	assert.match(controller, /getActiveImportJob/); assert.match(controller, /requestAnimationFrame/);
	assert.match(controller, /document\.documentElement/); assert.match(controller, /importDragActive/);
	assert.doesNotMatch(controller, /setInterval|setTimeout/);
	assert.doesNotMatch(controller + view, /IndexedDB|localStorage|appendCant|createVertical|parseGND|runImportPipeline|technetViewer|makeAlignment2D|Spot\.Add|Spot\.Remove/);
	assert.doesNotMatch(view, /^import .*aim-core|^import .*src\/|sendCmdAwait|save|repository/im);
	assert.doesNotMatch(view, /auto.*promot|dispatchEvent|DragEvent/i);
	assert.doesNotMatch(controller + view, /createOverlay|OverlayManager|technetViewer/i);
	assert.doesNotMatch(controller + view, /IntroDirector|introRuntimeBridge|WindowRuntime|systemPrefs/);
	assert.match(controller, /alignmentCreation\?\.create\?\.\(\)/);
	assert.match(controller, /cockpit\?\.activateSpotObject\?\.\(requestedId\)/);
	assert.match(controller, /document\.getElementById\("btnImport"\)\?\.click\(\)/);
});

test("exact package production scope has no excluded hotfile dependency", async () => {
	const init = await read("app/runtime/init/initFeatures.js");
	assert.doesNotMatch(init, /technetViewer/);
	assert.equal((init.match(/makeGndImportWorkbenchController\(/g) ?? []).length, 1);
});

test("the main stage owns an always-visible import activity rail with exact multi-file feedback", async () => {
	const [shell, init, drop] = await Promise.all([
		read("app/view/shell/buildWindowShell.js"),
		read("app/runtime/init/initFeatures.js"),
		read("app/io/input/fileDrop.js"),
	]);
	assert.match(shell, /id="importActivityRail"/);
	assert.match(shell, /data-import-activity-files/);
	assert.match(shell, /data-import-activity-open/);
	assert.match(init, /updateImportActivityRail/);
	assert.match(init, /Drop-Inhalt wird gelesen/);
	assert.match(init, /Ordner und Dateien werden gesammelt/);
	assert.match(init, /document\.getElementById\("btnGndImportWorkbench"\)\?\.click\(\)/);
	assert.match(init, /open\.textContent = \["accepted", "processing"\]/);
	assert.match(init, /Import abgeschlossen/);
	assert.match(init, /Objekt.*erkannt/);
	assert.match(drop, /publish\("completed", \{[\s\S]*fileNames:/);
});

test("S1 stays above alignmentOS and crosses promotion only through the existing facade and canonical readback", async () => {
	const [importController, workbenchController, workbenchView, init, cockpit, cockpitActions] = await Promise.all([
		read("app/controllers/importController.js"),
		read("app/gndImportWorkbench/gndImportWorkbenchController.js"),
		read("app/gndImportWorkbench/gndImportWorkbenchView.js"),
		read("app/runtime/init/initFeatures.js"),
		read("app/controllers/cockpitController.js"),
		read("app/controllers/cockpit/cockpitActions.js"),
	]);
	const packageProduction = [importController, workbenchController, workbenchView, init].join("\n");
	assert.doesNotMatch(packageProduction, /docs\/knowledgeKernel|src\/aim-core|@aim-core|@src\/aim-core/);
	assert.doesNotMatch(packageProduction, /IndexedDbSpotStateAdapter|indexedDB\.|IDBDatabase|SharedMessagingWorker|SpotService/);
	assert.match(workbenchController, /cockpit\.acceptImportItem\(itemId, \{ show: true \}\)/);
	assert.match(workbenchController, /messaging\.sendCmdAwait\("Spot\.GetState", \{\}\)/);
	assert.match(cockpit, /promoteImportItemToSpot/);
	assert.match(cockpitActions, /Spot\.PromoteImportItemsById/);
});
