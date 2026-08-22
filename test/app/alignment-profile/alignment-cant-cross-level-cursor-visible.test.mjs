import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

class FakeElement {
	constructor(documentRef) { this.ownerDocument = documentRef; this.children = []; this.dataset = {}; this.attributes = new Map(); this.textContent = ""; }
	append(...children) { this.children.push(...children); }
	replaceChildren(...children) { this.children = children; }
	setAttribute(name, value) { this.attributes.set(name, String(value)); }
	querySelector(selector) {
		const key = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1]?.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
		return key ? this.find((entry) => Object.hasOwn(entry.dataset, key)) : null;
	}
	find(predicate) {
		for (const child of this.children) {
			if (predicate(child)) return child;
			const found = child.find?.(predicate);
			if (found) return found;
		}
		return null;
	}
}

class MainView { render() {} }
class CantView {
	setSelectionHandler(handler) { this.handler = handler; CantView.instance = this; }
	render() {}
}

test("wiring delegates each Cant selection exactly once to the existing store cursor action", () => {
	const documentRef = { createElement() { return new FakeElement(documentRef); }, getElementById(id) { return id === "cockpitPanel" ? panel : null; } };
	const panel = new FakeElement(documentRef);
	const selections = [];
	const wiring = wireAlignmentProfileSynchronizedView({
		store: {
			actions: { setCursorS(s) { selections.push(s); } },
			getState() { return { workspace_selection: { primaryId: null }, cursor: { s: 0 } }; },
			subscribe() { return () => {}; },
		},
		messaging: { async sendCmdAwait() {} },
		projectionController: { async projectAt() {} },
		cantCrossLevelController: { project() {} },
		View: MainView,
		CantCrossLevelView: CantView,
		documentRef,
	});
	CantView.instance.handler(75);
	assert.deepEqual(selections, [75]);
	wiring.stop();
});

test("Cant interaction boundary remains import-free and has no persistence mutation", async () => {
	const [viewSource, wiringSource] = await Promise.all([
		readFile(new URL("../../../app/view/alignment-profile/AlignmentCantCrossLevelView.js", import.meta.url), "utf8"),
		readFile(new URL("../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js", import.meta.url), "utf8"),
	]);
	assert.doesNotMatch(viewSource, /^import |store|repository|aim-core|sendCmdAwait|saveProfileState|Spot\./m);
	assert.match(viewSource, /setSelectionHandler/);
	assert.match(wiringSource, /cantCrossLevelView\.setSelectionHandler/);
	assert.doesNotMatch(wiringSource, /Spot\.(AddObjects|RemoveObject)|dispatchEvent/);
});
