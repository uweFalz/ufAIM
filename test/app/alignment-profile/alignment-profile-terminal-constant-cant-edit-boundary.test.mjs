import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const ROOT = new URL("../../../", import.meta.url), read = (path) => readFile(new URL(path, ROOT), "utf8");

test("controller uses only canonical Cant construction append and evaluation", async () => {
	const source = await read("app/controllers/alignment-profile/createTerminalConstantCantCrossLevelEditController.js");
	assert.deepEqual([...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]), ["../../../src/aim-core/alignment/profile/CantConstructiveState.js"]);
	for (const name of ["createCantConstructiveState", "appendCantElement", "evaluateCantAt"]) assert.match(source, new RegExp(name));
	assert.doesNotMatch(source, /crossLevelRate\s*\*|Spot\.|Worker|Messaging|IndexedDB|localStorage|document|window|rail|datum|untertief/i);
});

test("view remains import-free while wiring alone owns canonical readback", async () => {
	const [view, wiring, init] = await Promise.all([read("app/view/alignment-profile/AlignmentProfileSynchronizedView.js"), read("app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js"), read("app/runtime/init/initFeatures.js")]);
	assert.doesNotMatch(view, /^import\s/m); assert.doesNotMatch(view, /createCantConstructiveState|appendCantElement|evaluateCantAt|saveProfileState|repository|Spot\.|sendCmdAwait/);
	assert.match(wiring, /updateTerminalConstantCantCrossLevel/); assert.match(wiring, /messaging\.sendCmdAwait\("Spot\.GetState", \{\}\)/); assert.doesNotMatch(wiring, /IndexedDB|localStorage|src\/shared\/persistence/);
	assert.match(init, /createTerminalConstantCantCrossLevelEditController/); assert.equal((init.match(/new AlignmentProfileApplicationService\(/g) ?? []).length, 1);
});
