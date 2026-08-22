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
		activeElementDefinition: { id: cursor?.elementId, type: "parabolic" },
	};
}

function find(host, key) {
	return host.find((entry) => Object.prototype.hasOwnProperty.call(entry.dataset, key));
}

test("renders exact cursor text and projected fixed-offset coordinates", () => {
	for (const [s, elevation, elementId, expectedX, expectedY, anchor] of [
		[0, 10, "V1", 38, 202, "start"],
		[50, 10.5, "V2", 330, 128.39999999999998, "start"],
		[75, 10.8125, "V2", 456, 82.39999999999999, "end"],
		[100, 11.25, "V2", 602, 28, "end"],
	]) {
		const { host, view } = fixture();
		view.render(model({ status: "evaluated", s, elevation, gradient: 0.01, elementId }));
		const callout = find(host, "longitudinalCursorCallout");
		assert.equal(callout.textContent, `s ${String(s)} · elevation ${String(elevation)} · gradient 0.01`);
		assert.equal(
			callout.attributes.get("aria-label"),
			`Shared cursor s ${String(s)}, elevation ${String(elevation)}, gradient 0.01`
		);
		assert.deepEqual(
			[callout.attributes.get("x"), callout.attributes.get("y"), callout.attributes.get("text-anchor")],
			[String(expectedX), String(expectedY), anchor]
		);
	}
});

test("edge placement clamps visually without mutating exact cursor values", () => {
	const cursor = { status: "evaluated", s: 100, elevation: 11.25, gradient: 0.02, elementId: "V2" };
	const before = structuredClone(cursor);
	const { host, view } = fixture();
	view.render(model(cursor));
	const callout = find(host, "longitudinalCursorCallout");
	assert.equal(callout.attributes.get("x"), "602");
	assert.equal(callout.attributes.get("y"), "28");
	assert.equal(callout.textContent, "s 100 · elevation 11.25 · gradient 0.02");
	assert.equal(callout.attributes.get("aria-label"), "Shared cursor s 100, elevation 11.25, gradient 0.02");
	assert.deepEqual(cursor, before);
});

test("missing and non-finite gradient retain the exact base callout and placement", () => {
	for (const gradient of [undefined, Number.NaN, Number.NEGATIVE_INFINITY]) {
		const { host, view } = fixture();
		view.render(model({ status: "evaluated", s: 50, elevation: 10.5, gradient, elementId: "V2" }));
		const callout = find(host, "longitudinalCursorCallout");
		assert.equal(callout.textContent, "s 50 · elevation 10.5");
		assert.equal(callout.attributes.get("aria-label"), "Shared cursor s 50, elevation 10.5");
		assert.deepEqual(
			[callout.attributes.get("x"), callout.attributes.get("y"), callout.attributes.get("text-anchor")],
			["330", "128.39999999999998", "start"]
		);
	}
});

test("non-evaluated and non-finite cursors render no callout", () => {
	for (const cursor of [
		{ status: "not-covered", s: 50, elevation: 10.5, elementId: null },
		{ status: "evaluated", s: Number.NaN, elevation: 10.5, elementId: "V2" },
		{ status: "evaluated", s: 50, elevation: Number.POSITIVE_INFINITY, elementId: "V2" },
	]) {
		const { host, view } = fixture();
		view.render(model(cursor));
		assert.equal(find(host, "longitudinalCursorCallout"), null);
	}
});

test("labels guides and pointer callback remain unchanged", () => {
	const { host, view } = fixture();
	const selected = [];
	view.setCursorSelectionHandler((s) => selected.push(s));
	view.render(model({ status: "evaluated", s: 50, elevation: 10.5, gradient: 0.01, elementId: "V2" }));
	assert.ok(find(host, "longitudinalCursorVerticalGuide"));
	assert.ok(find(host, "longitudinalCursorHorizontalGuide"));
	assert.ok(find(host, "longitudinalElementLabel"));
	const hit = find(host, "longitudinalCursorHitTarget");
	hit.onclick({ clientX: 320 });
	assert.deepEqual(selected, [50]);
});
