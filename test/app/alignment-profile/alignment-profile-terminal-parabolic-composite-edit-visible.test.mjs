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
	querySelector(selector) { const key = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, character) => character.toUpperCase()); return key ? this.find((element) => Object.hasOwn(element.dataset, key)) : null; }
}
class Document { constructor() { this.panel = new Element(this); } createElement(tag) { return new Element(this, tag); } getElementById(id) { return id === "cockpitPanel" ? this.panel : null; } }
const terminal = { id: "V2", type: "parabolic", startS: 50, endS: 120, startElevation: 10.5, startGradient: 0.01, gradientRate: 0.0004 };
const projection = (revision = 1) => ({ status: "projected", alignmentId: "A1", revision,
	cursor: { parameterKind: "intrinsic-s", s: 75 }, profileStatePresence: "present",
	vertical: { status: "evaluated", value: { elementId: "V2", s: 75, elevation: 10.875, gradient: 0.02 } },
	chainage: { status: "absent", mappings: [] }, cant: { status: "absent", reference: { status: "absent" } },
	terminalParabolicVerticalElement: terminal });

test("view exposes exact V2 evidence and submits only identity rate and endS", () => {
	const documentRef = new Document(), host = new Element(documentRef), view = new AlignmentProfileSynchronizedView({ host });
	let submitted;
	view.setTerminalParabolicCompositeEditHandler((value) => { submitted = value; });
	view.render(projection());
	const details = host.find((node) => Object.hasOwn(node.dataset, "terminalParabolicCompositeEdit"));
	assert.ok(details);
	assert.match(details.find((node) => Object.hasOwn(node.dataset, "terminalParabolicCompositeIdentity")).textContent, /"elementId": "V2"/);
	const rate = details.find((node) => node.name === "terminalParabolicCompositeGradientRate");
	const endS = details.find((node) => node.name === "terminalParabolicCompositeEndS");
	assert.equal(rate.value, "0.0004"); assert.equal(endS.value, "120");
	rate.value = "0.0002"; endS.value = "150";
	details.find((node) => node.tag === "button" && node.textContent === "Apply parabolic fields").onclick();
	assert.deepEqual(submitted, { elementId: "V2", gradientRate: "0.0002", endS: "150" });
});

test("form is absent for non-parabolic or unavailable terminal evidence", () => {
	for (const evidence of [null, { ...terminal, type: "constant-gradient" }]) {
		const documentRef = new Document(), host = new Element(documentRef), view = new AlignmentProfileSynchronizedView({ host });
		view.setTerminalParabolicCompositeEditHandler(() => {});
		view.render({ ...projection(), terminalParabolicVerticalElement: evidence });
		assert.equal(host.find((node) => Object.hasOwn(node.dataset, "terminalParabolicCompositeEdit")), null);
	}
});

test("wiring supplies canonical context and refreshes from matching SPOT readback", async () => {
	const documentRef = new Document(); let revision = 1;
	let profileState = { vertical: { id: "VS1", alignmentId: "A1", elements: [terminal] }, cant: null, chainageMappings: [] };
	let received;
	class View { setTerminalParabolicCompositeEditHandler(handler) { this.handler = handler; } renderTerminalParabolicCompositeEditStatus(value) { this.status = value; } render(value) { this.value = value; } }
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 75 } }), subscribe: () => () => {} }, documentRef,
		messaging: { async sendCmdAwait() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision, profileState } } }] }; } },
		projectionController: { async projectAt() { return projection(revision); } },
		terminalParabolicVerticalCompositeEditController: { async update(value) { received = value; revision = 2; profileState = { ...value.profileState, vertical: { ...value.profileState.vertical, edited: true } }; return { snapshot: { revision }, profileState, projection: projection(revision) }; } },
		View,
	});
	const result = await wiring.updateTerminalParabolicComposite({ elementId: "V2", gradientRate: "0.0002", endS: "150" });
	assert.equal(received.alignmentId, "A1"); assert.equal(received.revision, 1); assert.equal(received.s, 75); assert.equal(result.snapshot.revision, 2);
	wiring.stop();
});
