import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentProfileSynchronizedView } from "../../../app/view/alignment-profile/AlignmentProfileSynchronizedView.js";
import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

class Element {
	constructor(ownerDocument) { this.ownerDocument = ownerDocument; this.children = []; this.dataset = {}; this.attributes = new Map(); this.textContent = ""; this.value = ""; }
	append(...children) { this.children.push(...children); }
	replaceChildren(...children) { this.children = [...children]; }
	setAttribute(name, value) { this.attributes.set(name, String(value)); }
	find(predicate) { for (const child of this.children) { if (predicate(child)) return child; const nested = child.find?.(predicate); if (nested) return nested; } return null; }
	querySelector(selector) { const key = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); return key ? this.find((entry) => Object.hasOwn(entry.dataset, key)) : null; }
}
class Document {
	constructor() { this.panel = new Element(this); }
	createElement() { return new Element(this); }
	getElementById(id) { return id === "cockpitPanel" ? this.panel : null; }
}

const projection = (revision = 1, evaluated = false) => ({
	status: "projected", alignmentId: "A1", revision,
	cursor: { parameterKind: "intrinsic-s", s: 25 }, profileStatePresence: "present",
	vertical: { status: "evaluated", value: { elevation: 10.25, gradient: 0.01 } },
	chainage: { status: "evaluated", mappings: [{ candidates: [{ address: 1025 }] }] },
	cant: evaluated ? {
		status: "evaluated", value: { crossLevel: 0.05, twist: 0, quantity: "cross-level", unit: "alignment-length-unit", signConvention: "left-minus-right-viewed-in-increasing-s" },
		reference: { status: "partial", workingReference: "midpointGoverningRailEdges", scalarCrossLevelStatus: "partial-evidence", pairedRails: { status: "unknown" }, sourceReference: { status: "unknown" }, transformation: { status: "not-performed" } },
	} : { status: "absent", reference: { status: "absent" } },
});

test("visible form is explicit and shows the bounded GAP2-D003 evidence", () => {
	const documentRef = new Document();
	const host = new Element(documentRef);
	const view = new AlignmentProfileSynchronizedView({ host });
	let submitted;
	view.setBasicCantHandler((value) => { submitted = value; });
	view.render(projection());
	const details = host.find((node) => Object.hasOwn(node.dataset, "basicCantCrossLevel"));
	assert.equal(details.children[0].textContent, "Basic constant cross-level");
	const evidence = details.find((node) => Object.hasOwn(node.dataset, "basicCantConvention"));
	for (const value of ["constant-cross-level", "cross-level", "alignment-length-unit", "left-minus-right-viewed-in-increasing-s", "partial-evidence", "midpointGoverningRailEdges", "unknown", "not-performed"]) assert.match(evidence.textContent, new RegExp(value));
	const names = ["cantStateId", "elementId", "startS", "endS", "startCrossLevel"];
	const values = { cantStateId: "CANT1", elementId: "C1", startS: "0", endS: "50", startCrossLevel: "0.05" };
	for (const name of names) {
		const input = details.find((node) => node.name === name);
		assert.equal(input.value, "");
		input.value = values[name];
	}
	details.find((node) => node.textContent === "Save constant cross-level").onclick();
	assert.deepEqual(submitted, values);
});

test("wiring uses canonical context and renders only matching readback", async () => {
	const documentRef = new Document();
	let profileState = { vertical: { alignmentId: "A1", elements: [] }, cant: null, chainageMappings: [{ alignmentId: "A1", id: "CH1" }] };
	let revision = 1;
	const state = () => ({ objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision, profileState } } }] });
	class View {
		setBasicCantHandler(handler) { this.handler = handler; }
		renderBasicCantStatus(value) { this.status = value; }
		render(value) { this.value = value; }
	}
	let received;
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 25 } }), subscribe: () => () => {} },
		messaging: { async sendCmdAwait() { return state(); } }, documentRef,
		projectionController: { async projectAt() { return projection(revision); } },
		cantAuthoringController: { async submit(value) {
			received = value;
			profileState = { vertical: value.profileState.vertical, cant: { alignmentId: "A1", id: "CANT1" }, chainageMappings: value.profileState.chainageMappings };
			revision = 2;
			return { snapshot: { revision: 2 }, profileState, projection: projection(2, true) };
		} }, View,
	});
	const result = await wiring.submitBasicCant({ cantStateId: "CANT1" });
	assert.equal(received.alignmentId, "A1");
	assert.equal(received.revision, 1);
	assert.equal(received.s, 25);
	assert.equal(result.cant.value.crossLevel, 0.05);
	assert.equal(result.vertical.value.elevation, 10.25);
	assert.equal(result.chainage.mappings[0].candidates[0].address, 1025);
	wiring.stop();
});

test("empty visible submit reports invalid without success", async () => {
	const documentRef = new Document();
	class View { setBasicCantHandler(handler) { this.handler = handler; } renderBasicCantStatus(value) { this.status = value; } render() {} }
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 25 } }), subscribe: () => () => {} },
		messaging: { async sendCmdAwait() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision: 1, profileState: { vertical: null, cant: null, chainageMappings: [] } } } }] }; } },
		projectionController: { async projectAt() { return projection(); } }, documentRef,
		cantAuthoringController: { async submit() { throw Object.assign(new Error("startS must be finite"), { code: "INVALID_CANT_STATE" }); } }, View,
	});
	assert.equal(await wiring.submitBasicCant({ cantStateId: "", elementId: "", startS: "", endS: "", startCrossLevel: "" }), null);
	assert.equal(wiring.getRegion().querySelector("[data-profile-sync-status]").textContent, "error");
	wiring.stop();
});
