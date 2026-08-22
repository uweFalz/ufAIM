import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	wireAlignmentProfileSynchronizedView,
} from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

const ROOT = new URL("../../../", import.meta.url);

function makeStore() {
	return {
		getState() {
			return {
				workspace_selection: {
					primaryId: "alignment-A",
					elementId: "arc-A",
				},
				cursor: { s: 25 },
			};
		},
		subscribe() {
			return () => {};
		},
	};
}

class FakeElement {
	constructor(ownerDocument) {
		this.ownerDocument = ownerDocument;
		this.children = [];
		this.dataset = {};
		this.attributes = new Map();
		this.textContent = "";
	}

	append(...children) {
		this.children.push(...children);
	}

	replaceChildren(...children) {
		this.children = [...children];
	}

	setAttribute(name, value) {
		this.attributes.set(name, String(value));
	}

	querySelector(selector) {
		const name = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1];
		if (!name) return null;
		const key = name.replace(
			/-([a-z])/g,
			(_, letter) => letter.toUpperCase()
		);
		return this.find((entry) =>
			Object.prototype.hasOwnProperty.call(entry.dataset, key)
		);
	}

	find(predicate) {
		for (const child of this.children) {
			if (predicate(child)) return child;
			const nested = child.find?.(predicate);
			if (nested) return nested;
		}
		return null;
	}
}

class FakeDocument {
	constructor() {
		this.panel = new FakeElement(this);
	}

	getElementById(id) {
		return id === "cockpitPanel" ? this.panel : null;
	}

	createElement() {
		return new FakeElement(this);
	}
}

class RecordingView {
	constructor() {
		this.renders = [];
		this.statuses = [];
	}

	setBasicVerticalAuthoringHandler(handler) {
		this.handler = handler;
	}

	renderBasicVerticalAuthoringStatus(value) {
		this.statuses.push(value);
	}

	render(value) {
		this.renders.push(structuredClone(value));
	}
}

function projection({ revision = 1, vertical } = {}) {
	return {
		status: "projected",
		alignmentId: "alignment-A",
		revision,
		cursor: { parameterKind: "intrinsic-s", s: 25 },
		profileStatePresence: "present",
		vertical: vertical ?? { status: "absent" },
		chainage: { status: "absent", mappings: [] },
		cant: {
			status: "absent",
			reference: { status: "absent" },
		},
	};
}

test("visible authoring uses canonical active identity and renders verified shared-s result", async () => {
	const submissions = [];
	const documentRef = new FakeDocument();
	const wiring = wireAlignmentProfileSynchronizedView({
		store: makeStore(),
		messaging: {
			async sendCmdAwait(command) {
				assert.equal(command, "Spot.GetState");
				return {
					objects: [{
						id: "alignment-A",
						type: "alignment",
						data: {
							alignmentData: {
								id: "alignment-A",
								revision: 1,
							},
						},
					}],
				};
			},
		},
		projectionController: {
			async projectAt() {
				return projection();
			},
		},
		authoringController: {
			async submit(value) {
				submissions.push(structuredClone(value));
				return {
					projection: projection({
						revision: 2,
						vertical: {
							status: "evaluated",
							value: {
								elevation: 10.25,
								gradient: 0.01,
								elementId: "V1",
							},
						},
					}),
				};
			},
		},
		View: RecordingView,
		documentRef,
	});

	await wiring.refresh();
	const result = await wiring.submitBasicVerticalProfile({
		segmentId: "V1",
		startS: "0",
		endS: "100",
		startElevation: "10",
		gradient: "0.01",
	});
	assert.deepEqual(submissions, [{
		alignmentId: "alignment-A",
		revision: 1,
		s: 25,
		segmentId: "V1",
		startS: "0",
		endS: "100",
		startElevation: "10",
		gradient: "0.01",
	}]);
	assert.deepEqual(result.vertical.value, {
		elevation: 10.25,
		gradient: 0.01,
		elementId: "V1",
	});
	assert.equal(result.chainage.status, "absent");
	assert.equal(result.cant.status, "absent");
	assert.equal(wiring.getView, undefined);
	wiring.stop();
});

test("visible and dependency contracts expose explicit fields without another repository", async () => {
	const [controller, wiring, view, init] = await Promise.all([
		readFile(
			new URL(
				"app/controllers/alignment-profile/createBasicVerticalProfileAuthoringController.js",
				ROOT
			),
			"utf8"
		),
		readFile(
			new URL(
				"app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js",
				ROOT
			),
			"utf8"
		),
		readFile(
			new URL(
				"app/view/alignment-profile/AlignmentProfileSynchronizedView.js",
				ROOT
			),
			"utf8"
		),
		readFile(
			new URL("app/runtime/init/initFeatures.js", ROOT),
			"utf8"
		),
	]);
	assert.match(view, /Basic vertical profile/);
	for (const name of [
		"segmentId",
		"startS",
		"endS",
		"startElevation",
		"gradient",
	]) {
		assert.match(view, new RegExp(`["']${name}["']`));
	}
	assert.match(controller, /createVerticalConstructiveState/);
	assert.match(controller, /appendVerticalElement/);
	assert.match(controller, /cant:\s*null/);
	assert.match(controller, /chainageMappings:\s*\[\]/);
	assert.doesNotMatch(
		`${controller}\n${wiring}`,
		/Spot\.(?:AddObjects|RemoveObject)|saveById|IndexedDb|Topology|Transition|AXTRAN|CantConstructiveState|ChainageMapping/
	);
	assert.equal(
		(init.match(/new AlignmentApplicationService\(/g) ?? []).length,
		1
	);
	assert.equal(
		(init.match(/new AlignmentProfileApplicationService\(/g) ?? [])
			.length,
		1
	);
});
