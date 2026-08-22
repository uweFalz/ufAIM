import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("lookup controller uses only canonical inverse mapping and injected projection", async () => {
	const source = await read("app/controllers/alignment-profile/createChainageAddressLookupController.js");
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
	assert.deepEqual(imports, ["../../../src/aim-core/alignment/profile/ChainageMapping.js"]);
	assert.match(source, /mapChainageToIntrinsic/);
	assert.doesNotMatch(source, /saveProfileState|repository|Spot\.|Worker|Messaging|IndexedDB|localStorage|document|window|parseFloat/);
});

test("view stays render-only and wiring owns the canonical read plus sole cursor action", async () => {
	const [view, wiring, init] = await Promise.all([
		read("app/view/alignment-profile/AlignmentProfileSynchronizedView.js"),
		read("app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js"),
		read("app/runtime/init/initFeatures.js"),
	]);
	assert.doesNotMatch(view, /^import\s/m);
	assert.doesNotMatch(view, /saveProfileState|repository|Spot\.|sendCmdAwait|setCursorS|mapChainageToIntrinsic/);
	assert.match(wiring, /lookupChainageAddress/);
	assert.match(wiring, /messaging\.sendCmdAwait\("Spot\.GetState", \{\}\)/);
	assert.equal((wiring.match(/store\.actions\.setCursorS\(candidate\.s\)/g) ?? []).length, 1);
	assert.doesNotMatch(wiring, /saveProfileState|IndexedDB|localStorage/);
	assert.match(init, /createChainageAddressLookupController/);
	assert.equal((init.match(/new AlignmentProfileApplicationService\(/g) ?? []).length, 1);
});
