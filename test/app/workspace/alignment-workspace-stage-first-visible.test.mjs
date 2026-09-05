import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("AIM starts stage-first with Workbench quiet and Cockpit collapsed", async () => {
	const [shell, workbench] = await Promise.all([
		read("app/view/shell/buildWindowShell.js"),
		read("app/gndImportWorkbench/gndImportWorkbenchController.js"),
	]);
	assert.match(shell, /uf-shell is-intelligence-collapsed is-cockpit-collapsed/);
	assert.doesNotMatch(workbench, /refreshWorkspaceState\(\)\.then\(showOverlay, showOverlay\)/);
	assert.match(workbench, /void refreshWorkspaceState\(\);/);
});
