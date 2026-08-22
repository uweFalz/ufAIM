import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("controller imports only canonical Cant construction and evaluation", async () => {
	const source = await read("app/controllers/alignment-profile/createBasicCantCrossLevelAuthoringController.js");
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
	assert.deepEqual(imports, ["../../../src/aim-core/alignment/profile/CantConstructiveState.js"]);
	for (const name of ["createCantConstructiveState", "appendCantElement", "evaluateCantAt"]) assert.match(source, new RegExp(name));
	assert.doesNotMatch(source, /Spot\.|Worker|Messaging|IndexedDB|localStorage|renderer|document|window/);
});

test("view has no imports or Cant mathematics and wiring alone reads canonical SPOT", async () => {
	const [view, wiring, init] = await Promise.all([
		read("app/view/alignment-profile/AlignmentProfileSynchronizedView.js"),
		read("app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js"),
		read("app/runtime/init/initFeatures.js"),
	]);
	assert.doesNotMatch(view, /^import\s/m);
	assert.doesNotMatch(view, /evaluateCantAt|crossLevel\s*[+*/-]|saveProfileState|sendCmdAwait|Spot\.|repository|IndexedDB/);
	assert.match(wiring, /submitBasicCant/);
	assert.match(wiring, /messaging\.sendCmdAwait\("Spot\.GetState", \{\}\)/);
	assert.doesNotMatch(wiring, /IndexedDB|localStorage|src\/shared\/persistence/);
	assert.match(init, /createBasicCantCrossLevelAuthoringController/);
	assert.equal((init.match(/new AlignmentProfileApplicationService\(/g) ?? []).length, 1);
});
