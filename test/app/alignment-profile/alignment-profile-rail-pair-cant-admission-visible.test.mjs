import assert from "node:assert/strict";
import test from "node:test";
import { AlignmentProfileSynchronizedView } from "../../../app/view/alignment-profile/AlignmentProfileSynchronizedView.js";
import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

class Element {
	constructor(document) { this.ownerDocument = document; this.children = []; this.dataset = {}; this.textContent = ""; this.value = ""; this.checked = false; this.disabled = false; }
	append(...values) { for (const value of values) if (typeof value === "object") value.parentElement = this; this.children.push(...values); }
	prepend(...values) { for (const value of values) if (typeof value === "object") value.parentElement = this; this.children.unshift(...values); }
	replaceChildren(...values) { this.children = []; this.append(...values); }
	setAttribute() {}
	querySelector(selector) { const key = selector.match(/data-([a-z-]+)/)?.[1]?.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); return key ? this.find((node) => Object.hasOwn(node.dataset, key)) : null; }
	find(predicate) { for (const child of this.children) { if (typeof child !== "object") continue; if (predicate(child)) return child; const nested = child.find?.(predicate); if (nested) return nested; } return null; }
}
class Document { constructor() { this.panel = new Element(this); } createElement() { return new Element(this); } getElementById(id) { return id === "cockpitPanel" ? this.panel : null; } }

const projection = (overrides = {}) => ({ alignmentId: "A1", revision: 1, cursor: { parameterKind: "intrinsic-s", s: 40 }, profileStatePresence: "present", vertical: { status: "absent" }, chainage: { status: "absent" }, cant: { status: "absent" }, canCreateRailPairCant: true, railPairCantState: null, ...overrides });

test("visible admission control exposes no domain defaults and acknowledges explicit submission", () => {
	const document = new Document(), host = new Element(document), view = new AlignmentProfileSynchronizedView({ host });
	let submitted;
	view.setRailPairCantAdmissionHandler((request) => { submitted = request; return new Promise(() => {}); });
	view.render(projection());
	const form = host.find((node) => Object.hasOwn(node.dataset, "railPairCantAdmission"));
	assert.ok(form);
	for (const name of ["leftRailId", "rightRailId", "separationKind", "separationUnit", "separationValue", "anchorKind", "coverageStartS", "coverageEndS", "railSide", "lawType"]) {
		assert.equal(form.find((node) => node.name === name).value, "", `${name} must not have a default`);
	}
	form.find((node) => node.name === "leftRailId").value = "rail-L";
	form.find((node) => node.name === "admitCompleteConstruction").checked = true;
	form.find((node) => Object.hasOwn(node.dataset, "railPairCantAdmitSubmit")).onclick();
	assert.equal(submitted.leftRailId, "rail-L");
	assert.equal(submitted.admitCompleteConstruction, true);
	assert.equal(form.find((node) => Object.hasOwn(node.dataset, "railPairCantAdmissionStatus")).textContent, "acknowledged");
	assert.equal(form.find((node) => Object.hasOwn(node.dataset, "railPairCantAdmitSubmit")).disabled, true);
});

test("admission control remains absent for legacy or existing Rail-Pair Cant state", () => {
	for (const overrides of [{ canCreateRailPairCant: false }, { canCreateRailPairCant: undefined }]) {
		const document = new Document(), host = new Element(document), view = new AlignmentProfileSynchronizedView({ host });
		view.setRailPairCantAdmissionHandler(() => {}); view.render(projection(overrides));
		assert.equal(host.find((node) => Object.hasOwn(node.dataset, "railPairCantAdmission")), null);
	}
});

test("wiring confirms admission only after canonical same-cursor readback", async () => {
	const documentRef = new Document(); let revision = 1;
	let profileState = { vertical: null, cant: null, chainageMappings: [] }; const statuses = [];
	const projected = () => ({ status: "projected", alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s: 40 }, profileStatePresence: "present", vertical: { status: "absent" }, chainage: { status: "absent" }, cant: profileState.cant ? { status: "evaluated", representation: "rail-pair" } : { status: "absent" }, state: profileState });
	const spot = () => ({ objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision, profileState } } }] });
	class View { setRailPairCantAdmissionHandler(handler) { this.handler = handler; } renderRailPairCantAdmissionStatus(value) { statuses.push(value); } render() {} }
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 40 } }), subscribe: () => () => {} },
		messaging: { async sendCmdAwait() { return spot(); } }, projectionController: { async projectAt() { return projected(); } },
		railPairCantAdmissionController: { async admit(input) { assert.equal(input.s, 40); revision = 2; profileState = { ...profileState, cant: { type: "RailPairCantConstructiveState", admitted: true } }; return { status: "saved", snapshot: { revision }, profileState, projection: projected(), elementId: "E1" }; } },
		View, documentRef,
	});
	const result = await wiring.admitRailPairCant({ leftRailId: "L" });
	assert.equal(result.status, "saved");
	assert.deepEqual(statuses.slice(-2), ["saving", "saved"]);
	assert.equal(result.projection.cursor.s, 40);
	wiring.stop();
});
