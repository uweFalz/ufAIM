import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentProfileSynchronizedView } from "../../../app/view/alignment-profile/AlignmentProfileSynchronizedView.js";
import { AlignmentCantCrossLevelView } from "../../../app/view/alignment-profile/AlignmentCantCrossLevelView.js";
import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

class Element {
	constructor(ownerDocument, tag = "div") { this.ownerDocument = ownerDocument; this.tag = tag; this.children = []; this.dataset = {}; this.attributes = new Map(); this.textContent = ""; this.value = ""; this.disabled = false; }
	append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
	replaceChildren(...children) { this.children = []; this.append(...children); }
	setAttribute(name, value) { this.attributes.set(name, String(value)); }
	find(predicate) { for (const child of this.children) { if (predicate(child)) return child; const nested = child.find?.(predicate); if (nested) return nested; } return null; }
	querySelector(selector) { const key = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); return key ? this.find((entry) => Object.hasOwn(entry.dataset, key)) : null; }
}
class Document { constructor() { this.panel = new Element(this); } createElement(tag) { return new Element(this, tag); } createElementNS(_ns, tag) { return new Element(this, tag); } getElementById(id) { return id === "cockpitPanel" ? this.panel : null; } }

const railPairState = {
	type: "RailPairCantConstructiveState", coverage: { status: "complete", authority: "admitted-construction" },
	railPair: { leftRailId: "L", rightRailId: "R" },
	elements: [
		{ id: "L1", railId: "L", type: "linear-rail-offset", startS: 0, endS: 100, startOffset: 0.02, offsetRate: 0.001 },
		{ id: "R1", railId: "R", type: "constant-rail-offset", startS: 0, endS: 100, startOffset: -0.01 },
	],
};

const projection = (revision = 1) => ({
	status: "projected", alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s: 40 }, profileStatePresence: "present",
	vertical: { status: "absent" }, chainage: { status: "absent" },
	cant: { status: "evaluated", representation: "rail-pair", left: { railId: "L", offset: 0.06 }, right: { railId: "R", offset: -0.01 }, crossLevel: -0.07, commonOffset: 0.025 },
	state: { cant: railPairState }, railPairCantState: railPairState,
});

test("visible control exposes exact persisted identities and acknowledges one permitted edit immediately", () => {
	const documentRef = new Document(), host = new Element(documentRef);
	const view = new AlignmentProfileSynchronizedView({ host });
	let submitted;
	view.setRailPairCantRailLawHandler((value) => { submitted = value; return new Promise(() => {}); });
	view.render(projection());
	const form = host.find((node) => Object.hasOwn(node.dataset, "railPairCantRailLawEdit"));
	assert.ok(form);
	assert.match(form.find((node) => Object.hasOwn(node.dataset, "railPairCantIdentity")).textContent, /"railId": "L"[\s\S]*"elementId": "L1"/);
	const offset = form.find((node) => node.name === "railPairCantStartOffset");
	offset.value = "0.03";
	const submit = form.find((node) => Object.hasOwn(node.dataset, "railPairCantSubmit"));
	submit.onclick();
	assert.equal(form.find((node) => Object.hasOwn(node.dataset, "railPairCantStatus")).textContent, "acknowledged");
	assert.equal(submit.disabled, true);
	assert.deepEqual(submitted, { railSide: "left", railId: "L", elementId: "L1", startOffset: "0.03", offsetRate: 0.001 });
});

test("legacy and unadmitted Cant expose no rail-law authoring control", () => {
	for (const railPairCantState of [null, { ...railPairState, coverage: { status: "incomplete" } }]) {
		const documentRef = new Document(), host = new Element(documentRef), view = new AlignmentProfileSynchronizedView({ host });
		view.setRailPairCantRailLawHandler(() => {});
		view.render({ ...projection(), railPairCantState });
		assert.equal(host.find((node) => Object.hasOwn(node.dataset, "railPairCantRailLawEdit")), null);
	}
});

test("rail-pair Cant view shows both rail laws and derived same-cursor cross-section", () => {
	const documentRef = new Document(), host = new Element(documentRef);
	new AlignmentCantCrossLevelView({ host }).render({
		status: "projected", representation: "rail-pair", domain: { parameterKind: "intrinsic-s", startS: 0, endS: 100 }, boundaries: [0, 100], elements: railPairState.elements,
		samples: [{ s: 0, crossLevel: -0.03, left: { railId: "L", offset: 0.02 }, right: { railId: "R", offset: -0.01 } }, { s: 40, crossLevel: -0.07, left: { railId: "L", offset: 0.06 }, right: { railId: "R", offset: -0.01 } }, { s: 100, crossLevel: -0.13, left: { railId: "L", offset: 0.12 }, right: { railId: "R", offset: -0.01 } }],
		cursor: { status: "evaluated", s: 40, crossLevel: -0.07, commonOffset: 0.025, left: { railId: "L", offset: 0.06 }, right: { railId: "R", offset: -0.01 } },
		crossSection: { status: "evaluated", s: 40, left: { railId: "L", offset: 0.06 }, right: { railId: "R", offset: -0.01 }, crossLevel: -0.07, commonOffset: 0.025, midpointStatus: "derived" }, reference: { scalarCrossLevelStatus: "derived" },
	});
	assert.ok(host.find((node) => node.dataset.cantRailOffsetPath === "left"));
	assert.ok(host.find((node) => node.dataset.cantRailOffsetPath === "right"));
	assert.match(host.find((node) => Object.hasOwn(node.dataset, "cantCursorEvidence")).textContent, /left=L:0\.06.*right=R:-0\.01.*derived/);
	assert.equal(JSON.parse(host.find((node) => Object.hasOwn(node.dataset, "railPairCrossSection")).textContent).midpointStatus, "derived");
});

test("wiring reports saving and saved only after matching canonical readback at unchanged cursor", async () => {
	const documentRef = new Document(); let revision = 1, profileState = { vertical: null, cant: railPairState, chainageMappings: [] }; const statuses = [];
	const spot = () => ({ objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision, profileState } } }] });
	class View { setRailPairCantRailLawHandler(handler) { this.handler = handler; } renderRailPairCantRailLawStatus(value) { statuses.push(value); } render() {} }
	const wiring = wireAlignmentProfileSynchronizedView({ store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 40 } }), subscribe: () => () => {} }, messaging: { async sendCmdAwait() { return spot(); } }, projectionController: { async projectAt() { return projection(revision); } }, railPairCantRailLawEditController: { async update(input) { assert.equal(input.s, 40); revision = 2; profileState = { ...profileState, cant: { ...railPairState, elements: [{ ...railPairState.elements[0], startOffset: 0.03 }, railPairState.elements[1]] } }; return { status: "saved", snapshot: { revision }, profileState, projection: projection(revision), elementId: "L1" }; } }, View, documentRef });
	const result = await wiring.updateRailPairCantRailLaw({ railSide: "left", elementId: "L1", startOffset: 0.03, offsetRate: 0.001 });
	assert.equal(result.status, "saved");
	assert.deepEqual(statuses.slice(-2), ["saving", "saved"]);
	assert.equal(result.projection.cursor.s, 40);
	wiring.stop();
});
