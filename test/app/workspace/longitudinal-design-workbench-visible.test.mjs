import assert from "node:assert/strict";
import test from "node:test";
import { AlignmentProfileSynchronizedView } from "../../../app/view/alignment-profile/AlignmentProfileSynchronizedView.js";

class Element {
	constructor(documentRef, tag = "div") { this.ownerDocument = documentRef; this.tag = tag; this.dataset = {}; this.children = []; this.textContent = ""; }
	append(...children) { for (const child of children) { if (child?.parentElement) child.parentElement.children = child.parentElement.children.filter((entry) => entry !== child); child.parentElement = this; this.children.push(child); } }
	replaceChildren(...children) { this.children = []; this.append(...children); }
	setAttribute() {}
	matches(selector) { const match = /^\[data-([a-z0-9-]+)(?:="([^"]+)")?\]$/.exec(selector); if (!match) return false; const key = match[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase()); return Object.hasOwn(this.dataset, key) && (match[2] === undefined || this.dataset[key] === match[2]); }
	querySelector(selector) { if (this.matches(selector)) return this; for (const child of this.children) { const found = child.querySelector?.(selector); if (found) return found; } return null; }
	querySelectorAll(selector) { return [this.matches(selector) ? this : null, ...this.children.flatMap((child) => child.querySelectorAll?.(selector) ?? [])].filter(Boolean); }
	scrollIntoView(options) { this.scrolled = options; }
	focus(options) { this.focused = options; }
}
class Document { createElement(tag) { return new Element(this, tag); } }

test("L workbench visibly assembles exact synchronized lanes and focuses one lane", () => {
	const documentRef = new Document(); const host = new Element(documentRef); const view = new AlignmentProfileSynchronizedView({ host });
	view.render({ alignmentId: "A", profileStatePresence: "present", cursor: { s: 25 }, vertical: { status: "evaluated", value: { elevation: 10.5, gradient: 0.01 } }, chainage: { status: "evaluated", value: { candidates: [{ address: 1025 }] } }, cant: { status: "not-covered" }, laneCoverage: { vertical: { status: "evaluated", elementCount: 2, domain: { startS: 0, endS: 100 }, value: { elevation: 10.5, gradient: 0.01 }, provenancePresent: true }, chainage: { status: "evaluated", elementCount: 1, mappingCount: 1, domain: { startS: 0, endS: 100 }, value: { address: 1025 }, provenancePresent: true }, cant: { status: "not-covered", elementCount: 0, domain: null, value: null, provenancePresent: false } } });
	const workbench = host.querySelector("[data-longitudinal-design-surface]"); assert.ok(workbench); assert.equal(workbench.dataset.alignmentId, "A"); assert.equal(workbench.dataset.cursorS, "25");
	const lanes = host.querySelectorAll("[data-longitudinal-design-lane]"); assert.deepEqual(lanes.map((lane) => lane.dataset.longitudinalDesignLane), ["vertical", "chainage", "cant"]);
	assert.match(lanes[0].querySelector("[data-longitudinal-lane-summary]").textContent, /2 Elemente · s 0…100 · Provenienz vorhanden/);
	assert.equal(view.focusLane("cant"), true); assert.equal(lanes[2].dataset.laneFocused, "true"); assert.ok(lanes[2].scrolled); assert.ok(lanes[2].focused);
});
