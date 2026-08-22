import assert from "node:assert/strict";
import test from "node:test";
import { ExistingAlignmentIntelligenceView } from "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js";

function element() { return { dataset: {}, children: [], textContent: "", disabled: false, append(...values) { this.children.push(...values); }, replaceChildren(...values) { this.children = values; }, addEventListener(type, fn) { this.handler = fn; }, setAttribute(name, value) { this[name] = value; } }; }

test("visible bar exposes facts modes and only existing action delegates", () => {
	const bar = element(), calls = [];
	const view = new ExistingAlignmentIntelligenceView({ documentRef: { getElementById: (id) => id === "workspaceContextBar" ? bar : null, createElement: () => element() }, actions: { activateMode: (mode) => calls.push(mode), openReview: () => calls.push("review"), openObjects: () => calls.push("objects"), openTaskRail: () => calls.push("tasks") } });
	view.renderContextBar({ status: "active", mode: "q", context: { objectId: "A", route: "4711", sourceRole: "1", s: 25, coordinateMode: "LOCAL · engineering" }, actions: { modes: ["main", "q", "l"], openWorkbench: true, openObjects: true, openTaskRail: true } });
	assert.equal(bar.dataset.contextBarStatus, "active"); assert.match(bar.children[0].children.map((entry) => entry.textContent).join(" "), /A.*Strecke 4711.*Rolle 1.*s 25.*LOCAL/);
	assert.equal(bar.children[1].children[1]["aria-pressed"], "true"); bar.children[1].children[2].handler(); bar.children[2].children[0].handler(); bar.children[2].children[1].handler(); bar.children[2].children[2].handler(); assert.deepEqual(calls, ["l", "review", "objects", "tasks"]);
});

test("absent bar exposes no stale route role station or spatial fact", () => {
	const bar = element(); const view = new ExistingAlignmentIntelligenceView({ documentRef: { getElementById: (id) => id === "workspaceContextBar" ? bar : null, createElement: () => element() }, actions: {} });
	view.renderContextBar({ status: "absent", mode: "main", context: { objectId: null, route: null, sourceRole: null, s: null, coordinateMode: null }, actions: { modes: ["main", "q", "l"], openWorkbench: true, openObjects: true, openTaskRail: false } });
	const text = bar.children[0].children.map((entry) => entry.textContent).join(" "); assert.equal(text, "Kein aktives Objekt"); assert.doesNotMatch(text, /Strecke|Rolle|\bs (?:\d|nicht)|LOCAL|QUALIFIED|EPSG/);
});
