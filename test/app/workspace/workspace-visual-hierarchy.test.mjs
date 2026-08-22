import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../../../app/styles/app.css", import.meta.url), "utf8");

test("canvas-first hierarchy gives compact chrome and bounded intelligence", () => {
	assert.match(css, /Canvas-first professional workspace hierarchy/);
	assert.match(css, /\.uf-toolbar\s*\{[\s\S]*?height:\s*48px/);
	assert.match(css, /\.uf-workspaceContextBar\s*\{[\s\S]*?min-height:\s*32px/);
	assert.match(css, /\.uf-alignmentIntelligence\s*\{[\s\S]*?max-height:\s*min\(46vh, 520px\)[\s\S]*?overflow:\s*auto/);
	assert.match(css, /scrollbar-gutter:\s*stable/);
});

test("existing professional surfaces share visible card hierarchy", () => {
	for (const selector of ["data-alignment-engineering-hud", "data-alignment-design-session", "data-design-issue-navigator", "data-canonical-authoring-receipt-rail", "data-alignment-task-rail", "data-alignment-seven-line-bands"]) assert.match(css, new RegExp(selector));
	assert.match(css, /#overlay-root > \[data-tool-surface\]/);
	assert.match(css, /data-tool-presentation="dock"/);
	assert.match(css, /data-tool-presentation="sheet"/);
});

test("guided start separates copy actions and footer when a desktop dock narrows the canvas", () => {
	assert.match(css, /\.uf-shell\[data-tool-dock\] \.uf-startSurface\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*?grid-template-rows:\s*auto auto auto[\s\S]*?align-content:\s*start/);
	assert.match(css, /\.uf-shell\[data-tool-dock\] \.uf-startSurface__actions\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
	assert.match(css, /\.uf-startAction :is\(strong, span\)[\s\S]*?overflow-wrap:\s*anywhere/);
});

test("actual GND Workbench start cards become one column only inside dock or sheet", () => {
	assert.match(css, /#gndImportWorkbenchOverlay\[data-tool-presentation="dock"\] \.gnd-wb-start-paths\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
	assert.match(css, /#gndImportWorkbenchOverlay\[data-tool-presentation="sheet"\] \.gnd-wb-start-paths\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
	assert.match(css, /#gndImportWorkbenchOverlay\[data-tool-presentation="dock"\] \.gnd-wb-start-path :is\(h2, strong, p, span\)[\s\S]*?overflow-wrap:\s*anywhere/);
	assert.match(css, /#gndImportWorkbenchOverlay\[data-tool-presentation="dock"\] \.uf-panel__body\s*\{\s*overflow-x:\s*hidden/);
});
