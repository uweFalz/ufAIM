import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("control delegates only to existing exact delete and window-local undo authorities", async () => {
	const [bridge, service, controller] = await Promise.all([read("app/controllers/bridges/alignmentEditorBridge.js"), read("src/services/alignment/AlignmentApplicationService.js"), read("app/controllers/alignmentEditorController.js")]);
	assert.match(bridge, /controller\.removeElementFromActiveAlignment\(\{ elementId: authority\.elementId \}\)/);
	assert.match(bridge, /await refresh\(\{ preserveSelection: false \}\)/);
	assert.match(service, /removeElementById/);
	assert.match(service, /selectAfterEdit/);
	assert.match(controller, /undoLastAlignmentChange/);
	assert.doesNotMatch(bridge, /\bmoveElement|\breorderElement|\bredo\b|\bhistory\b|\bremoveElementAtIndex/);
});

test("reject and refresh failure do not clear the exact draft", async () => {
	const bridge = await read("app/controllers/bridges/alignmentEditorBridge.js");
	const clearIndex = bridge.indexOf("drafts.clear(draftIdentity(removedElement))");
	const refreshIndex = bridge.indexOf("const refreshed = await refresh({ preserveSelection: false })", bridge.indexOf("async function removeSelectedElement"));
	assert.ok(refreshIndex > 0 && clearIndex > refreshIndex);
	assert.match(bridge, /result\?\.ok === false \|\| result\?\.status === "rejected" \|\| result\?\.changed !== true/);
	assert.match(bridge, /async function refresh[\s\S]+pendingRemovalId = null/);
});
