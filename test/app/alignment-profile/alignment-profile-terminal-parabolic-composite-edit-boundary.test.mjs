import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("controller imports only canonical Vertical replay and evaluation APIs", async () => {
	const source = await read("app/controllers/alignment-profile/createTerminalParabolicVerticalCompositeEditController.js");
	assert.deepEqual([...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]), ["../../../src/aim-core/alignment/profile/VerticalConstructiveState.js"]);
	for (const name of ["createVerticalConstructiveState", "appendVerticalElement", "evaluateVerticalAt"]) assert.match(source, new RegExp(name));
	assert.doesNotMatch(source, /parseFloat|elevation\s*[+*]|gradient\s*[+*]|Spot\.|Worker|Messaging|IndexedDB|localStorage|document|window/);
});

test("view remains import-free while wiring alone owns canonical readback", async () => {
	const [view, wiring, init] = await Promise.all([
		read("app/view/alignment-profile/AlignmentProfileSynchronizedView.js"),
		read("app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js"),
		read("app/runtime/init/initFeatures.js"),
	]);
	assert.doesNotMatch(view, /^import\s/m);
	assert.doesNotMatch(view, /createVerticalConstructiveState|appendVerticalElement|evaluateVerticalAt|saveProfileState|repository|Spot\.|sendCmdAwait/);
	assert.match(wiring, /updateTerminalParabolicComposite/);
	assert.match(wiring, /messaging\.sendCmdAwait\("Spot\.GetState", \{\}\)/);
	assert.doesNotMatch(wiring, /IndexedDB|localStorage|src\/shared\/persistence/);
	assert.match(init, /createTerminalParabolicVerticalCompositeEditController/);
	assert.equal((init.match(/new AlignmentProfileApplicationService\(/g) ?? []).length, 1);
});
