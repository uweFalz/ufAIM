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
	findAll(predicate, result = []) {
		if (predicate(this)) result.push(this);
		for (const child of this.children) child.findAll?.(predicate, result);
		return result;
	}
	find(predicate) { return this.findAll(predicate)[0] ?? null; }
}

function fixture() {
	const documentRef = {
		createElement(name) { return new FakeElement(documentRef, name); },
		createElementNS(_namespace, name) { return new FakeElement(documentRef, name); },
	};
	const host = new FakeElement(documentRef, "host");
	return { host, view: new AlignmentLongitudinalProfileView({ host }) };
}

function model(cursorElementId = "V1", samples) {
	return {
		status: "projected",
		domain: { parameterKind: "intrinsic-s", startS: 0, endS: 100 },
		boundaries: [0, 50, 100],
		elevationExtent: { min: 10, max: 11.25 },
		samples: samples ?? [
			{ s: 0, elevation: 10, gradient: 0.01, elementId: "V1" },
			{ s: 25, elevation: 10.25, gradient: 0.01, elementId: "V1" },
			{ s: 50, elevation: 10.5, gradient: 0.01, elementId: "V2" },
			{ s: 75, elevation: 10.8125, gradient: 0.015, elementId: "V2" },
		],
		cursor: { status: "evaluated", s: cursorElementId === "V1" ? 25 : 50, elevation: cursorElementId === "V1" ? 10.25 : 10.5, gradient: 0.01, elementId: cursorElementId },
		activeElementDefinition: { id: cursorElementId, type: "constant-gradient" },
	};
}

function labels(host) {
	return host.findAll((entry) => "longitudinalElementLabel" in entry.dataset);
}

test("labels each consecutive evaluator group at its exact first supplied sample", () => {
	const { host, view } = fixture();
	view.render(model("V2"));
	const [v1, v2] = labels(host);
	assert.deepEqual([v1.textContent, v2.textContent], ["V1", "V2"]);
	assert.deepEqual(
		[v1.attributes.get("x"), v1.attributes.get("y")],
		["34", "204"]
	);
	assert.deepEqual(
		[v2.attributes.get("x"), v2.attributes.get("y")],
		["326", String(212 + ((10.5 - 10) / 1.25) * (28 - 212) - 8)]
	);
	assert.deepEqual(
		[v1.dataset.longitudinalElementLabelActive, v2.dataset.longitudinalElementLabelActive],
		["false", "true"]
	);
});

test("canonical V2 boundary ownership and active switch use exact evaluator identity", () => {
	for (const activeId of ["V1", "V2"]) {
		const { host, view } = fixture();
		view.render(model(activeId));
		assert.deepEqual(
			labels(host).map((label) => [label.textContent, label.dataset.longitudinalElementLabelActive]),
			[["V1", String(activeId === "V1")], ["V2", String(activeId === "V2")]]
		);
	}
});

test("null unknown and non-finite anchor evidence creates no fabricated label", () => {
	const samples = [
		{ s: 0, elevation: 10, elementId: null },
		{ s: 25, elevation: 10.25, elementId: undefined },
		{ s: Number.NaN, elevation: 10.5, elementId: "BAD-S" },
		{ s: 75, elevation: Number.POSITIVE_INFINITY, elementId: "BAD-Z" },
		{ s: 100, elevation: 11.25, elementId: "V2" },
	];
	const { host, view } = fixture();
	view.render(model("V2", samples));
	assert.deepEqual(labels(host).map((label) => label.textContent), ["V2"]);
});

test("cursor guides and pointer callback remain unchanged", () => {
	const { host, view } = fixture();
	const selected = [];
	view.setCursorSelectionHandler((s) => selected.push(s));
	view.render(model("V2"));
	assert.ok(host.find((entry) => "longitudinalCursorVerticalGuide" in entry.dataset));
	assert.ok(host.find((entry) => "longitudinalCursorHorizontalGuide" in entry.dataset));
	const hit = host.find((entry) => "longitudinalCursorHitTarget" in entry.dataset);
	hit.onclick({ clientX: 320 });
	assert.deepEqual(selected, [50]);
});
