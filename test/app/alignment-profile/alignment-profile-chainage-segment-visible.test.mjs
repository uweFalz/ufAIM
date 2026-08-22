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
class Document { constructor() { this.panel = new Element(this); } createElement(tag) { return new Element(this, tag); } getElementById(id) { return id === "cockpitPanel" ? this.panel : null; } }
const projection = (revision = 1) => ({ status: "projected", alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s: 75 }, profileStatePresence: "present", vertical: { status: "not-covered" }, chainage: { status: "unique", candidates: [{ segmentId: "CHS2", address: 1975 }] }, cant: { status: "evaluated" } });

test("view exposes six explicit values with no defaults and submits them verbatim", () => {
	const documentRef = new Document();
	const host = new Element(documentRef);
	const view = new AlignmentProfileSynchronizedView({ host });
	let submitted;
	view.setChainageSegmentAppendHandler((value) => { submitted = value; });
	view.render(projection());
	const details = host.find((node) => Object.hasOwn(node.dataset, "chainageSegmentAppend"));
	assert.ok(details);
	const explicit = { appendMappingId: "CH1", appendSegmentId: "CHS2", appendStartS: "50", appendEndS: "100", appendStartAddress: "2000" };
	for (const [name, value] of Object.entries(explicit)) {
		const input = details.find((node) => node.name === name);
		assert.equal(input.value, "");
		input.value = value;
	}
	const direction = details.find((node) => node.name === "appendDirection");
	assert.equal(direction.value, "");
	direction.value = "-1";
	details.find((node) => node.tag === "button" && node.textContent === "Append chainage segment").onclick();
	assert.deepEqual(submitted, { mappingId: "CH1", segmentId: "CHS2", startS: "50", endS: "100", startAddress: "2000", direction: "-1" });
});

test("append form is unavailable for absent canonical chainage evidence", () => {
	const documentRef = new Document();
	const host = new Element(documentRef);
	const view = new AlignmentProfileSynchronizedView({ host });
	view.setChainageSegmentAppendHandler(() => {});
	view.render({ ...projection(), chainage: { status: "absent", mappings: [] } });
	assert.equal(host.find((node) => Object.hasOwn(node.dataset, "chainageSegmentAppend")), null);
});

test("wiring appends from canonical state and renders only matching SPOT readback", async () => {
	const documentRef = new Document();
	let revision = 1;
	let profileState = { vertical: { alignmentId: "A1" }, cant: { alignmentId: "A1" }, chainageMappings: [{ id: "CH1", alignmentId: "A1", segments: [{ id: "CHS1" }] }] };
	let received;
	class View { setChainageSegmentAppendHandler(handler) { this.handler = handler; } renderChainageSegmentAppendStatus(value) { this.status = value; } render(value) { this.value = value; } }
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 75 } }), subscribe: () => () => {} },
		documentRef,
		messaging: { async sendCmdAwait() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision, profileState } } }] }; } },
		projectionController: { async projectAt() { return projection(revision); } },
		chainageSegmentAppendController: { async append(value) { received = value; revision = 2; profileState = { ...value.profileState, chainageMappings: [{ ...value.profileState.chainageMappings[0], segments: [{ id: "CHS1" }, { id: "CHS2" }] }] }; return { snapshot: { revision }, profileState, projection: projection(revision) }; } },
		View,
	});
	const result = await wiring.appendChainageSegment({ mappingId: "CH1", segmentId: "CHS2", startS: "50", endS: "100", startAddress: "2000", direction: "-1" });
	assert.equal(received.alignmentId, "A1");
	assert.equal(received.revision, 1);
	assert.equal(received.s, 75);
	assert.equal(result.revision, 2);
	wiring.stop();
});
