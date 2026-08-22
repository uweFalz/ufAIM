import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("controller imports only canonical Chainage create append forward inverse APIs", async () => {
	const source = await read("app/controllers/alignment-profile/createTerminalChainageSegmentDomainEditController.js");
	assert.deepEqual([...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]), ["../../../src/aim-core/alignment/profile/ChainageMapping.js"]);
	for (const name of ["createChainageMapping", "appendChainageSegment", "mapIntrinsicToChainage", "mapChainageToIntrinsic"]) assert.match(source, new RegExp(name));
	assert.doesNotMatch(source, /parseFloat|kilomet|station|startAddress\s*[+-]|direction\s*\*|Spot\.|Worker|Messaging|IndexedDB|localStorage|document|window/);
});

test("view stays import-free and wiring alone owns canonical readback", async () => {
	const [view, wiring, init] = await Promise.all([
		read("app/view/alignment-profile/AlignmentProfileSynchronizedView.js"),
		read("app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js"),
		read("app/runtime/init/initFeatures.js"),
	]);
	assert.doesNotMatch(view, /^import\s/m);
	assert.doesNotMatch(view, /createChainageMapping|appendChainageSegment|mapIntrinsicToChainage|mapChainageToIntrinsic|saveProfileState|repository|Spot\.|sendCmdAwait/);
	assert.match(wiring, /updateTerminalChainageSegmentDomain/);
	assert.match(wiring, /messaging\.sendCmdAwait\("Spot\.GetState", \{\}\)/);
	assert.doesNotMatch(wiring, /IndexedDB|localStorage|src\/shared\/persistence/);
	assert.match(init, /createTerminalChainageSegmentDomainEditController/);
	assert.equal((init.match(/new AlignmentProfileApplicationService\(/g) ?? []).length, 1);
});
