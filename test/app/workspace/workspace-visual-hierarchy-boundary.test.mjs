import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../../../app/styles/app.css", import.meta.url), "utf8");

test("visual package preserves semantics and exposes focus disabled loading error", () => {
	const section = css.slice(css.indexOf("Canvas-first professional workspace hierarchy"));
	assert.match(section, /:focus-visible/);
	assert.match(section, /:disabled/);
	assert.match(section, /phase="loading"|state="loading"/);
	assert.match(section, /phase="error"|state="error"/);
	assert.doesNotMatch(section, /display:\s*none|visibility:\s*hidden|content:\s*["']/);
	assert.doesNotMatch(section, /@keyframes|animation:/);
});

test("desktop and narrow layouts retain bounded tool and content surfaces", () => {
	const section = css.slice(css.indexOf("Canvas-first professional workspace hierarchy"));
	assert.match(section, /@media \(min-width: 761px\)/);
	assert.match(section, /@media \(max-width: 760px\)/);
	assert.match(section, /overflow-x:\s*auto/);
	assert.match(section, /max-height:\s*42vh/);
	assert.match(section, /data-tool-presentation="sheet"/);
	assert.match(section, /\.uf-shell\[data-tool-dock\] \.uf-startSurface/);
	assert.match(section, /\.uf-startSurface\s*\{[\s\S]*?overflow-x:\s*hidden[\s\S]*?overflow-y:\s*auto/);
	assert.match(section, /@media \(max-width: 760px\)[\s\S]*?\.uf-startSurface\s*\{[\s\S]*?grid-template-rows:\s*auto auto auto/);
	assert.match(section, /#gndImportWorkbenchOverlay\[data-tool-presentation="dock"\] \.gnd-wb-start-paths/);
	assert.match(section, /@media \(max-width: 760px\)[\s\S]*?#gndImportWorkbenchOverlay\[data-tool-presentation="sheet"\] \.gnd-wb-start-paths/);
	assert.doesNotMatch(section, /#gndImportWorkbenchOverlay:not\([^)]*data-tool-presentation[^)]*\) \.gnd-wb-start-paths/);
});
