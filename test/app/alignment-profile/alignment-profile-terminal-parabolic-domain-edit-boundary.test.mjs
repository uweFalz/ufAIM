import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const controllerUrl = new URL("../../../app/controllers/alignment-profile/createBasicVerticalProfileAuthoringController.js", import.meta.url);
const wiringUrl = new URL("../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js", import.meta.url);
const viewUrl = new URL("../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js", import.meta.url);

test("domain edit retains the sole existing canonical VerticalConstructiveState import", async () => {
	const source = await readFile(controllerUrl, "utf8");
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
	assert.deepEqual(imports, ["../../../src/aim-core/alignment/profile/VerticalConstructiveState.js"]);
	assert.match(source, /updateTerminalParabolicEndS/);
	assert.match(source, /evaluateVerticalAt\(vertical, \{ s: normalizedEndS \}\)/);
	assert.doesNotMatch(imports.join("\n"), /services|repository|shared|persistence|Spot|Worker/);
});

test("view is import-free and exposes no repository command", async () => {
	const source = await readFile(viewUrl, "utf8");
	assert.doesNotMatch(source, /^import\s/m);
	assert.match(source, /elementId: definition\.id/);
	assert.match(source, /endS: input\.value/);
	assert.match(source, /Apply end s/);
	assert.doesNotMatch(source, /sendCmdAwait|saveProfileState|Spot\.|repository|IndexedDB|localStorage/);
});

test("wiring owns canonical readback while existing gradient-rate seam remains", async () => {
	const source = await readFile(wiringUrl, "utf8");
	assert.match(source, /updateTerminalParabolicEndS/);
	assert.match(source, /updateTerminalParabolicGradientRate/);
	assert.match(source, /messaging\.sendCmdAwait\("Spot\.GetState", \{\}\)/);
	assert.match(source, /renderTerminalParabolicDomainEditStatus/);
	assert.doesNotMatch(source, /IndexedDB|localStorage|src\/shared\/persistence/);
});
