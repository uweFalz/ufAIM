import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const shell = await readFile(new URL("../../../app/view/shell/buildWindowShell.js", import.meta.url), "utf8");
const sync = await readFile(new URL("../../../app/controllers/viewUiSync.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../../../app/ui/uiWiring.js", import.meta.url), "utf8");
const css = await readFile(new URL("../../../app/styles/app.css", import.meta.url), "utf8");

test("initial cross-section is one synchronized q/L projection of existing section sampling", () => {
	assert.match(shell, /id="initialCrossSection"/);
	assert.match(sync, /setInitialCrossSection/);
	assert.match(sync, /sectionInfo/);
	assert.match(ui, /dataset\.initialSectionStatus = available \? "located" : "unavailable"/);
	assert.match(css, /data-workspace-view="q"[^}]*\.uf-initialSection/s);
	assert.match(css, /data-workspace-view="l"[^}]*\.uf-initialSection/s);
});

test("initial cross-section fabricates no rail section or station semantics", () => {
	assert.match(shell, /Local alignment reference frame/);
	assert.match(ui, /Reference frame only · no qualified rail or section evidence/);
	assert.doesNotMatch(ui, /gauge|railDistance|platformHeight|stationing/i);
});
