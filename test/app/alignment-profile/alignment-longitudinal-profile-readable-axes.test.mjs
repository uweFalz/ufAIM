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
	find(predicate) {
		if (predicate(this)) return this;
		for (const child of this.children) {
			const found = child.find?.(predicate);
			if (found) return found;
		}
		return null;
	}
	findAll(predicate, result = []) {
		if (predicate(this)) result.push(this);
		for (const child of this.children) child.findAll?.(predicate, result);
		return result;
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

function model({ min = 10, max = 11.25, boundaries = [0, 50, 100] } = {}) {
	return {
		status: "projected",
		domain: { parameterKind: "intrinsic-s", startS: 0, endS: 100 },
		boundaries,
		elevationExtent: { min, max },
		samples: [
			{ s: 0, elevation: min, gradient: 0.01, elementId: "V1" },
			{ s: 100, elevation: max, gradient: 0.02, elementId: "V2" },
		],
		cursor: { status: "evaluated", s: 0, elevation: min, gradient: 0.01, elementId: "V1" },
		activeElementDefinition: { id: "V1", type: "constant-gradient", startS: 0, endS: 50 },
	};
}

function datasetValue(host, key) {
	return host.find((entry) =>
		Object.prototype.hasOwnProperty.call(entry.dataset, key)
	)?.textContent;
}

test("renders exact domain and elevation labels with explicit axis names", () => {
	const { host, view } = fixture();
	view.render(model());
	assert.equal(datasetValue(host, "longitudinalHorizontalAxisLabel"), "intrinsic-s");
	assert.equal(datasetValue(host, "longitudinalVerticalAxisLabel"), "elevation [m]");
	assert.equal(datasetValue(host, "longitudinalDomainStart"), "0");
	assert.equal(datasetValue(host, "longitudinalDomainEnd"), "100");
	assert.equal(datasetValue(host, "longitudinalElevationMin"), "10");
	assert.equal(datasetValue(host, "longitudinalElevationMax"), "11.25");
	assert.ok(host.find((entry) => "longitudinalHorizontalAxis" in entry.dataset));
	assert.ok(host.find((entry) => "longitudinalVerticalAxis" in entry.dataset));
});

test("accepts only explicit intrinsic-s while retaining omitted-kind compatibility", () => {
	for (const domain of [
		{ parameterKind: "intrinsic-s", startS: 0, endS: 100 },
		{ startS: 0, endS: 100 },
	]) {
		const { host, view } = fixture();
		view.render({ ...model(), domain });
		assert.equal(datasetValue(host, "longitudinalHorizontalAxisLabel"), "intrinsic-s");
	}

	for (const parameterKind of ["chainage", "station", "", null]) {
		const { host, view } = fixture();
		view.render({
			...model(),
			domain: { parameterKind, startS: 0, endS: 100 },
		});
		assert.equal(host.find((entry) => entry.name === "svg"), null);
		assert.equal(datasetValue(host, "longitudinalHorizontalAxisLabel"), undefined);
		assert.match(
			host.find((entry) => "longitudinalProfileEmpty" in entry.dataset).textContent,
			/unavailable/
		);
	}
});

test("labels exact supplied boundaries and de-duplicates only Object.is-equal values", () => {
	const { host, view } = fixture();
	view.render(model({ boundaries: [0, 50, 50, 100] }));
	assert.deepEqual(
		host.findAll((entry) => "longitudinalBoundaryLabel" in entry.dataset)
			.map((entry) => entry.textContent),
		["0", "50", "100"]
	);
});

test("flat elevation extent remains exact without a fabricated range", () => {
	const { host, view } = fixture();
	view.render(model({ min: 10, max: 10 }));
	assert.equal(datasetValue(host, "longitudinalElevationMin"), "10");
	assert.equal(datasetValue(host, "longitudinalElevationMax"), "10");
});

test("non-finite domain extent or boundary evidence renders no invented axes", () => {
	for (const value of [
		{ ...model(), domain: { parameterKind: "intrinsic-s", startS: 0, endS: Number.NaN } },
		{ ...model(), elevationExtent: { min: 10, max: Number.POSITIVE_INFINITY } },
		{ ...model(), boundaries: [0, Number.NaN, 100] },
	]) {
		const { host, view } = fixture();
		view.render(value);
		assert.equal(host.find((entry) => entry.name === "svg"), null);
		assert.match(host.find((entry) => "longitudinalProfileEmpty" in entry.dataset).textContent, /unavailable/);
	}
});
