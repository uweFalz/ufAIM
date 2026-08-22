import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const shell = await readFile(new URL("../../../app/view/shell/buildWindowShell.js", import.meta.url), "utf8");
const view = await readFile(new URL("../../../app/view/workspace/ExistingAlignmentIntelligenceView.js", import.meta.url), "utf8");
const css = await readFile(new URL("../../../app/styles/app.css", import.meta.url), "utf8");
const workbench = await readFile(new URL("../../../app/gndImportWorkbench/gndImportWorkbenchView.js", import.meta.url), "utf8");

test("Alignment Intelligence remains a first-class surface above Main q and L", () => {
	assert.match(shell, /id="alignmentIntelligence"/);
	assert.match(shell, /data-alignment-intelligence-capabilities/);
	assert.match(view, /horizontal.*vertical.*cant.*chainage.*crs.*speed.*topology.*section/);
	assert.match(view, /context\.objectId.*context\.revision.*context\.s/s);
	assert.match(css, /data-alignment-capability-status="constructive"/);
	assert.match(css, /data-alignment-capability-status="partial-evidence"/);
	assert.match(css, /data-alignment-capability-status="not-covered"/);
	assert.match(css, /data-alignment-capability-status="missing"/);
});

test("the import workbench leads with one EL EH EU EK knowledge finding", () => {
	assert.match(workbench, /Alignment-Befund/);
	assert.match(workbench, /Was ist fachlich verwendbar\?/);
	assert.match(workbench, /\["horizontal", "vertical", "cant", "chainage"\]/);
	assert.match(workbench, /dataset\.alignmentCapabilityStatus = entry\.status/);
	assert.match(css, /gnd-wb-alignment-finding__grid/);
});
