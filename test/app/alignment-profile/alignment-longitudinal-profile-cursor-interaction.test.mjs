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
		this.onclick = null;
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
	getBoundingClientRect() {
		return { left: 100, width: 320 };
	}
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

function projected() {
	return {
		status: "projected",
		domain: { startS: 0, endS: 100 },
		boundaries: [0, 50, 100],
		elevationExtent: { min: 10, max: 11.25 },
		samples: [
			{ s: 0, elevation: 10 },
			{ s: 50, elevation: 10.5 },
			{ s: 100, elevation: 11.25 },
		],
		cursor: {
			status: "evaluated",
			s: 0,
			elevation: 10,
			gradient: 0.01,
		},
	};
}

function hitTarget(host) {
	return host.find((entry) =>
		Object.prototype.hasOwnProperty.call(
			entry.dataset,
			"longitudinalCursorHitTarget"
		)
	);
}

test("maps actual SVG coordinates to intrinsic s and invokes once", () => {
	const { host, view } = fixture();
	const selected = [];
	view.setCursorSelectionHandler((s) => selected.push(s));
	view.render(projected());
	const target = hitTarget(host);
	assert.ok(target);
	assert.equal(target.attributes.get("role"), "button");

	const viewBoxX = 28 + 0.75 * (640 - 56);
	const clientX = 100 + (viewBoxX / 640) * 320;
	target.onclick({ clientX });
	assert.deepEqual(selected, [75]);
	assert.equal(selected.length, 1);
});

test("clamps endpoint selections and rejects non-finite coordinates", () => {
	const { host, view } = fixture();
	const selected = [];
	view.setCursorSelectionHandler((s) => selected.push(s));
	view.render(projected());
	const target = hitTarget(host);
	target.onclick({ clientX: -1000 });
	target.onclick({ clientX: 2000 });
	target.onclick({ clientX: Number.NaN });
	assert.deepEqual(selected, [0, 100]);
});

test("absent and error states have no interactive hit target", () => {
	for (const viewModel of [
		{ status: "absent" },
		{ status: "error", error: { message: "invalid" } },
	]) {
		const { host, view } = fixture();
		let calls = 0;
		view.setCursorSelectionHandler(() => {
			calls += 1;
		});
		view.render(viewModel);
		assert.equal(hitTarget(host), null);
		assert.equal(calls, 0);
	}
});
