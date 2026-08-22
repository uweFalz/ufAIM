import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentLongitudinalProfileView } from "../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js";

class FakeElement {
	constructor(documentRef, name) {
		this.ownerDocument = documentRef; this.name = name; this.children = [];
		this.dataset = {}; this.attributes = new Map(); this.textContent = ""; this.value = "";
	}
	append(...children) { this.children.push(...children); }
	replaceChildren(...children) { this.children = children; }
	setAttribute(name, value) { this.attributes.set(name, String(value)); }
	getBoundingClientRect() { return { left: 0, width: 640 }; }
	find(predicate) {
		if (predicate(this)) return this;
		for (const child of this.children) { const found = child.find?.(predicate); if (found) return found; }
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

const V1 = { id: "V1", type: "constant-gradient", startS: 0, endS: 50,
	startElevation: 10, gradient: 0.01 };
const V2 = { id: "V2", type: "parabolic", startS: 50, endS: 120,
	startElevation: 10.5, startGradient: 0.01, gradientRate: 0.0004 };

function model(definition = V2) {
	return {
		status: "projected",
		domain: { parameterKind: "intrinsic-s", startS: 0, endS: 120 },
		boundaries: [0, 50, 120], elevationExtent: { min: 10, max: 12.18 },
		samples: [{ s: 0, elevation: 10, elementId: "V1" },
			{ s: 50, elevation: 10.5, elementId: "V2" },
			{ s: 120, elevation: 12.18, elementId: "V2" }],
		cursor: { status: "evaluated", s: definition?.id === "V2" ? 120 : 25,
			elevation: definition?.id === "V2" ? 12.18 : 10.25,
			gradient: definition?.id === "V2" ? 0.038 : 0.01,
			elementId: definition?.id ?? null },
		elementDefinitions: [V1, V2], activeElementDefinition: definition,
	};
}

function evidence(host, key) {
	return host.find((entry) => Object.prototype.hasOwnProperty.call(entry.dataset, key));
}

test("renders terminal V2 endS form and submits only exact identity and input", async () => {
	const { host, view } = fixture();
	const submissions = [];
	view.setTerminalParabolicEndSHandler((value) => submissions.push(value));
	view.render(model());
	const form = evidence(host, "terminalParabolicDomainEdit");
	const input = evidence(host, "terminalParabolicEndSInput");
	assert.equal(form.dataset.terminalParabolicDomainEdit, "V2");
	assert.equal(input.value, "120");
	input.value = "140";
	form.onsubmit({ preventDefault() {} });
	await Promise.resolve();
	assert.deepEqual(submissions, [{ elementId: "V2", endS: "140" }]);
	view.renderTerminalParabolicDomainEditStatus("saved");
	assert.equal(evidence(host, "terminalParabolicDomainEditStatus").textContent, "saved");
	assert.equal(evidence(host, "longitudinalDomainEnd").textContent, "120");
	assert.equal(evidence(host, "longitudinalCursorCallout").textContent,
		"s 120 · elevation 12.18 · gradient 0.038");
});

test("hides domain form for V1, unknown and non-terminal parabolic evidence", () => {
	for (const [definition, definitions] of [
		[V1, [V1, V2]], [null, [V1, V2]],
		[{ ...V2, id: "P1" }, [{ ...V2, id: "P1" }, V2]],
	]) {
		const { host, view } = fixture();
		view.setTerminalParabolicEndSHandler(() => {});
		const value = model(definition); value.elementDefinitions = definitions;
		view.render(value);
		assert.equal(evidence(host, "terminalParabolicDomainEdit"), null);
	}
});

test("existing gradient-rate form remains available and behaviorally separate", async () => {
	const { host, view } = fixture();
	const rate = [];
	view.setTerminalParabolicGradientRateHandler((value) => rate.push(value));
	view.setTerminalParabolicEndSHandler(() => {});
	view.render(model());
	const rateForm = evidence(host, "terminalParabolicGradientRateEdit");
	const rateInput = evidence(host, "terminalParabolicGradientRateInput");
	assert.equal(rateInput.value, "0.0004");
	rateForm.onsubmit({ preventDefault() {} }); await Promise.resolve();
	assert.deepEqual(rate, [{ elementId: "V2", gradientRate: "0.0004" }]);
});
