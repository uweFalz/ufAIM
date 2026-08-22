import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const controllerUrl = new URL(
	"../../../app/controllers/alignment-profile/createBasicVerticalProfileAuthoringController.js",
	import.meta.url
);
const wiringUrl = new URL(
	"../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js",
	import.meta.url
);
const viewUrl = new URL(
	"../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js",
	import.meta.url
);

test("controller reuses only the accepted canonical vertical state dependency", async () => {
	const source = await readFile(controllerUrl, "utf8");
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
	assert.deepEqual(imports, [
		"../../../src/aim-core/alignment/profile/VerticalConstructiveState.js",
	]);
	assert.match(source, /updateTerminalParabolicGradientRate/);
	assert.match(source, /createVerticalConstructiveState/);
	assert.match(source, /appendVerticalElement/);
	assert.doesNotMatch(imports.join("\n"), /Spot\.|repository|IndexedDB|localStorage|shared|services/);
	assert.doesNotMatch(source, /Spot\.|IndexedDB|localStorage|fetch\(/);
});

test("view stays import-free and submits only stored element identity plus input", async () => {
	const source = await readFile(viewUrl, "utf8");
	assert.doesNotMatch(source, /^import\s/m);
	assert.match(source, /elementId: definition\.id/);
	assert.match(source, /gradientRate: input\.value/);
	assert.match(source, /Apply gradient rate/);
	assert.doesNotMatch(source, /saveProfileState|sendCmdAwait|Spot\.|repository|aim-core|localStorage/);
});

test("wiring owns canonical reread and no storage implementation", async () => {
	const source = await readFile(wiringUrl, "utf8");
	assert.match(source, /updateTerminalParabolicGradientRate/);
	assert.match(source, /messaging\.sendCmdAwait\("Spot\.GetState", \{\}\)/);
	assert.match(source, /PROFILE_READBACK_MISMATCH/);
	assert.match(source, /renderTerminalParabolicEditStatus/);
	assert.doesNotMatch(source, /IndexedDB|localStorage|src\/shared\/persistence/);
});
