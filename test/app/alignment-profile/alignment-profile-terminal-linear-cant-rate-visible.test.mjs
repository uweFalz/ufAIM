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

const terminal = Object.freeze({ id: "C2", type: "linear-cross-level", startS: 50, endS: 100, startCrossLevel: 0.05, crossLevelRate: 0.001 });
const projection = (revision = 1, s = 75) => ({ status: "projected", alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s }, profileStatePresence: "present", vertical: { status: "not-covered" }, chainage: { status: "not-covered" }, cant: { status: "evaluated", value: { elementId: "C2", s, crossLevel: 0.07500000000000001, twist: 0.001 }, reference: { status: "partial" } }, terminalLinearCantElement: terminal });

test("view displays exact terminal identity and submits only identity plus explicit rate", () => {
	const documentRef = new Document();
	const host = new Element(documentRef);
	const view = new AlignmentProfileSynchronizedView({ host });
	let submitted;
	view.setTerminalLinearCantRateHandler((value) => { submitted = value; });
	view.render(projection());
	const details = host.find((node) => Object.hasOwn(node.dataset, "terminalLinearCantRateEdit"));
	assert.ok(details);
	assert.deepEqual(JSON.parse(details.find((node) => Object.hasOwn(node.dataset, "terminalLinearCantIdentity")).textContent), {
		elementId: "C2", type: "linear-cross-level", startS: 50, endS: 100, crossLevelRate: 0.001,
	});
	const input = details.find((node) => node.name === "terminalLinearCantCrossLevelRate");
	assert.equal(input.value, "0.001");
	input.value = "0.002";
	details.find((node) => node.tag === "button" && node.textContent === "Apply cross-level rate").onclick();
	assert.deepEqual(submitted, { elementId: "C2", crossLevelRate: "0.002" });
});

test("view exposes no edit for non-terminal active or non-linear evidence", () => {
	for (const value of [null, { ...terminal, type: "constant-cross-level" }]) {
		const documentRef = new Document();
		const host = new Element(documentRef);
		const view = new AlignmentProfileSynchronizedView({ host });
		view.setTerminalLinearCantRateHandler(() => {});
		view.render({ ...projection(), terminalLinearCantElement: value });
		assert.equal(host.find((node) => Object.hasOwn(node.dataset, "terminalLinearCantRateEdit")), null);
	}
});

test("wiring supplies canonical context, verifies SPOT readback and refreshes saved evidence", async () => {
	const documentRef = new Document();
	let revision = 1;
	let profileState = { vertical: { alignmentId: "A1" }, cant: { alignmentId: "A1", elements: [{ id: "C1" }, terminal] }, chainageMappings: [{ alignmentId: "A1" }] };
	let received;
	class View {
		setTerminalLinearCantRateHandler(handler) { this.handler = handler; }
		renderTerminalLinearCantRateStatus(value) { this.status = value; }
		render(value) { this.value = value; }
	}
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 75 } }), subscribe: () => () => {} },
		documentRef,
		messaging: { async sendCmdAwait() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision, profileState } } }] }; } },
		projectionController: { async projectAt() { return projection(revision); } },
		terminalLinearCantRateEditController: { async update(value) { received = value; revision = 2; profileState = { ...value.profileState, cant: { ...value.profileState.cant, elements: [value.profileState.cant.elements[0], { ...terminal, crossLevelRate: 0.002 }] } }; return { snapshot: { revision }, profileState, projection: projection(revision) }; } },
		View,
	});
	const result = await wiring.updateTerminalLinearCantRate({ elementId: "C2", crossLevelRate: "0.002" });
	assert.equal(received.alignmentId, "A1");
	assert.equal(received.revision, 1);
	assert.equal(received.s, 75);
	assert.equal(result.snapshot.revision, 2);
	wiring.stop();
});
