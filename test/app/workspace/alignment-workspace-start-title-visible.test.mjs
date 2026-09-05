import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Workspace start asks a concrete project question instead of making an abstract claim", async () => {
	const shell = await readFile(new URL("../../../app/view/shell/buildWindowShell.js", import.meta.url), "utf8");
	assert.match(shell, /<h1 id="workspaceStartTitle">Wo soll deine Trassierung entstehen\?<\/h1>/);
	assert.doesNotMatch(shell, /Arbeite mit einem Alignment/);
});
