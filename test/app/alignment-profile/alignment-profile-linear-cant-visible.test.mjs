import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentProfileSynchronizedView } from "../../../app/view/alignment-profile/AlignmentProfileSynchronizedView.js";
import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

class Element {
	constructor(ownerDocument, tag = "div") { this.ownerDocument = ownerDocument; this.tag = tag; this.children = []; this.dataset = {}; this.textContent = ""; this.value = ""; }
	append(...children) { this.children.push(...children); }
	replaceChildren(...children) { this.children = [...children]; }
	setAttribute() {}
	find(predicate) { for (const child of this.children) { if (predicate(child)) return child; const nested = child.find?.(predicate); if (nested) return nested; } return null; }
	querySelector(selector) { const key = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); return key ? this.find((entry) => Object.hasOwn(entry.dataset, key)) : null; }
}
class Document { constructor() { this.panel = new Element(this); } createElement(tag) { return new Element(this, tag); } getElementById(id) { return id === "cockpitPanel" ? this.panel : null; } }
const projection = (revision = 1) => ({ status: "projected", alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s: 75 }, profileStatePresence: "present", vertical: { status: "evaluated" }, chainage: { status: "evaluated" }, cant: { status: "evaluated", value: { elementId: "C1" }, reference: { status: "partial" } } });

test("view exposes only three explicit linear fields with unchanged convention evidence", () => {
	const documentRef = new Document();
	const host = new Element(documentRef);
	const view = new AlignmentProfileSynchronizedView({ host });
	let submitted;
	view.setLinearCantHandler((value) => { submitted = value; });
	view.render(projection());
	const details = host.find((node) => Object.hasOwn(node.dataset, "linearCantElement"));
	assert.equal(details.children[0].textContent, "Append linear cross-level");
	const expected = { linearCantElementId: "C2", linearCantEndS: "100", crossLevelRate: "0.001" };
	for (const [name, value] of Object.entries(expected)) { const input = details.find((node) => node.name === name); assert.equal(input.value, ""); input.value = value; }
	details.find((node) => node.textContent === "Append linear cross-level" && node.tag === "button").onclick();
	assert.deepEqual(submitted, { elementId: "C2", endS: "100", crossLevelRate: "0.001" });
	const evidence = JSON.parse(details.find((node) => Object.hasOwn(node.dataset, "linearCantConvention")).textContent);
	assert.equal(evidence.quantity, "cross-level");
	assert.equal(evidence.signConvention, "left-minus-right-viewed-in-increasing-s");
	assert.equal(evidence.scalarCrossLevelStatus, "partial-evidence");
	assert.equal(evidence.transformation, "not-performed");
});

test("form is unavailable when canonical Cant evidence is absent", () => {
	const documentRef = new Document();
	const host = new Element(documentRef);
	const view = new AlignmentProfileSynchronizedView({ host });
	view.setLinearCantHandler(() => {});
	view.render({ ...projection(), cant: { status: "absent", reference: { status: "absent" } } });
	assert.equal(host.find((node) => Object.hasOwn(node.dataset, "linearCantElement")), null);
});

test("wiring appends from canonical state and renders only matching SPOT readback", async () => {
	const documentRef = new Document();
	let profileState = { vertical: { alignmentId: "A1" }, cant: { alignmentId: "A1", elements: [{ id: "C1" }] }, chainageMappings: [{ alignmentId: "A1" }] };
	let revision = 1;
	let received;
	class View { setLinearCantHandler(handler) { this.handler = handler; } renderLinearCantStatus(value) { this.status = value; } render(value) { this.value = value; } }
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 75 } }), subscribe: () => () => {} }, documentRef,
		messaging: { async sendCmdAwait() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision, profileState } } }] }; } },
		projectionController: { async projectAt() { return projection(revision); } },
		linearCantAuthoringController: { async append(value) { received = value; profileState = { vertical: value.profileState.vertical, cant: { alignmentId: "A1", elements: [{ id: "C1" }, { id: "C2" }] }, chainageMappings: value.profileState.chainageMappings }; revision = 2; return { snapshot: { revision }, profileState, projection: projection(revision) }; } }, View,
	});
	const result = await wiring.appendLinearCantElement({ elementId: "C2", endS: "100", crossLevelRate: "0.001" });
	assert.equal(received.revision, 1);
	assert.strictEqual(received.profileState.vertical, profileState.vertical);
	assert.equal(result.revision, 2);
	wiring.stop();
});
