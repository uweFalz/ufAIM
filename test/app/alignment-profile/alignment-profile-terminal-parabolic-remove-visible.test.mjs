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

function model({ definition = V2, definitions = [V1, V2], s = 75 } = {}) {
	const v2 = definition?.id === "V2";
	return {
		status: "projected", domain: { parameterKind: "intrinsic-s", startS: 0, endS: 120 },
		boundaries: [0, 50, 120], elevationExtent: { min: 10, max: 12.18 },
		samples: [{ s: 0, elevation: 10, elementId: "V1" },
			{ s: 50, elevation: 10.5, elementId: "V2" },
			{ s: 120, elevation: 12.18, elementId: "V2" }],
		cursor: { status: definition ? "evaluated" : "not-covered", s,
			elevation: v2 ? 10.875 : 10.25, gradient: v2 ? 0.02 : 0.01,
			elementId: definition?.id ?? null },
		elementDefinitions: definitions, activeElementDefinition: definition,
	};
}

function evidence(host, key) {
	return host.find((entry) => Object.prototype.hasOwnProperty.call(entry.dataset, key));
}

test("renders exact V2 removal and submits only persisted identity", async () => {
	const { host, view } = fixture(); const removals = [];
	view.setTerminalParabolicRemoveHandler((value) => removals.push(value));
	view.render(model());
	const form = evidence(host, "terminalParabolicRemove");
	assert.equal(form.dataset.terminalParabolicRemove, "V2");
	form.onsubmit({ preventDefault() {} }); await Promise.resolve();
	assert.deepEqual(removals, [{ elementId: "V2" }]);
	view.renderTerminalParabolicRemoveStatus("removed");
	assert.equal(evidence(host, "terminalParabolicRemoveStatus").textContent, "removed");
});

test("after removal V1 projection has domain 0..50 and no V2 controls or label", () => {
	const { host, view } = fixture();
	view.setTerminalParabolicRemoveHandler(() => {});
	const remaining = model({ definition: V1, definitions: [V1], s: 25 });
	remaining.domain.endS = 50; remaining.boundaries = [0, 50];
	remaining.elevationExtent.max = 10.5;
	remaining.samples = [{ s: 0, elevation: 10, elementId: "V1" },
		{ s: 25, elevation: 10.25, elementId: "V1" },
		{ s: 50, elevation: 10.5, elementId: "V1" }];
	view.render(remaining);
	assert.equal(evidence(host, "longitudinalDomainEnd").textContent, "50");
	assert.equal(evidence(host, "longitudinalCursorCallout").textContent,
		"s 25 · elevation 10.25 · gradient 0.01");
	assert.equal(evidence(host, "terminalParabolicRemove"), null);
	assert.equal(host.find((entry) => entry.dataset.longitudinalElementLabel === "V2"), null);
	view.renderTerminalParabolicRemoveStatus("removed");
	view.render(remaining);
	assert.equal(evidence(host, "terminalParabolicRemoveStatus").textContent, "removed");
});

test("V1 unknown non-terminal and sole parabolic evidence expose no removal", () => {
	for (const [definition, definitions] of [
		[V1, [V1, V2]], [null, [V1, V2]],
		[{ ...V2, id: "P1" }, [{ ...V2, id: "P1" }, V2]], [V2, [V2]],
	]) {
		const { host, view } = fixture(); view.setTerminalParabolicRemoveHandler(() => {});
		view.render(model({ definition, definitions }));
		assert.equal(evidence(host, "terminalParabolicRemove"), null);
	}
});
