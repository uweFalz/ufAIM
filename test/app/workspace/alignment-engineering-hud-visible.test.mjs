import assert from "node:assert/strict";
import test from "node:test";
import { ExistingAlignmentIntelligenceView } from "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js";

function node() { return { dataset: {}, children: [], textContent: "", append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; }, addEventListener(type, handler) { this.handler = handler; }, querySelector() { return null; } }; }

test("HUD visibly exposes identity route role values statuses provenance and existing actions", () => {
	const identity = node(), list = node(), hud = node(); let opened = [];
	const root = { dataset: {}, querySelector(selector) { if (selector.includes("engineering-hud")) return hud; if (selector.includes("identity")) return identity; if (selector.includes("capabilities")) return list; return null; }, append() {} };
	const documentRef = { getElementById: () => root, createElement: () => node() };
	const view = new ExistingAlignmentIntelligenceView({ documentRef, actions: { openObjects: () => opened.push("objects"), openImport: () => opened.push("import"), openReview: () => opened.push("review") } });
	view.render({ status: "active", mode: "q", context: { objectId: "A", route: "1720", sourceRole: "1", s: 25 }, capabilities: {}, hud: { mode: "q", context: { objectId: "A", route: "1720", sourceRole: "1", s: 25 }, fields: [{ id: "cant", label: "Überhöhung / Twist", status: "partial-evidence", value: { crossLevel: 0.04 }, provenancePresent: true }], actions: { openObjects: true, openImport: true, openReview: true } } });
	assert.match(hud.children[0].textContent, /A · Strecke 1720 · Quellrolle 1 · s 25/);
	const card = hud.children[1].children[0]; assert.equal(card.dataset.hudStatus, "partial-evidence"); assert.match(card.children[1].textContent, /crossLevel 0.04/); assert.match(card.children[2].textContent, /provenance present/);
	for (const button of hud.children[2].children) button.handler(); assert.deepEqual(opened, ["objects", "import", "review"]);
});

test("local coordinate mode is the primary visible HUD value and diagnostics remain secondary", () => {
	const list = node(), hud = node();
	const root = { dataset: {}, querySelector(selector) { if (selector.includes("engineering-hud")) return hud; if (selector.includes("capabilities")) return list; return null; }, append() {} };
	const view = new ExistingAlignmentIntelligenceView({ documentRef: { getElementById: () => root, createElement: () => node() } });
	view.render({ status: "active", mode: "main", context: { objectId: "A", s: 0 }, capabilities: {}, hud: { mode: "main", context: { objectId: "A", s: 0 }, fields: [{ id: "spatial", label: "Raum / CRS", status: "not-covered", value: { mode: "local-cartesian", context: "local engineering" }, reason: "CRS evidence requires review", provenancePresent: true }], actions: {} } });
	const card = hud.children[1].children[0];
	assert.match(card.children[1].textContent, /^mode local-cartesian · context local engineering$/);
	assert.match(card.children[2].textContent, /not-covered.*CRS evidence requires review/);
});
