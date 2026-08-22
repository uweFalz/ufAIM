import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentLongitudinalProfileView } from "../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js";

class FakeElement {
	constructor(documentRef, name) {
		this.ownerDocument = documentRef;
		this.name = name;
		this.children = [];
		this.dataset = {};
		this.attributes = new Map();
		this.textContent = "";
	}
	append(...children) { this.children.push(...children); }
	replaceChildren(...children) { this.children = children; }
	setAttribute(name, value) { this.attributes.set(name, String(value)); }
	getBoundingClientRect() { return { left: 0, width: 640 }; }
	find(predicate) {
		if (predicate(this)) return this;
		for (const child of this.children) {
			const found = child.find?.(predicate);
			if (found) return found;
		}
		return null;
	}
}

function fixture() {
	const documentRef = {
		createElement(name) { return new FakeElement(documentRef, name); },
		createElementNS(_namespace, name) { return new FakeElement(documentRef, name); },
	};
	const host = new FakeElement(documentRef, "host");
	return { host, view: new AlignmentLongitudinalProfileView({ host }) };
}

function model(cursor) {
	return {
		status: "projected",
		domain: { parameterKind: "intrinsic-s", startS: 0, endS: 100 },
		boundaries: [0, 50, 100],
		elevationExtent: { min: 10, max: 11.25 },
		samples: [
			{ s: 0, elevation: 10, elementId: "V1" },
			{ s: 50, elevation: 10.5, elementId: "V2" },
			{ s: 75, elevation: 10.8125, elementId: "V2" },
			{ s: 100, elevation: 11.25, elementId: "V2" },
		],
		cursor,
		activeElementDefinition: { id: cursor.elementId, type: "parabolic" },
	};
}

function evidence(host, key) {
	return host.find((entry) => Object.prototype.hasOwnProperty.call(entry.dataset, key));
}

test("appends exact finite gradient strings at V1 boundary interior and endpoint", () => {
	for (const [s, elevation, gradient, elementId] of [
		[0, 10, 0.01, "V1"],
		[50, 10.5, 0.01, "V2"],
		[75, 10.8125, 0.015, "V2"],
		[100, 11.25, 1e-9, "V2"],
	]) {
		const { host, view } = fixture();
		view.render(model({ status: "evaluated", s, elevation, gradient, elementId }));
		const callout = evidence(host, "longitudinalCursorCallout");
		assert.equal(
			callout.textContent,
			`s ${String(s)} · elevation ${String(elevation)} · gradient ${String(gradient)}`
		);
		assert.equal(
			callout.attributes.get("aria-label"),
			`Shared cursor s ${String(s)}, elevation ${String(elevation)}, gradient ${String(gradient)}`
		);
	}
});

test("absent NaN and infinite gradients omit only the suffix and retain placement", () => {
	for (const gradient of [undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
		const cursor = { status: "evaluated", s: 75, elevation: 10.8125, gradient, elementId: "V2" };
		const before = { ...cursor };
		const { host, view } = fixture();
		view.render(model(cursor));
		const callout = evidence(host, "longitudinalCursorCallout");
		assert.equal(callout.textContent, "s 75 · elevation 10.8125");
		assert.equal(callout.attributes.get("aria-label"), "Shared cursor s 75, elevation 10.8125");
		assert.deepEqual(
			[callout.attributes.get("x"), callout.attributes.get("y"), callout.attributes.get("text-anchor")],
			["456", "82.39999999999999", "end"]
		);
		assert.deepEqual(cursor, before);
	}
});

test("existing labels guides and pointer callback remain intact", () => {
	const { host, view } = fixture();
	const selected = [];
	view.setCursorSelectionHandler((s) => selected.push(s));
	view.render(model({ status: "evaluated", s: 50, elevation: 10.5, gradient: 0.01, elementId: "V2" }));
	assert.ok(evidence(host, "longitudinalElementLabel"));
	assert.ok(evidence(host, "longitudinalCursorVerticalGuide"));
	assert.ok(evidence(host, "longitudinalCursorHorizontalGuide"));
	const hit = evidence(host, "longitudinalCursorHitTarget");
	hit.onclick({ clientX: 320 });
	assert.deepEqual(selected, [50]);
});
