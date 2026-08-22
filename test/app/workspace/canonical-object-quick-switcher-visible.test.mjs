import assert from "node:assert/strict";
import test from "node:test";
import { CanonicalObjectQuickSwitcherView } from "../../../app/view/workspace/CanonicalObjectQuickSwitcherView.js";

function element(tag = "div") {
	return { tag, dataset: {}, children: [], textContent: "", value: "", disabled: false, attributes: {}, append(...values) { this.children.push(...values); }, replaceChildren(...values) { this.children = values; }, addEventListener(type, handler) { this.handlers ??= {}; this.handlers[type] = handler; }, setAttribute(name, value) { this.attributes[name] = value; }, focus() {} };
}
function textOf(node) { return [node.textContent, ...(node.children ?? []).map(textOf)].join(" "); }

test("view renders honest loading error empty and active multi-object states", () => {
	const root = element(), documentRef = { createElement: (tag) => element(tag) }, calls = [];
	const view = new CanonicalObjectQuickSwitcherView({ documentRef, root });
	view.setHandlers({ retry: () => calls.push("retry"), activate: (id) => calls.push(id), close: () => calls.push("close") });
	view.render({ phase: "loading", rows: [], total: 0, query: "", activeObjectId: null });
	assert.match(textOf(root), /Objekte werden geladen/);
	view.render({ phase: "error", error: "worker unavailable", rows: [], total: 0, query: "", activeObjectId: null });
	assert.match(textOf(root), /worker unavailable.*Erneut versuchen/);
	root.children[1].handlers.click(); assert.deepEqual(calls, ["retry"]);
	view.render({ phase: "ready", rows: [], total: 0, query: "", activeObjectId: null });
	assert.match(textOf(root), /0 Objekte.*Noch keine Objekte/);
	view.render({ phase: "ready", total: 2, query: "", activeObjectId: "B", rows: [
		{ objectId: "A", label: "Nord", route: "1720", role: "1", reviewStatus: "reviewed", spaceStatus: "local" },
		{ objectId: "B", label: "Sued", route: "1720", role: "2", reviewStatus: "open-candidates", spaceStatus: "qualified" },
	] });
	const list = root.children[2];
	assert.match(textOf(root), /Nord.*A.*Strecke 1720.*Rolle 1.*reviewed.*local.*Sued.*B.*qualified/);
	assert.equal(list.children[1].children[0].attributes["aria-current"], "true");
	list.children[1].children[0].handlers.click(); assert.deepEqual(calls, ["retry", "B"]);
	root.handlers.keydown({ key: "Escape", preventDefault() {} }); assert.deepEqual(calls, ["retry", "B", "close"]);
});
