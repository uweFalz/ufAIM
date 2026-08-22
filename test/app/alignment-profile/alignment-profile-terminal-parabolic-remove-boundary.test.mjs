import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const controllerUrl = new URL("../../../app/controllers/alignment-profile/createBasicVerticalProfileAuthoringController.js", import.meta.url);
const wiringUrl = new URL("../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js", import.meta.url);
const viewUrl = new URL("../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js", import.meta.url);

test("removal retains the sole canonical VerticalConstructiveState dependency", async () => {
	const source = await readFile(controllerUrl, "utf8");
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
	assert.deepEqual(imports, ["../../../src/aim-core/alignment/profile/VerticalConstructiveState.js"]);
	assert.match(source, /removeTerminalParabolicElement/);
	assert.match(source, /persisted\.vertical\.elements\.slice\(0, -1\)/);
	assert.doesNotMatch(imports.join("\n"), /services|repository|shared|persistence|Spot|Worker/);
});

test("view remains import-free and submits no repository command", async () => {
	const source = await readFile(viewUrl, "utf8");
	assert.doesNotMatch(source, /^import\s/m);
	assert.match(source, /Remove terminal parabolic element/);
	assert.match(source, /elementId: definition\.id/);
	assert.doesNotMatch(source, /sendCmdAwait|saveProfileState|Spot\.|repository|IndexedDB|localStorage/);
});

test("wiring owns canonical SPOT readback without storage implementation", async () => {
	const source = await readFile(wiringUrl, "utf8");
	assert.match(source, /removeTerminalParabolicElement/);
	assert.match(source, /messaging\.sendCmdAwait\("Spot\.GetState", \{\}\)/);
	assert.match(source, /renderTerminalParabolicRemoveStatus/);
	assert.match(source, /updateTerminalParabolicGradientRate/);
	assert.match(source, /updateTerminalParabolicEndS/);
	assert.doesNotMatch(source, /IndexedDB|localStorage|src\/shared\/persistence/);
});
