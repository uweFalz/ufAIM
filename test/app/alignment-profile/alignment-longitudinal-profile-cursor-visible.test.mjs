import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

class FakeElement {
	constructor(documentRef) {
		this.ownerDocument = documentRef;
		this.children = [];
		this.dataset = {};
		this.attributes = new Map();
		this.textContent = "";
	}
	append(...children) {
		this.children.push(...children);
	}
	replaceChildren(...children) {
		this.children = children;
	}
	setAttribute(name, value) {
		this.attributes.set(name, String(value));
	}
	querySelector(selector) {
		const key = selector
			.match(/^\[data-([a-z0-9-]+)\]$/)?.[1]
			?.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
		if (!key) return null;
		return this.find((entry) =>
			Object.prototype.hasOwnProperty.call(entry.dataset, key)
		);
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

class MainView {
	constructor() {}
	render() {}
}

class LongitudinalView {
	setCursorSelectionHandler(handler) {
		this.handler = handler;
		LongitudinalView.instance = this;
	}
	render() {}
}

test("wiring delegates one selection only to the existing store cursor action", async () => {
	const panel = new FakeElement(null);
	const documentRef = {
		createElement() {
			return new FakeElement(documentRef);
		},
		getElementById(id) {
			return id === "cockpitPanel" ? panel : null;
		},
	};
	panel.ownerDocument = documentRef;
	const selections = [];
	const store = {
		actions: {
			setCursorS(s) {
				selections.push(s);
			},
		},
		getState() {
			return {
				workspace_selection: { primaryId: null },
				cursor: { s: 0 },
			};
		},
		subscribe() {
			return () => {};
		},
	};
	const wiring = wireAlignmentProfileSynchronizedView({
		store,
		messaging: { async sendCmdAwait() {} },
		projectionController: { async projectAt() {} },
		longitudinalController: { async project() {} },
		View: MainView,
		LongitudinalView,
		documentRef,
	});

	LongitudinalView.instance.handler(75);
	assert.deepEqual(selections, [75]);
	wiring.stop();
});

test("interaction boundary has no persistence mutation or second cursor authority", async () => {
	const [viewSource, wiringSource] = await Promise.all([
		readFile(
			new URL(
				"../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js",
				import.meta.url
			),
			"utf8"
		),
		readFile(
			new URL(
				"../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js",
				import.meta.url
			),
			"utf8"
		),
	]);
	assert.doesNotMatch(
		viewSource,
		/^import |store|repository|aim-core|sendCmdAwait|saveProfileState|Spot\./m
	);
	assert.match(wiringSource, /store\.actions\.setCursorS\(s\)/);
	assert.doesNotMatch(
		wiringSource,
		/Spot\.(AddObjects|RemoveObject)|saveProfileState|saveById|dispatchEvent/
	);
});
