import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("controller uses only canonical Cant reconstruction append and evaluation", async () => {
	const source = await read("app/controllers/alignment-profile/createTerminalLinearCantRateEditController.js");
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
	assert.deepEqual(imports, ["../../../src/aim-core/alignment/profile/CantConstructiveState.js"]);
	assert.match(source, /createCantConstructiveState/);
	assert.match(source, /appendCantElement/);
	assert.match(source, /evaluateCantAt/);
	assert.doesNotMatch(source, /endCrossLevel|parseFloat|Spot\.|Worker|Messaging|IndexedDB|localStorage|document|window/);
});

test("view sends only identity and rate while wiring owns canonical readback", async () => {
	const [view, wiring, init] = await Promise.all([
		read("app/view/alignment-profile/AlignmentProfileSynchronizedView.js"),
		read("app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js"),
		read("app/runtime/init/initFeatures.js"),
	]);
	assert.doesNotMatch(view, /^import\s/m);
	assert.doesNotMatch(view, /appendCantElement|evaluateCantAt|saveProfileState|repository|Spot\.|sendCmdAwait|endCrossLevel/);
	assert.match(wiring, /updateTerminalLinearCantRate/);
	assert.match(wiring, /messaging\.sendCmdAwait\("Spot\.GetState", \{\}\)/);
	assert.doesNotMatch(wiring, /IndexedDB|localStorage|src\/shared\/persistence/);
	assert.match(init, /createTerminalLinearCantRateEditController/);
	assert.equal((init.match(/new AlignmentProfileApplicationService\(/g) ?? []).length, 1);
});
