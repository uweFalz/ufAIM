import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("../../../app/view/shell/buildWindowShell.js", import.meta.url), "utf8");
const wiring = await readFile(new URL("../../../app/ui/uiWiring.js", import.meta.url), "utf8");
const css = await readFile(new URL("../../../app/styles/app.css", import.meta.url), "utf8");

test("alignment intelligence starts compact while preserving an explicit details control", () => {
	assert.match(shell, /class="uf-shell is-intelligence-collapsed"/);
	assert.match(shell, /id="btnAlignmentIntelligence"/);
	assert.match(shell, /aria-controls="alignmentIntelligence"/);
	assert.match(shell, /aria-expanded="false"/);
});

test("details control changes presentation state without replacing workspace authority", () => {
	assert.match(wiring, /classList\.toggle\("is-intelligence-collapsed"\)/);
	assert.match(wiring, /setAttribute\("aria-expanded", String\(!collapsed\)\)/);
	assert.doesNotMatch(wiring, /alignmentIntelligence[^\n]*(remove|replaceChildren|innerHTML)/);
});

test("collapsed intelligence retains its trust header and hides only progressive detail", () => {
	assert.match(css, /\.uf-shell\.is-intelligence-collapsed \.uf-alignmentIntelligence > :not\(header\)\s*\{\s*display:none/);
	assert.match(css, /\.uf-shell\.is-intelligence-collapsed \.uf-alignmentIntelligence\s*\{[^}]*max-height:44px;[^}]*overflow:hidden/);
});
