import assert from "node:assert/strict";
import test from "node:test";
import { ExistingAlignmentIntelligenceView } from "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js";

function node(tag = "div") { return { tag, dataset: {}, children: [], disabled: false, append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; }, addEventListener(type, fn) { this.listener = fn; }, querySelector(selector) { if (selector === "[data-alignment-engineering-hud]" || selector === "[data-alignment-task-rail]" || selector === "[data-alignment-seven-line-bands]") return this.children.find((item) => selector.includes("task-rail") ? Object.hasOwn(item.dataset, "alignmentTaskRail") : false) ?? null; if (selector === "[data-alignment-intelligence-capabilities]") return this.capabilities ?? null; if (selector === "[data-alignment-intelligence-identity]") return this.identity ?? null; return null; } }; }

test("view renders six honest cards and delegates enabled actions once", () => {
	const root = node(); root.capabilities = node("ul"); root.identity = node(); const calls = [];
	const documentRef = { getElementById: () => root, createElement: node };
	const view = new ExistingAlignmentIntelligenceView({ documentRef, actions: { openHorizontal: () => calls.push("horizontal"), openBands: () => calls.push("bands"), openReview: () => calls.push("review"), openObjects: () => calls.push("objects") } });
	view.render({ status: "active", mode: "main", context: { objectId: "A", s: 25 }, capabilities: {}, hud: { mode: "main", context: {}, fields: [], actions: {} }, taskRail: { mode: "main", context: { objectId: "A", s: 25 }, tasks: [{ id: "horizontal", label: "Horizontal", status: "constructive", count: 2, enabled: true, action: "openHorizontal", actionLabel: "Element bearbeiten" }, { id: "vertical", label: "Vertical", status: "partial-evidence", enabled: true, action: "openBands", actionLabel: "In L öffnen" }, { id: "cant", label: "Cant", status: "missing", enabled: false, reason: "nicht verfügbar", action: "openBands", actionLabel: "In L öffnen" }, { id: "chainage", label: "Chainage", status: "not-covered", enabled: true, action: "openBands", actionLabel: "In L öffnen" }, { id: "source", label: "Quelle", status: "review-required", enabled: true, action: "openReview", actionLabel: "Review öffnen" }, { id: "objects", label: "Objekte", status: "constructive", enabled: true, action: "openObjects", actionLabel: "Objekte öffnen" }] } });
	const rail = root.children.find((item) => Object.hasOwn(item.dataset, "alignmentTaskRail")); const list = rail.children.at(-1); assert.equal(list.children.length, 6);
	const horizontalButton = list.children[0].children.at(-1); horizontalButton.listener(); assert.deepEqual(calls, ["horizontal"]);
	const cantButton = list.children[2].children.at(-1); assert.equal(cantButton.disabled, true); assert.equal(cantButton.title, "nicht verfügbar");
});
