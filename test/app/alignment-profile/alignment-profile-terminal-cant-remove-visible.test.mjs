import assert from "node:assert/strict";
import test from "node:test";
import { AlignmentProfileSynchronizedView } from "../../../app/view/alignment-profile/AlignmentProfileSynchronizedView.js";
import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

class E { constructor(d, tag = "div") { this.ownerDocument = d; this.tag = tag; this.children = []; this.dataset = {}; this.textContent = ""; } append(...children) { this.children.push(...children); } replaceChildren(...children) { this.children = [...children]; } setAttribute() {} find(predicate) { for (const child of this.children) { if (predicate(child)) return child; const found = child.find?.(predicate); if (found) return found; } return null; } querySelector(selector) { const key = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, character) => character.toUpperCase()); return key ? this.find((element) => Object.hasOwn(element.dataset, key)) : null; } }
class D { constructor() { this.panel = new E(this); } createElement(tag) { return new E(this, tag); } getElementById(id) { return id === "cockpitPanel" ? this.panel : null; } }
const c2 = { id: "C2", type: "linear-cross-level", startS: 50, endS: 100, startCrossLevel: 0.05, crossLevelRate: 0.002 };
const projection = (revision = 1) => ({ status: "projected", alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s: 75 }, profileStatePresence: "present", vertical: { status: "not-covered" }, chainage: { status: "not-covered" }, cant: { status: "evaluated", value: { elementId: "C2" } } });

test("view submits only the exact persisted terminal Cant identity", () => {
	const d = new D(), host = new E(d), view = new AlignmentProfileSynchronizedView({ host }); let sent;
	view.setTerminalCantRemoveHandler((value) => { sent = value; });
	view.render({ ...projection(), terminalCantElement: c2 });
	const details = host.find((node) => Object.hasOwn(node.dataset, "terminalCantRemove"));
	assert.ok(details);
	assert.deepEqual(JSON.parse(details.find((node) => Object.hasOwn(node.dataset, "terminalCantRemoveIdentity")).textContent), { elementId: "C2", type: "linear-cross-level", startS: 50, endS: 100 });
	details.find((node) => node.tag === "button" && node.textContent === "Remove exact terminal Cant element").onclick();
	assert.deepEqual(sent, { elementId: "C2" });
	view.render({ ...projection(), terminalCantElement: null });
	assert.equal(host.find((node) => Object.hasOwn(node.dataset, "terminalCantRemove")), null);
});

test("wiring supplies canonical context and verifies matching SPOT readback", async () => {
	const d = new D(); let revision = 1, received;
	let profileState = { vertical: { alignmentId: "A1" }, cant: { id: "CANT1", alignmentId: "A1", elements: [{ id: "C1" }, c2] }, chainageMappings: [{ id: "CH1" }] };
	class View { setTerminalCantRemoveHandler(handler) { this.handler = handler; } renderTerminalCantRemoveStatus(value) { this.status = value; } render(value) { this.value = value; } }
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 75 } }), subscribe: () => () => {} }, documentRef: d,
		messaging: { async sendCmdAwait() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision, profileState } } }] }; } },
		projectionController: { async projectAt() { return projection(revision); } },
		terminalCantElementRemoveController: { async remove(value) { received = value; revision = 2; profileState = { ...value.profileState, cant: { ...value.profileState.cant, elements: [value.profileState.cant.elements[0]] } }; return { snapshot: { revision }, profileState, projection: projection(revision) }; } }, View,
	});
	const result = await wiring.removeTerminalCantElement({ elementId: "C2" });
	assert.equal(received.alignmentId, "A1"); assert.equal(received.s, 75); assert.equal(received.elementId, "C2"); assert.equal(result.snapshot.revision, 2);
	wiring.stop();
});
