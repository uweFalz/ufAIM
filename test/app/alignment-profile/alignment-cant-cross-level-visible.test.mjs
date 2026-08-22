import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentCantCrossLevelView } from "../../../app/view/alignment-profile/AlignmentCantCrossLevelView.js";
import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

class Element {
	constructor(ownerDocument, tag = "div") { this.ownerDocument = ownerDocument; this.tag = tag; this.children = []; this.dataset = {}; this.attributes = new Map(); this.textContent = ""; }
	append(...children) { this.children.push(...children); }
	replaceChildren(...children) { this.children = [...children]; }
	setAttribute(name, value) { this.attributes.set(name, String(value)); }
	find(predicate) { for (const child of this.children) { if (predicate(child)) return child; const nested = child.find?.(predicate); if (nested) return nested; } return null; }
	querySelector(selector) { const key = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); return key ? this.find((entry) => Object.hasOwn(entry.dataset, key)) : null; }
}
class Document { constructor() { this.panel = new Element(this); } createElement(tag) { return new Element(this, tag); } createElementNS(_ns, tag) { return new Element(this, tag); } getElementById(id) { return id === "cockpitPanel" ? this.panel : null; } }
const projected = { status: "projected", alignmentId: "A1", revision: 2, domain: { parameterKind: "intrinsic-s", startS: 0, endS: 100 }, boundaries: [0, 50, 100], elements: [{ id: "C1", startS: 0, endS: 50 }, { id: "C2", startS: 50, endS: 100 }], samples: [{ elementId: "C1", s: 0, crossLevel: 0.05, twist: 0 }, { elementId: "C2", s: 50, crossLevel: 0.05, twist: 0.001 }, { elementId: "C2", s: 75, crossLevel: 0.07500000000000001, twist: 0.001 }, { elementId: "C2", s: 100, crossLevel: 0.1, twist: 0.001 }], cursor: { status: "evaluated", elementId: "C2", s: 75, crossLevel: 0.07500000000000001, twist: 0.001 }, reference: { status: "partial", workingReference: "midpointGoverningRailEdges", scalarCrossLevelStatus: "partial-evidence", pairedRails: { status: "unknown" }, sourceReference: { status: "unknown" }, transformation: { status: "not-performed" } } };

test("renders exact C1 C2 boundaries path cursor twist and reference evidence", () => {
	const documentRef = new Document();
	const host = new Element(documentRef);
	const view = new AlignmentCantCrossLevelView({ host });
	view.render(projected);
	assert.equal(host.find((node) => Object.hasOwn(node.dataset, "cantCrossLevelStatus")).textContent, "projected");
	assert.equal(host.find((node) => Object.hasOwn(node.dataset, "cantCrossLevelPath")).attributes.get("points"), "28,152 320,152 466,89.99999999999999 612,28");
	assert.equal(host.find((node) => node.dataset.cantElementId === "C1").textContent, "C1");
	assert.equal(host.find((node) => node.dataset.cantElementId === "C2").textContent, "C2");
	assert.deepEqual([0, 50, 100].map((value) => host.find((node) => node.dataset.cantBoundary === String(value)).textContent), ["0", "50", "100"]);
	assert.match(host.find((node) => Object.hasOwn(node.dataset, "cantCursorEvidence")).textContent, /0\.07500000000000001.*0\.001/);
	assert.deepEqual(JSON.parse(host.find((node) => Object.hasOwn(node.dataset, "cantReferenceEvidence")).textContent), projected.reference);
});

test("absent and error evidence render honest empty states without SVG", () => {
	const documentRef = new Document();
	const host = new Element(documentRef);
	const view = new AlignmentCantCrossLevelView({ host });
	view.render({ status: "absent" });
	assert.equal(host.find((node) => Object.hasOwn(node.dataset, "cantCrossLevelEmpty")).textContent, "No persisted Cant state");
	assert.equal(host.find((node) => Object.hasOwn(node.dataset, "cantCrossLevelPlot")), null);
	view.render({ status: "error", error: { message: "invalid Cant" } });
	assert.equal(host.find((node) => Object.hasOwn(node.dataset, "cantCrossLevelEmpty")).textContent, "invalid Cant");
});

test("wiring renders Cant from the same canonical Alignment cursor and revision", async () => {
	const documentRef = new Document();
	const profileState = { vertical: null, cant: { alignmentId: "A1", elements: [{ id: "C1" }] }, chainageMappings: [] };
	let received;
	class MainView { render() {} }
	class CantView { constructor() {} render(value) { received = value; } }
	const wiring = wireAlignmentProfileSynchronizedView({ store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 75 } }), subscribe: () => () => {} }, messaging: { async sendCmdAwait() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision: 2, profileState } } }] }; } }, projectionController: { async projectAt() { return { status: "projected", alignmentId: "A1", revision: 2, cursor: { parameterKind: "intrinsic-s", s: 75 }, profileStatePresence: "present", vertical: { status: "absent" }, chainage: { status: "absent" }, cant: { status: "evaluated" } }; } }, cantCrossLevelController: { project(value) { assert.strictEqual(value.profileState, profileState); assert.equal(value.s, 75); assert.equal(value.revision, 2); return projected; } }, View: MainView, CantCrossLevelView: CantView, documentRef });
	await wiring.refresh();
	assert.strictEqual(received, projected);
	wiring.stop();
});
