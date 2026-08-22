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
	querySelector(selector) { const key = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, character) => character.toUpperCase()); return key ? this.find((element) => Object.hasOwn(element.dataset, key)) : null; }
}
class Document {
	constructor() { this.panel = new Element(this); }
	createElement(tag) { return new Element(this, tag); }
	getElementById(id) { return id === "cockpitPanel" ? this.panel : null; }
}
const projection = (revision = 1) => ({
	status: "projected", alignmentId: "A1", revision,
	cursor: { parameterKind: "intrinsic-s", s: 75 }, profileStatePresence: "present",
	vertical: { status: "not-covered" },
	chainage: { status: "evaluated", candidates: [{ segmentId: "CHS2", address: 3025 }] },
	cant: { status: "evaluated" },
});

test("view submits only explicit mapping segment and endS", () => {
	const documentRef = new Document(), host = new Element(documentRef), view = new AlignmentProfileSynchronizedView({ host });
	let submitted;
	view.setTerminalChainageDomainEditHandler((value) => { submitted = value; });
	view.render(projection());
	const details = host.find((node) => Object.hasOwn(node.dataset, "terminalChainageDomainEdit"));
	assert.ok(details);
	const mappingId = details.find((node) => node.name === "domainEditMappingId");
	const segmentId = details.find((node) => node.name === "domainEditSegmentId");
	const endS = details.find((node) => node.name === "domainEditEndS");
	assert.equal(mappingId.value, ""); assert.equal(segmentId.value, ""); assert.equal(endS.value, "");
	mappingId.value = "CH1"; segmentId.value = "CHS2"; endS.value = "125";
	details.find((node) => node.tag === "button" && node.textContent === "Apply terminal chainage end s").onclick();
	assert.deepEqual(submitted, { mappingId: "CH1", segmentId: "CHS2", endS: "125" });
});

test("form is absent for absent chainage", () => {
	const documentRef = new Document(), host = new Element(documentRef), view = new AlignmentProfileSynchronizedView({ host });
	view.setTerminalChainageDomainEditHandler(() => {});
	view.render({ ...projection(), chainage: { status: "absent", mappings: [] } });
	assert.equal(host.find((node) => Object.hasOwn(node.dataset, "terminalChainageDomainEdit")), null);
});

test("wiring uses canonical context and matching SPOT readback", async () => {
	const documentRef = new Document();
	let revision = 1;
	let profileState = { vertical: { alignmentId: "A1" }, cant: { alignmentId: "A1" }, chainageMappings: [{ id: "CH1", alignmentId: "A1", segments: [{ id: "CHS1" }, { id: "CHS2" }] }] };
	let received;
	class View {
		setTerminalChainageDomainEditHandler(handler) { this.handler = handler; }
		renderTerminalChainageDomainEditStatus(value) { this.status = value; }
		render(value) { this.value = value; }
	}
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 75 } }), subscribe: () => () => {} },
		documentRef,
		messaging: { async sendCmdAwait() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision, profileState } } }] }; } },
		projectionController: { async projectAt() { return projection(revision); } },
		terminalChainageSegmentDomainEditController: { async update(value) {
			received = value; revision = 2;
			profileState = { ...value.profileState, chainageMappings: [{ ...value.profileState.chainageMappings[0], edited: true }] };
			return { snapshot: { revision }, profileState, projection: projection(revision) };
		} },
		View,
	});
	const result = await wiring.updateTerminalChainageSegmentDomain({ mappingId: "CH1", segmentId: "CHS2", endS: "125" });
	assert.equal(received.alignmentId, "A1"); assert.equal(received.revision, 1); assert.equal(received.s, 75);
	assert.equal(result.revision, 2);
	wiring.stop();
});
