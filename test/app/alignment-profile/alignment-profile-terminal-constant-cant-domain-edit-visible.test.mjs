import assert from "node:assert/strict";
import test from "node:test";
import { AlignmentProfileSynchronizedView } from "../../../app/view/alignment-profile/AlignmentProfileSynchronizedView.js";
import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";
class E { constructor(d, tag = "div") { this.ownerDocument = d; this.tag = tag; this.children = []; this.dataset = {}; this.textContent = ""; this.value = ""; } append(...children) { this.children.push(...children); } replaceChildren(...children) { this.children = [...children]; } setAttribute() {} find(predicate) { for (const child of this.children) { if (predicate(child)) return child; const found = child.find?.(predicate); if (found) return found; } return null; } querySelector(selector) { const key = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, character) => character.toUpperCase()); return key ? this.find((element) => Object.hasOwn(element.dataset, key)) : null; } }
class D { constructor() { this.panel = new E(this); } createElement(tag) { return new E(this, tag); } getElementById(id) { return id === "cockpitPanel" ? this.panel : null; } }
const c1 = { id: "C1", type: "constant-cross-level", startS: 0, endS: 50, startCrossLevel: 0.04 };
const projection = (revision = 1) => ({ status: "projected", alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s: 25 }, profileStatePresence: "present", vertical: { status: "evaluated" }, chainage: { status: "evaluated" }, cant: { status: "evaluated", value: { elementId: "C1", crossLevel: 0.04, twist: 0 } } });

test("view displays exact C1 domain and submits only identity plus explicit endS", () => {
	const d = new D(), host = new E(d), view = new AlignmentProfileSynchronizedView({ host }); let sent; view.setTerminalConstantCantDomainHandler((value) => { sent = value; }); view.render({ ...projection(), terminalCantElement: c1 });
	const details = host.find((node) => Object.hasOwn(node.dataset, "terminalConstantCantDomainEdit")); assert.ok(details); assert.deepEqual(JSON.parse(details.find((node) => Object.hasOwn(node.dataset, "terminalConstantCantDomainIdentity")).textContent), { elementId: "C1", type: "constant-cross-level", startS: 0, endS: 50, crossLevel: 0.04 });
	const input = details.find((node) => node.name === "terminalConstantCantEndS"); assert.equal(input.value, "50"); input.value = "75"; details.find((node) => node.tag === "button" && node.textContent === "Apply constant Cant end s").onclick(); assert.deepEqual(sent, { elementId: "C1", endS: "75" });
	view.render({ ...projection(), terminalCantElement: { ...c1, type: "linear-cross-level", crossLevelRate: 0.002 } }); assert.equal(host.find((node) => Object.hasOwn(node.dataset, "terminalConstantCantDomainEdit")), null);
});

test("wiring uses canonical context and matching SPOT readback", async () => {
	const d = new D(); let revision = 1, received; let profileState = { vertical: { alignmentId: "A1" }, cant: { id: "CANT1", alignmentId: "A1", elements: [c1] }, chainageMappings: [{ id: "CH1" }] };
	class View { setTerminalConstantCantDomainHandler(handler) { this.handler = handler; } renderTerminalConstantCantDomainStatus(value) { this.status = value; } render(value) { this.value = value; } }
	const wiring = wireAlignmentProfileSynchronizedView({ store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 25 } }), subscribe: () => () => {} }, documentRef: d, messaging: { async sendCmdAwait() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision, profileState } } }] }; } }, projectionController: { async projectAt() { return projection(revision); } }, terminalConstantCantDomainEditController: { async update(value) { received = value; revision = 2; profileState = { ...value.profileState, cant: { ...value.profileState.cant, elements: [{ ...c1, endS: 75 }] } }; return { snapshot: { revision }, profileState, projection: projection(revision) }; } }, View });
	const result = await wiring.updateTerminalConstantCantDomain({ elementId: "C1", endS: "75" }); assert.equal(received.alignmentId, "A1"); assert.equal(received.s, 25); assert.equal(result.snapshot.revision, 2); wiring.stop();
});
