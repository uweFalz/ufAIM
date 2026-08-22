import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("task rail contains no mutation persistence geometry or invented capability authority", async () => {
	const model = await readFile(new URL("../../../app/domain/workspace/buildAlignmentEngineeringTaskRailModel.js", import.meta.url), "utf8");
	const view = await readFile(new URL("../../../app/view/workspace/ExistingAlignmentIntelligenceView.js", import.meta.url), "utf8");
	assert.doesNotMatch(model, /save|persist|Spot\.|curvature\s*[+*/-]|defaultSpeed|defaultGauge|construct(?:Eh|Eu|Profile|Cant)\s*\(/i);
	assert.match(model, /intelligence\?\.capabilities/);
	assert.doesNotMatch(view, /sendCmdAwait|save|promoteImport/);
});

test("runtime task actions are existing UI and workspace delegates only", async () => {
	const source = await readFile(new URL("../../../app/runtime/init/initFeatures.js", import.meta.url), "utf8");
	assert.match(source, /openHorizontal: \(\) => ctx\.ui\?\.openAlignmentEditor/);
	assert.match(source, /openBands: \(\) => ctx\.alignmentBimWorkspace\?\.activate\?\.\("l"\)/);
	assert.match(source, /openObjects: \(\) => document\.getElementById\("btnSpot"\)/);
});
