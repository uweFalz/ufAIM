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
			{ s: 0, elevation: 10, gradient: 0.01, elementId: "V1" },
			{ s: 50, elevation: 10.5, gradient: 0.01, elementId: "V2" },
			{ s: 75, elevation: 10.8125, gradient: 0.015, elementId: "V2" },
			{ s: 100, elevation: 11.25, gradient: 0.02, elementId: "V2" },
		],
		cursor,
		activeElementDefinition: { id: cursor?.elementId, type: "parabolic" },
	};
}

function guide(host, key) {
	return host.find((entry) => Object.prototype.hasOwnProperty.call(entry.dataset, key));
}

test("projects exact vertical and horizontal guides at endpoints boundary and interior", () => {
	for (const [s, elevation, elementId, expectedX] of [
		[0, 10, "V1", 28],
		[50, 10.5, "V2", 320],
		[75, 10.8125, "V2", 466],
		[100, 11.25, "V2", 612],
	]) {
		const expectedY = 212 + ((elevation - 10) / (11.25 - 10)) * (28 - 212);
		const { host, view } = fixture();
		view.render(model({ status: "evaluated", s, elevation, gradient: 0.01, elementId }));
		const vertical = guide(host, "longitudinalCursorVerticalGuide");
		const horizontal = guide(host, "longitudinalCursorHorizontalGuide");
		assert.deepEqual(
			[vertical.attributes.get("x1"), vertical.attributes.get("x2"), vertical.attributes.get("y1"), vertical.attributes.get("y2")],
			[String(expectedX), String(expectedX), String(expectedY), "212"]
		);
		assert.deepEqual(
			[horizontal.attributes.get("x1"), horizontal.attributes.get("x2"), horizontal.attributes.get("y1"), horizontal.attributes.get("y2")],
			["28", String(expectedX), String(expectedY), String(expectedY)]
		);
	}
});

test("missing non-finite and non-evaluated cursors render no guides", () => {
	for (const cursor of [
		{ status: "not-covered", s: 50, elevation: 10.5, elementId: null },
		{ status: "evaluated", s: Number.NaN, elevation: 10.5, elementId: "V2" },
		{ status: "evaluated", s: 50, elevation: Number.POSITIVE_INFINITY, elementId: "V2" },
	]) {
		const { host, view } = fixture();
		view.render(model(cursor));
		assert.equal(guide(host, "longitudinalCursorVerticalGuide"), null);
		assert.equal(guide(host, "longitudinalCursorHorizontalGuide"), null);
	}
});

test("existing pointer callback remains the sole cursor selection seam", () => {
	const { host, view } = fixture();
	const selected = [];
	view.setCursorSelectionHandler((s) => selected.push(s));
	view.render(model({ status: "evaluated", s: 50, elevation: 10.5, gradient: 0.01, elementId: "V2" }));
	const hit = guide(host, "longitudinalCursorHitTarget");
	hit.onclick({ clientX: 320 });
	assert.deepEqual(selected, [50]);
});
