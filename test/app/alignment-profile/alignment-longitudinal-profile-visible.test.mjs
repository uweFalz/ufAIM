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

function model() {
	return {
		status: "projected",
		alignmentId: "A1",
		revision: 7,
		domain: { parameterKind: "intrinsic-s", startS: 0, endS: 100 },
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
			s: 75,
			elevation: 10.8125,
			gradient: 0.015,
			elementId: "V2",
		},
	};
}

test("renders accessible SVG path boundaries and shared cursor evidence", () => {
	const { host, view } = fixture();
	view.render(model());
	const svg = host.find((entry) => entry.name === "svg");
	assert.ok(svg);
	assert.equal(svg.attributes.get("role"), "img");
	assert.match(svg.attributes.get("aria-label"), /s 0 to 100/);
	const path = host.find((entry) =>
		Object.prototype.hasOwnProperty.call(
			entry.dataset,
			"longitudinalProfilePath"
		)
	);
	assert.match(path.attributes.get("points"), /,/);
	const boundaries = [];
	function collect(node) {
		if (
			Object.prototype.hasOwnProperty.call(
				node.dataset,
				"longitudinalBoundary"
			)
		) boundaries.push(node.dataset.longitudinalBoundary);
		for (const child of node.children) collect(child);
	}
	collect(host);
	assert.deepEqual(boundaries, ["0", "50", "100"]);
	const cursor = host.find((entry) =>
		Object.prototype.hasOwnProperty.call(
			entry.dataset,
			"longitudinalCursor"
		)
	);
	assert.match(cursor.attributes.get("aria-label"), /10\.8125/);
	const evidence = host.find((entry) =>
		Object.prototype.hasOwnProperty.call(
			entry.dataset,
			"longitudinalCursorEvidence"
		)
	);
	assert.match(evidence.textContent, /s=75/);
	assert.match(evidence.textContent, /gradient=0\.015/);
});

test("renders honest empty state and has no write or renderer dependency", async () => {
	const { host, view } = fixture();
	view.render({ status: "absent" });
	assert.match(
		host.find((entry) =>
			Object.prototype.hasOwnProperty.call(
				entry.dataset,
				"longitudinalProfileEmpty"
			)
		).textContent,
		/No persisted vertical profile/
	);
	assert.equal(host.find((entry) => entry.name === "svg"), null);

	const [controller, viewSource] = await Promise.all([
		readFile(
			new URL(
				"../../../app/controllers/alignment-profile/createLongitudinalProfileController.js",
				import.meta.url
			),
			"utf8"
		),
		readFile(
			new URL(
				"../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js",
				import.meta.url
			),
			"utf8"
		),
	]);
	assert.doesNotMatch(
		controller,
		/saveProfileState|saveById|Spot\.|repository|aim-core|src\/|domain\//
	);
	assert.doesNotMatch(
		viewSource,
		/canvas|THREE|MapLibre|fetch\(|sendCmdAwait|saveProfileState/
	);
});
