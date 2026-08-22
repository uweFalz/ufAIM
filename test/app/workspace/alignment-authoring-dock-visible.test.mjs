import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { ExistingAlignmentIntelligenceView } from "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js";

function node() { return { dataset: {}, children: [], textContent: "", hidden: false, disabled: false, append(...xs) { this.children.push(...xs); }, replaceChildren(...xs) { this.children = xs; }, addEventListener(_, fn) { this.handler = fn; }, querySelector() { return null; } }; }

test("selected horizontal element exposes exact authoring identity", () => {
	const panel = node(), calls = [], root = { dataset: {}, querySelector: s => s.includes("cross-view-element") ? panel : null, append() {} };
	const view = new ExistingAlignmentIntelligenceView({ documentRef: { getElementById: () => root, createElement: () => node() }, actions: { openHorizontal: value => calls.push(value) } });
	view.render({ mode: "main", context: { objectId: "A", s: 25 }, capabilities: {}, elementSelection: { status: "selected", selection: { objectId: "A", discipline: "horizontal", elementId: "H1" }, property: { type: "arc", domain: { startS: 0, endS: 50 }, properties: { id: "H1" }, provenancePresent: false, action: "openHorizontal" } } });
	const button = panel.children[4]; assert.equal(button.dataset.authoringDiscipline, "horizontal"); assert.equal(button.dataset.authoringElementId, "H1"); button.handler(); assert.deepEqual(calls, [{ source: "workspace-property", objectId: "A", discipline: "horizontal", elementId: "H1" }]);
});

test("shell and styling expose dock plus honest authoring states", () => {
	const shell = fs.readFileSync(new URL("../../../app/view/shell/buildWindowShell.js", import.meta.url), "utf8"), css = fs.readFileSync(new URL("../../../app/styles/app.css", import.meta.url), "utf8");
	assert.match(shell, /alignmentEditorOverlay[^>]+data-tool-surface[^>]+data-tool-kind="authoring"/);
	for (const state of ["dirty", "saving", "saved", "error"]) assert.match(css, new RegExp(`data-authoring-state="${state}"`));
});
