import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentProfileSynchronizedView } from "../../../app/view/alignment-profile/AlignmentProfileSynchronizedView.js";
import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

class Element {
	constructor(ownerDocument, tag = "div") { this.ownerDocument = ownerDocument; this.tag = tag; this.children = []; this.dataset = {}; this.attributes = new Map(); this.textContent = ""; this.value = ""; }
	append(...children) { this.children.push(...children); }
	replaceChildren(...children) { this.children = [...children]; }
	setAttribute(name, value) { this.attributes.set(name, String(value)); }
	find(predicate) { for (const child of this.children) { if (predicate(child)) return child; const nested = child.find?.(predicate); if (nested) return nested; } return null; }
	querySelector(selector) { const key = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); return key ? this.find((entry) => Object.hasOwn(entry.dataset, key)) : null; }
}
class Document {
	constructor() { this.panel = new Element(this); }
	createElement(tag) { return new Element(this, tag); }
	getElementById(id) { return id === "cockpitPanel" ? this.panel : null; }
}

const projection = (revision = 1) => ({
	status: "projected",
	alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s: 25 },
	profileStatePresence: "present", vertical: { status: "evaluated", value: { elevation: 10.25, gradient: 0.01 } },
	chainage: revision === 1 ? { status: "absent", mappings: [] } : { status: "unique", candidates: [{ address: 1025 }] },
	cant: { status: "absent", reference: { status: "absent" } },
});

test("visible form has eight explicit blank fields and emits only their values", async () => {
	const documentRef = new Document();
	const host = new Element(documentRef);
	const view = new AlignmentProfileSynchronizedView({ host });
	let submitted;
	view.setBasicChainageHandler((value) => { submitted = value; });
	view.render(projection());
	const details = host.find((node) => Object.hasOwn(node.dataset, "basicChainageMapping"));
	assert.equal(details.children[0].textContent, "Basic chainage mapping");
	const expected = ["mappingId", "schemeId", "schemeVersion", "segmentId", "startS", "endS", "startAddress"];
	for (const name of expected) {
		const input = details.find((node) => node.name === name);
		assert.ok(input);
		assert.equal(input.value, "");
		input.value = ({ mappingId: "CH1", schemeId: "scheme-demo", schemeVersion: "v1", segmentId: "CHS1", startS: "0", endS: "50", startAddress: "1000" })[name];
	}
	const direction = details.find((node) => node.name === "direction");
	assert.equal(direction.value, "");
	assert.deepEqual(direction.children.map((entry) => entry.value), ["", "1", "-1"]);
	direction.value = "1";
	details.find((node) => node.textContent === "Save chainage mapping").onclick();
	assert.deepEqual(submitted, {
		mappingId: "CH1", schemeId: "scheme-demo", schemeVersion: "v1", segmentId: "CHS1",
		startS: "0", endS: "50", startAddress: "1000", direction: "1",
	});
});

test("wiring submits canonical context and renders only matching SPOT readback", async () => {
	const documentRef = new Document();
	let profileState = { vertical: { alignmentId: "A1", elements: [{ id: "V1" }] }, cant: null, chainageMappings: [] };
	let revision = 1;
	const states = () => ({ objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision, profileState } } }] });
	class View {
		setBasicChainageHandler(handler) { this.handler = handler; }
		renderBasicChainageStatus(value) { this.status = value; }
		render(value) { this.value = value; }
	}
	const store = { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 25 } }), subscribe: () => () => {} };
	let received;
	const wiring = wireAlignmentProfileSynchronizedView({
		store, documentRef,
		messaging: { async sendCmdAwait() { return states(); } },
		projectionController: { async projectAt() { return projection(revision); } },
		chainageAuthoringController: { async submit(value) {
			received = value;
			profileState = { vertical: value.profileState.vertical, cant: value.profileState.cant, chainageMappings: [{ id: "CH1" }] };
			revision = 2;
			return { snapshot: { revision: 2 }, profileState, projection: projection(2) };
		} }, View,
	});
	const result = await wiring.submitBasicChainage({ mappingId: "CH1" });
	assert.equal(received.alignmentId, "A1");
	assert.equal(received.revision, 1);
	assert.equal(received.s, 25);
	assert.equal(received.profileState.chainageMappings.length, 0);
	assert.equal(result.chainage.candidates[0].address, 1025);
	wiring.stop();
});

test("an empty visible submit reports the controller error and never writes", async () => {
	const documentRef = new Document();
	let writes = 0;
	class View {
		setBasicChainageHandler(handler) { this.handler = handler; }
		renderBasicChainageStatus(value) { this.status = value; }
		render() {}
	}
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 25 } }), subscribe: () => () => {} },
		documentRef,
		messaging: { async sendCmdAwait() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision: 1, profileState: { vertical: null, cant: null, chainageMappings: [] } } } }] }; } },
		projectionController: { async projectAt() { return projection(); } },
		chainageAuthoringController: { async submit() {
			throw Object.assign(new Error("startS must be finite"), { code: "INVALID_CHAINAGE_MAPPING" });
		} },
		View,
	});
	const result = await wiring.submitBasicChainage({
		mappingId: "", schemeId: "", schemeVersion: "", segmentId: "",
		startS: "", endS: "", startAddress: "", direction: "",
	});
	assert.equal(result, null);
	assert.equal(writes, 0);
	assert.equal(wiring.getRegion().querySelector("[data-profile-sync-status]").textContent, "error");
	wiring.stop();
});
