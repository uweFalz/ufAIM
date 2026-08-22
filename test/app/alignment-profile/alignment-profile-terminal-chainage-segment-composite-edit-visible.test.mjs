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
const projection = (revision = 1) => ({ status: "projected", alignmentId: "A1", revision,
	cursor: { parameterKind: "intrinsic-s", s: 75 }, profileStatePresence: "present",
	vertical: { status: "not-covered" }, chainage: { status: "evaluated", candidates: [{ segmentId: "CHS2", address: 3975 }] }, cant: { status: "evaluated" } });

test("view submits exactly the explicit composite fields", () => {
	const documentRef = new Document(), host = new Element(documentRef), view = new AlignmentProfileSynchronizedView({ host });
	let submitted;
	view.setTerminalChainageCompositeEditHandler((value) => { submitted = value; });
	view.render(projection());
	const details = host.find((node) => Object.hasOwn(node.dataset, "terminalChainageCompositeEdit"));
	assert.ok(details);
	for (const [name, value] of [["compositeEditMappingId", "CH1"], ["compositeEditSegmentId", "CHS2"], ["compositeEditStartAddress", "4000"], ["compositeEditEndS", "150"], ["compositeEditDirection", "-1"]]) {
		const input = details.find((node) => node.name === name); assert.equal(input.value, ""); input.value = value;
	}
	details.find((node) => node.tag === "button" && node.textContent === "Apply terminal segment fields").onclick();
	assert.deepEqual(submitted, { mappingId: "CH1", segmentId: "CHS2", startAddress: "4000", direction: "-1", endS: "150" });
});

test("composite form remains absent without chainage evidence", () => {
	const documentRef = new Document(), host = new Element(documentRef), view = new AlignmentProfileSynchronizedView({ host });
	view.setTerminalChainageCompositeEditHandler(() => {});
	view.render({ ...projection(), chainage: { status: "absent", mappings: [] } });
	assert.equal(host.find((node) => Object.hasOwn(node.dataset, "terminalChainageCompositeEdit")), null);
});

test("wiring supplies canonical context and accepts only matching SPOT readback", async () => {
	const documentRef = new Document(); let revision = 1;
	let profileState = { vertical: { alignmentId: "A1" }, cant: { alignmentId: "A1" }, chainageMappings: [{ id: "CH1", alignmentId: "A1", segments: [{ id: "CHS1" }, { id: "CHS2" }] }] };
	let received;
	class View { setTerminalChainageCompositeEditHandler(handler) { this.handler = handler; } renderTerminalChainageCompositeEditStatus(value) { this.status = value; } render(value) { this.value = value; } }
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 75 } }), subscribe: () => () => {} }, documentRef,
		messaging: { async sendCmdAwait() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision, profileState } } }] }; } },
		projectionController: { async projectAt() { return projection(revision); } },
		terminalChainageSegmentCompositeEditController: { async update(value) { received = value; revision = 2; profileState = { ...value.profileState, chainageMappings: [{ ...value.profileState.chainageMappings[0], edited: true }] }; return { snapshot: { revision }, profileState, projection: projection(revision) }; } },
		View,
	});
	const result = await wiring.updateTerminalChainageSegmentComposite({ mappingId: "CH1", segmentId: "CHS2", startAddress: "4000", direction: "-1", endS: "150" });
	assert.equal(received.alignmentId, "A1"); assert.equal(received.revision, 1); assert.equal(received.s, 75); assert.equal(result.revision, 2);
	wiring.stop();
});
