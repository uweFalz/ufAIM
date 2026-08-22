import assert from "node:assert/strict";
import test from "node:test";
import { ExistingAlignmentIntelligenceView } from "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js";

function node() { return { dataset: {}, children: [], textContent: "", hidden: false, disabled: false, append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; }, addEventListener(type, handler) { this.handler = handler; }, querySelector() { return null; } }; }

test("selected element exposes exact professional property and existing edit action", () => {
	const panel = node(), calls = []; const root = { dataset: {}, querySelector: (selector) => selector.includes("cross-view-element") ? panel : null, append() {} };
	const view = new ExistingAlignmentIntelligenceView({ documentRef: { getElementById: () => root, createElement: () => node() }, actions: { openCant: () => calls.push("cant") } });
	view.render({ mode: "l", context: { objectId: "A", s: 25 }, capabilities: {}, elementSelection: { status: "selected", selection: { objectId: "A", discipline: "cant", elementId: "C1" }, property: { type: "constant-cross-level", domain: { startS: 0, endS: 50 }, properties: { id: "C1", startCrossLevel: 0.04 }, provenancePresent: true, action: "openCant" } } });
	assert.equal(panel.dataset.elementDiscipline, "cant"); assert.equal(panel.dataset.elementId, "C1"); assert.match(panel.children[1].textContent, /s 0\.\.50/); assert.match(panel.children[2].textContent, /startCrossLevel/); panel.children[4].handler(); assert.deepEqual(calls, ["cant"]);
});
