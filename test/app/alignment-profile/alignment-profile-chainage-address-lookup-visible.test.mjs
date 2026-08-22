import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentProfileSynchronizedView } from "../../../app/view/alignment-profile/AlignmentProfileSynchronizedView.js";
import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

class Element {
	constructor(ownerDocument, tag = "div") { this.ownerDocument = ownerDocument; this.tag = tag; this.children = []; this.dataset = {}; this.textContent = ""; this.value = ""; this.disabled = false; }
	append(...children) { this.children.push(...children); }
	replaceChildren(...children) { this.children = [...children]; }
	setAttribute() {}
	find(predicate) { for (const child of this.children) { if (predicate(child)) return child; const nested = child.find?.(predicate); if (nested) return nested; } return null; }
	querySelector(selector) { const key = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); return key ? this.find((entry) => Object.hasOwn(entry.dataset, key)) : null; }
}
class Document {
	constructor() { this.panel = new Element(this); }
	createElement(tag) { return new Element(this, tag); }
	getElementById(id) { return id === "cockpitPanel" ? this.panel : null; }
}
const profileState = { vertical: { alignmentId: "A1" }, cant: null, chainageMappings: [{ id: "CH1", alignmentId: "A1" }] };
const projection = { alignmentId: "A1", revision: 4, cursor: { parameterKind: "intrinsic-s", s: 0 }, profileStatePresence: "present", vertical: { status: "evaluated" }, chainage: { status: "evaluated" }, cant: { status: "absent" } };

test("visible lookup is transient and Use candidate alone moves the shared cursor", async () => {
	const documentRef = new Document();
	const cursorValues = [];
	let lookupInput;
	class View extends AlignmentProfileSynchronizedView {}
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 0 } }), subscribe: () => () => {}, actions: { setCursorS(value) { cursorValues.push(value); } } },
		messaging: { async sendCmdAwait() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision: 4, profileState } } }] }; } },
		projectionController: { async projectAt() { return projection; } },
		chainageLookupController: { async lookup(value) { lookupInput = value; return { status: "unique", mappingId: "CH1", address: 1025, candidates: [{ segmentId: "CHS1", s: 25, address: 1025, schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit" }] }; } },
		View, documentRef,
	});
	const result = await wiring.lookupChainageAddress({ mappingId: "CH1", address: "1025" });
	assert.equal(lookupInput.revision, 4);
	assert.strictEqual(lookupInput.profileState, profileState);
	assert.deepEqual(cursorValues, []);
	assert.equal(result.status, "unique");
	assert.equal(wiring.useChainageCandidate().s, 25);
	assert.deepEqual(cursorValues, [25]);
	wiring.stop();
});

test("view exposes blank explicit inputs and no candidate action for unavailable evidence", () => {
	const documentRef = new Document();
	const host = new Element(documentRef);
	const view = new AlignmentProfileSynchronizedView({ host });
	let submitted;
	view.setChainageAddressLookupHandlers({ onLookup(value) { submitted = value; }, onUseCandidate() {} });
	view.render(projection);
	const details = host.find((node) => Object.hasOwn(node.dataset, "chainageAddressLookup"));
	const mappingId = details.find((node) => node.name === "lookupMappingId");
	const address = details.find((node) => node.name === "lookupAddress");
	assert.equal(mappingId.value, "");
	assert.equal(address.value, "");
	details.find((node) => node.textContent === "Lookup address").onclick();
	assert.deepEqual(submitted, { mappingId: "", address: "" });
	view.renderChainageAddressLookup({ status: "not-covered", candidates: [] });
	assert.equal(details.find((node) => Object.hasOwn(node.dataset, "chainageUseCandidate")).disabled, true);
});
