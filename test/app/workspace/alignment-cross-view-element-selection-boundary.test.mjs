import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function read(path) { return readFile(new URL(`../../../${path}`, import.meta.url), "utf8"); }

test("shared selection remains window-local and uses existing store actions", async () => {
	const sources = await Promise.all([read("app/runtime/state/windowStore.js"), read("app/controllers/viewController.js"), read("app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js")]);
	const source = sources.join("\n");
	assert.match(source, /elementDiscipline/); assert.match(source, /setWorkspaceSelection/); assert.match(source, /"horizontal"/); assert.match(source, /"vertical", "cant", "chainage"/);
	for (const selectionSource of [sources[0], sources[2]]) {
		assert.doesNotMatch(selectionSource, /localStorage|sessionStorage|Spot\.Save/);
	}
});

test("property model performs exact id lookup without cross-discipline or nearest inference", async () => {
	const source = await read("app/domain/workspace/buildCrossViewElementSelectionModel.js");
	assert.match(source, /String\(entry\?\.id/); assert.doesNotMatch(source, /nearest|distance|proximity|station.*derive|topolog|Math\./i);
});

test("L selection moves cursor only from an explicitly supplied finite boundary", async () => {
	const source = (await Promise.all([read("app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js"), read("app/view/alignment-profile/AlignmentProfileSynchronizedView.js")])).join("\n");
	assert.match(source, /Number\.isFinite\(exactS\)/); assert.match(source, /Number\.isFinite\(entry\.startS\) \? entry\.startS : null/); assert.doesNotMatch(source, /nearest|projectPoint|interpolat/i);
	assert.match(source, /crossViewSelection/); assert.match(source, /aria-pressed/); assert.match(source, /elementDiscipline === lane/);
});
