import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function read(path) { return readFile(new URL(`../../../${path}`, import.meta.url), "utf8"); }

test("desktop dock leaves workspace modes outside the tool surface and tools are mutually exclusive", async () => {
	const [shell, ui, workbench, css] = await Promise.all([read("app/view/shell/buildWindowShell.js"), read("app/ui/uiWiring.js"), read("app/gndImportWorkbench/gndImportWorkbenchController.js"), read("app/styles/app.css")]);
	assert.match(shell, /data-workspace-view-mode="main"/); assert.match(shell, /data-tool-surface/);
	assert.match(ui, /btnGndImportWorkbenchClose/); assert.match(workbench, /btnSpotClose/);
	assert.match(css, /@media \(min-width: 761px\)/); assert.match(css, /\.uf-shell\[data-tool-dock\] \.uf-workspace/);
	assert.doesNotMatch([ui, workbench].join("\n"), /Spot\.Save|Import\.Commit|localStorage|sessionStorage/);
});

test("mobile sheet and Escape use only existing close callbacks", async () => {
	const [ui, workbench, css, spot] = await Promise.all([read("app/ui/uiWiring.js"), read("app/gndImportWorkbench/gndImportWorkbenchController.js"), read("app/styles/app.css"), read("app/view/overlays/spotView.js")]);
	assert.match(css, /@media \(max-width: 760px\)/); assert.match(css, /data-tool-presentation="sheet"/);
	assert.match(workbench, /event\?\.key === "Escape"/); assert.match(workbench, /close\(\)/);
	assert.match(spot, /event\.key !== "Escape"/); assert.match(spot, /btnSpotClose/);
	assert.match(ui, /geoStage/); assert.match(workbench, /geoStage/);
});
