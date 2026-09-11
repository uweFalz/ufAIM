import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../../app/styles/app.css", import.meta.url), "utf8");
function rule(selector) {
	const start = css.indexOf(`${selector} {`);
	assert.ok(start >= 0, `missing ${selector}`);
	return css.slice(start, css.indexOf("}", start) + 1);
}

test("collapsed Cockpit hides its controls, rather than only painting them transparent", () => {
	assert.match(rule(".uf-shell.is-cockpit-collapsed .uf-cockpitPanel"), /visibility:\s*hidden\s*;/);
});

test("L retains the visible profile workspace even when the sidebar is collapsed", () => {
	assert.match(rule('.uf-shell[data-workspace-view="l"].is-cockpit-collapsed .uf-cockpitPanel'), /visibility:\s*visible\s*;/);
});
