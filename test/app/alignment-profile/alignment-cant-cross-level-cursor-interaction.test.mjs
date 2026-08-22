import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentCantCrossLevelView } from "../../../app/view/alignment-profile/AlignmentCantCrossLevelView.js";

class FakeElement {
	constructor(documentRef, name) {
		this.ownerDocument = documentRef;
		this.name = name;
		this.children = [];
		this.dataset = {};
		this.attributes = new Map();
		this.textContent = "";
		this.onclick = null;
	}
	append(...children) { this.children.push(...children); }
	replaceChildren(...children) { this.children = children; }
	setAttribute(name, value) { this.attributes.set(name, String(value)); }
	getBoundingClientRect() { return { left: 100, width: 320 }; }
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
	return { host, view: new AlignmentCantCrossLevelView({ host }) };
}

function projected() {
	return {
		status: "projected",
		domain: { parameterKind: "intrinsic-s", startS: 0, endS: 100 },
		boundaries: [0, 50, 100],
		elements: [
			{ id: "C1", startS: 0, endS: 50 },
			{ id: "C2", startS: 50, endS: 100 },
		],
		samples: [
			{ elementId: "C1", s: 0, crossLevel: 0.05, twist: 0 },
			{ elementId: "C2", s: 50, crossLevel: 0.05, twist: 0.001 },
			{ elementId: "C2", s: 75, crossLevel: 0.07500000000000001, twist: 0.001 },
			{ elementId: "C2", s: 100, crossLevel: 0.1, twist: 0.001 },
		],
		cursor: { status: "evaluated", elementId: "C2", s: 75, crossLevel: 0.07500000000000001, twist: 0.001 },
		reference: { status: "partial" },
	};
}

function hitTarget(host) {
	return host.find((entry) =>
		Object.prototype.hasOwnProperty.call(entry.dataset, "cantCursorHitTarget")
	);
}

function clickAtDomainFraction(target, fraction) {
	const viewBoxX = 28 + fraction * (640 - 56);
	const clientX = 100 + (viewBoxX / 640) * 320;
	target.onclick({ clientX });
}

test("maps the exact Cant SVG horizontal coordinate to shared intrinsic s once", () => {
	const { host, view } = fixture();
	const selected = [];
	view.setSelectionHandler((s) => selected.push(s));
	view.render(projected());
	const target = hitTarget(host);
	assert.ok(target);
	assert.equal(target.attributes.get("role"), "button");
	const svg = host.find((entry) => entry.name === "svg");
	assert.strictEqual(svg.children.at(-1), target);
	clickAtDomainFraction(target, 0.75);
	assert.deepEqual(selected, [75]);
	assert.equal(selected.length, 1);
	const evidence = host.find((entry) => Object.hasOwn(entry.dataset, "cantCursorEvidence"));
	assert.match(evidence.textContent, /C2.*0\.07500000000000001.*0\.001/);
});

test("maps exact endpoints, clamps outside placement and rejects non-finite coordinates", () => {
	const { host, view } = fixture();
	const selected = [];
	view.setSelectionHandler((s) => selected.push(s));
	view.render(projected());
	const target = hitTarget(host);
	clickAtDomainFraction(target, 0);
	clickAtDomainFraction(target, 1);
	target.onclick({ clientX: -1000 });
	target.onclick({ clientX: 2000 });
	target.onclick({ clientX: Number.NaN });
	assert.deepEqual(selected, [0, 100, 0, 100]);
});

test("absent, error and malformed evidence expose no interactive hit target", () => {
	for (const viewModel of [
		{ status: "absent" },
		{ status: "error", error: { message: "invalid" } },
		{ ...projected(), domain: { parameterKind: "intrinsic-s", startS: 0, endS: Number.NaN } },
	]) {
		const { host, view } = fixture();
		let calls = 0;
		view.setSelectionHandler(() => { calls += 1; });
		view.render(viewModel);
		assert.equal(hitTarget(host), null);
		assert.equal(calls, 0);
	}
});
