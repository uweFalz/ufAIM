import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

function model(definition) {
	return {
		status: "projected",
		domain: { startS: 0, endS: 100 },
		boundaries: [0, 50, 100],
		elevationExtent: { min: 10, max: 11.25 },
		samples: [
			{ s: 0, elevation: 10, gradient: 0.01, elementId: "V1" },
			{ s: 50, elevation: 10.5, gradient: 0.01, elementId: "V1" },
			{ s: 75, elevation: 10.8125, gradient: 0.015, elementId: "V2" },
			{ s: 100, elevation: 11.25, gradient: 0.02, elementId: "V2" },
		],
		cursor: {
			status: "evaluated",
			s: definition.id === "V1" ? 25 : 75,
			elevation: definition.id === "V1" ? 10.25 : 10.8125,
			gradient: definition.id === "V1" ? 0.01 : 0.015,
			elementId: definition.id,
		},
		activeElementDefinition: definition,
	};
}

function fieldValues(host) {
	return Object.fromEntries(
		host.findAll((entry) => entry.dataset.longitudinalElementField)
			.map((entry) => [entry.dataset.longitudinalElementField, entry.textContent])
	);
}

test("shows only exact stored V1 fields and marks absent gradient rate", () => {
	const { host, view } = fixture();
	view.render(model({
		id: "V1", type: "constant-gradient", startS: 0, endS: 50,
		startElevation: 10, gradient: 0.01,
	}));
	assert.deepEqual(fieldValues(host), {
		id: "V1", type: "constant-gradient", startS: "0", endS: "50",
		startElevation: "10", startGradient: "not-provided", gradient: "0.01",
		gradientRate: "not-provided",
	});
});

test("switches to exact stored V2 fields without calculating missing gradient", () => {
	const { host, view } = fixture();
	view.render(model({
		id: "V2", type: "parabolic", startS: 50, endS: 100,
		startElevation: 10.5, startGradient: 0.01, gradientRate: 0.0002,
	}));
	assert.deepEqual(fieldValues(host), {
		id: "V2", type: "parabolic", startS: "50", endS: "100",
		startElevation: "10.5", startGradient: "0.01", gradient: "not-provided",
		gradientRate: "0.0002",
	});
	assert.equal(host.find((entry) => entry.textContent === "0.02"), null);
});

test("mismatched or missing definition is visibly unavailable", () => {
	for (const definition of [null, { id: "other", type: "unknown" }]) {
		const { host, view } = fixture();
		const value = model({ id: "V2" });
		value.activeElementDefinition = definition;
		view.render(value);
		assert.match(
			host.find((entry) =>
				Object.prototype.hasOwnProperty.call(entry.dataset, "longitudinalElementDefinitionUnavailable")
			).textContent,
			/unknown \/ unavailable$/
		);
		assert.equal(fieldValues(host).id, undefined);
	}
});

test("view remains render-only and preserves existing plot cursor contracts", async () => {
	const source = await readFile(
		new URL("../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js", import.meta.url),
		"utf8"
	);
	assert.doesNotMatch(source, /^import |store|repository|aim-core|sendCmdAwait|saveProfileState|Spot\.|Worker|messaging/m);
	assert.match(source, /dataset\.longitudinalProfilePath/);
	assert.match(source, /dataset\.longitudinalCursorHitTarget/);
	assert.match(source, /dataset\.longitudinalElementActive/);
	assert.match(source, /dataset\.longitudinalCursorEvidence/);
	assert.doesNotMatch(source, /terminalGradient|endpointElevation|radius|curvature|chainage/);
});
