import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("controller depends only on canonical Cant evaluation with no local law", async () => {
	const source = await read("app/controllers/alignment-profile/createCantCrossLevelViewController.js");
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
	assert.deepEqual(imports, ["../../../src/aim-core/alignment/profile/CantConstructiveState.js"]);
	assert.match(source, /evaluateCantAt/);
	assert.doesNotMatch(source, /crossLevelRate\s*\*|saveProfileState|repository|Spot\.|Worker|Messaging|IndexedDB|localStorage|document|window/);
});

test("Cant view is import-free and wiring contains no Cant write or cursor mutation", async () => {
	const [view, wiring, init] = await Promise.all([
		read("app/view/alignment-profile/AlignmentCantCrossLevelView.js"),
		read("app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js"),
		read("app/runtime/init/initFeatures.js"),
	]);
	assert.doesNotMatch(view, /^import\s/m);
	assert.doesNotMatch(view, /evaluateCantAt|appendCantElement|saveProfileState|repository|Spot\.|sendCmdAwait|setCursorS|crossLevelRate\s*\*/);
	assert.match(wiring, /renderCantCrossLevel/);
	assert.doesNotMatch(wiring, /cantCrossLevelController\.save|cantCrossLevelView\.setCursor/);
	assert.match(init, /createCantCrossLevelViewController/);
	assert.match(init, /AlignmentCantCrossLevelView/);
});
