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
	append(...children) {
		this.children.push(...children);
	}
	replaceChildren(...children) {
		this.children = children;
	}
	setAttribute(name, value) {
		this.attributes.set(name, String(value));
	}
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
		createElement(name) {
			return new FakeElement(documentRef, name);
		},
		createElementNS(_namespace, name) {
			return new FakeElement(documentRef, name);
		},
	};
	const host = new FakeElement(documentRef, "host");
	return { host, view: new AlignmentLongitudinalProfileView({ host }) };
}

function model({ cursorElementId = "V2", cursorS = 75 } = {}) {
	return {
		status: "projected",
		domain: { startS: 0, endS: 100 },
		boundaries: [0, 50, 100],
		elevationExtent: { min: 10, max: 11.25 },
		samples: [
			{ s: 0, elevation: 10, gradient: 0.01, elementId: "V1" },
			{ s: 25, elevation: 10.25, gradient: 0.01, elementId: "V1" },
			{ s: 50, elevation: 10.5, gradient: 0.01, elementId: "V1" },
			{ s: 50, elevation: 10.5, gradient: 0.01, elementId: "V2" },
			{ s: 75, elevation: 10.8125, gradient: 0.015, elementId: "V2" },
			{ s: 100, elevation: 11.25, gradient: 0.02, elementId: "V2" },
		],
		cursor: {
			status: "evaluated",
			s: cursorS,
			elevation: cursorS === 25 ? 10.25 : 10.8125,
			gradient: cursorS === 25 ? 0.01 : 0.015,
			elementId: cursorElementId,
		},
	};
}

function segments(host) {
	return host.findAll((entry) =>
		Object.prototype.hasOwnProperty.call(
			entry.dataset,
			"longitudinalElementSegment"
		)
	);
}

test("groups consecutive evaluator samples and highlights only the cursor element identity", () => {
	const { host, view } = fixture();
	view.render(model());
	assert.deepEqual(
		segments(host).map((entry) => [
			entry.dataset.longitudinalElementSegment,
			entry.dataset.longitudinalElementActive,
		]),
		[
			["V1", "false"],
			["V2", "true"],
		]
	);
	assert.equal(
		host.find((entry) =>
			Object.prototype.hasOwnProperty.call(
				entry.dataset,
				"longitudinalActiveElement"
			)
		).textContent,
		"Active vertical element V2"
	);
});

test("passes evaluator boundary ownership through without deriving it from station", () => {
	const { host, view } = fixture();
	view.render(model({ cursorElementId: "V2", cursorS: 50 }));
	assert.equal(
		segments(host).find(
			(entry) => entry.dataset.longitudinalElementSegment === "V2"
		).dataset.longitudinalElementActive,
		"true"
	);
});

test("cursor transition changes exact evaluator identity from V1 to V2", () => {
	const { host, view } = fixture();
	view.render(model({ cursorElementId: "V1", cursorS: 25 }));
	assert.match(
		host.find((entry) =>
			Object.prototype.hasOwnProperty.call(
				entry.dataset,
				"longitudinalActiveElement"
			)
		).textContent,
		/V1$/
	);
	view.render(model({ cursorElementId: "V2", cursorS: 75 }));
	assert.match(
		host.find((entry) =>
			Object.prototype.hasOwnProperty.call(
				entry.dataset,
				"longitudinalActiveElement"
			)
		).textContent,
		/V2$/
	);
});

test("unknown, not-covered, and inconsistent evaluator evidence never highlight", () => {
	for (const cursor of [
		{ status: "evaluated", s: 25, elevation: 10.25, gradient: 0.01 },
		{
			status: "evaluated",
			s: 25,
			elevation: 10.25,
			gradient: 0.01,
			elementId: "missing",
		},
		{ status: "not-covered", s: 125, elementId: "V2" },
	]) {
		const { host, view } = fixture();
		const value = model();
		value.cursor = cursor;
		view.render(value);
		assert.ok(
			segments(host).every(
				(entry) => entry.dataset.longitudinalElementActive === "false"
			)
		);
		assert.match(
			host.find((entry) =>
				Object.prototype.hasOwnProperty.call(
					entry.dataset,
					"longitudinalActiveElement"
				)
			).textContent,
			/unknown \/ unavailable$/
		);
	}
});
