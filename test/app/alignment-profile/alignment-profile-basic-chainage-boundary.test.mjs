import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("controller has only the canonical ChainageMapping dependency", async () => {
	const source = await read("app/controllers/alignment-profile/createBasicChainageMappingAuthoringController.js");
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
	assert.deepEqual(imports, ["../../../src/aim-core/alignment/profile/ChainageMapping.js"]);
	for (const name of ["createChainageMapping", "appendChainageSegment", "mapIntrinsicToChainage"]) assert.match(source, new RegExp(name));
	assert.doesNotMatch(source, /Spot\.|Worker|Messaging|IndexedDB|localStorage|renderer|document|window/);
});

test("view stays import-free and wiring alone performs canonical readback", async () => {
	const [view, wiring, init] = await Promise.all([
		read("app/view/alignment-profile/AlignmentProfileSynchronizedView.js"),
		read("app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js"),
		read("app/runtime/init/initFeatures.js"),
	]);
	assert.doesNotMatch(view, /^import\s/m);
	assert.doesNotMatch(view, /Spot\.|sendCmdAwait|saveProfileState|repository|IndexedDB|localStorage/);
	assert.match(wiring, /submitBasicChainage/);
	assert.match(wiring, /messaging\.sendCmdAwait\("Spot\.GetState", \{\}\)/);
	assert.doesNotMatch(wiring, /IndexedDB|localStorage|src\/shared\/persistence/);
	assert.match(init, /createBasicChainageMappingAuthoringController/);
	assert.equal((init.match(/new AlignmentProfileApplicationService\(/g) ?? []).length, 1);
});
