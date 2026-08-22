import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("authoring dock delegates only to existing canonical editor authority", () => {
	const bridge = read("app/controllers/bridges/alignmentEditorBridge.js"), init = read("app/runtime/init/initFeatures.js"), ui = read("app/ui/uiWiring.js");
	assert.match(bridge, /AlignmentEditorController/); assert.match(bridge, /readActiveSnapshot/); assert.match(bridge, /dispatchProductiveAlignmentChange/);
	assert.match(bridge, /if \(!refreshed\) return false/); assert.match(bridge, /choice\.selectedId/);
	assert.match(bridge, /"saving"/); assert.match(bridge, /"saved"/); assert.match(bridge, /"dirty"/); assert.match(bridge, /"error"/);
	assert.match(init, /openHorizontal: \(\) => ctx\.ui\?\.openAlignmentEditor/); assert.match(bridge, /focusElementInEditor/); assert.match(bridge, /elementDiscipline/); assert.match(ui, /watchWorkspaceToolSurface[\s\S]+kind: "authoring"/);
	for (const forbidden of [/nearest/i, /infer.*station/i, /new .*solver/i, /localStorage/, /indexedDB/]) assert.doesNotMatch(bridge, forbidden);
});

test("mobile remains sheet and desktop canvas is dock-adjusted", () => {
	const css = read("app/styles/app.css");
	assert.match(css, /max-width: 760px/); assert.match(css, /data-tool-presentation="sheet"/); assert.match(css, /data-tool-dock.+uf-workspace/);
});
