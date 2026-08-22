import assert from "node:assert/strict";
import test from "node:test";
import { ExistingAlignmentIntelligenceView } from "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js";

function node() { return { dataset: {}, children: [], textContent: "", hidden: false, append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; }, addEventListener() {}, querySelector() { return null; } }; }

test("q foreground visibly prioritizes current facts and a truthful ahead boundary", () => {
	const lok = node(); const root = { dataset: {}, querySelector(selector) { return selector.includes("q-lok") ? lok : null; }, append() {} };
	const view = new ExistingAlignmentIntelligenceView({ documentRef: { getElementById: () => root, createElement: () => node() } });
	view.render({ mode: "q", context: { objectId: "A", s: 25 }, capabilities: {}, qLokEngineeringView: { visible: true, context: { objectId: "A", s: 25, route: "1720", sourceRole: "1", cameraMode: "local-engineering" }, fields: [{ id: "vertical", label: "Höhe / Gradiente", status: "constructive", value: { elevation: 10.5, gradient: 0.01 }, provenancePresent: true }, { id: "cant", label: "Überhöhung / Twist", status: "partial-evidence", reason: "EU source only", provenancePresent: true }], ahead: { s: 50, lanes: ["vertical"], status: "existing-boundary" } } });
	assert.equal(lok.hidden, false); assert.equal(lok.dataset.objectId, "A"); assert.equal(lok.dataset.cursorS, "25");
	assert.match(lok.children[0].children[1].textContent, /A · s 25 · Strecke 1720 · Quellrolle 1 · LOCAL engineering camera/);
	assert.equal(lok.children[1].children[1].dataset.qLokStatus, "partial-evidence"); assert.match(lok.children[1].children[1].children[2].textContent, /Provenienz vorhanden/);
	assert.match(lok.children[2].textContent, /nächste vorhandene Grenze s 50 · vertical/);
});

test("q without an existing next endpoint explicitly avoids an ahead claim", () => {
	const lok = node(); const root = { dataset: {}, querySelector: (selector) => selector.includes("q-lok") ? lok : null, append() {} };
	new ExistingAlignmentIntelligenceView({ documentRef: { getElementById: () => root, createElement: () => node() } }).render({ mode: "q", context: { objectId: "A", s: 25 }, capabilities: {}, qLokEngineeringView: { visible: true, context: { objectId: "A", s: 25 }, fields: [], ahead: null } });
	assert.match(lok.children.at(-1).textContent, /keine vorhandene nächste Grenze belegt/);
});
