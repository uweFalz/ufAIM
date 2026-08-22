import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
	appendVerticalElement,
	createVerticalConstructiveState,
} from "../../../src/aim-core/alignment/profile/VerticalConstructiveState.js";
import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

function verticalProfile() {
	return appendVerticalElement(
		createVerticalConstructiveState({
			id: "vertical:A1",
			alignmentId: "A1",
		}),
		{
			id: "V1",
			type: "constant-gradient",
			startS: 0,
			endS: 50,
			startElevation: 10,
			gradient: 0.01,
		}
	);
}

class FakeNode {
	constructor(documentRef) {
		this.ownerDocument = documentRef;
		this.dataset = {};
		this.children = [];
		this.textContent = "";
	}
	append(...children) {
		this.children.push(...children);
	}
	querySelector() {
		return null;
	}
	setAttribute() {}
	replaceChildren(...children) {
		this.children = children;
	}
}

function fixture() {
	const panel = new FakeNode(null);
	const documentRef = {
		createElement() {
			return new FakeNode(documentRef);
		},
		getElementById(id) {
			return id === "cockpitPanel" ? panel : null;
		},
	};
	panel.ownerDocument = documentRef;
	const storeState = {
		workspace_selection: { primaryId: "A1" },
		cursor: { s: 75 },
	};
	const store = {
		getState: () => storeState,
		subscribe: () => () => {},
	};
	const profileState = {
		vertical: verticalProfile(),
		cant: null,
		chainageMappings: [],
	};
	const messaging = {
		async sendCmdAwait(command) {
			assert.equal(command, "Spot.GetState");
			return {
				objects: [
					{
						id: "A1",
						type: "alignment",
						data: {
							alignmentData: {
								id: "A1",
								revision: 7,
								profileState,
							},
						},
					},
				],
			};
		},
	};
	return { documentRef, store, storeState, messaging, profileState };
}

test("visible wiring derives and appends from exact canonical active context", async () => {
	const { documentRef, store, messaging, profileState } = fixture();
	const calls = [];
	let handlers;
	class RecordingView {
		constructor() {}
		setBasicVerticalAuthoringHandler() {}
		setParabolicGradientChangeHandlers(value) {
			handlers = value;
		}
		render() {}
		renderParabolicGradientChangeStart(value) {
			calls.push(["derived-visible", value]);
		}
		renderParabolicGradientChangeStatus(value) {
			calls.push(["status", value]);
		}
	}
	const authoringController = {
		async submit() {},
		deriveParabolicGradientChangeStart(input) {
			calls.push(["derive", input]);
			return {
				startS: 50,
				startElevation: 10.5,
				startGradient: 0.01,
				previousElementId: "V1",
			};
		},
		async appendParabolicGradientChange(input) {
			calls.push(["append", input]);
			return {
				derivedStart: {
					startS: 50,
					startElevation: 10.5,
					startGradient: 0.01,
					previousElementId: "V1",
				},
				projection: {
					status: "projected",
					alignmentId: "A1",
					revision: 8,
					cursor: { parameterKind: "intrinsic-s", s: 75 },
					profileStatePresence: "present",
					vertical: {
						status: "evaluated",
						elevation: 10.8125,
						gradient: 0.015,
					},
					chainage: { status: "absent" },
					cant: { status: "absent" },
				},
			};
		},
	};
	const wiring = wireAlignmentProfileSynchronizedView({
		store,
		messaging,
		projectionController: {
			async projectAt() {
				return {
					status: "projected",
					alignmentId: "A1",
					revision: 7,
					cursor: { parameterKind: "intrinsic-s", s: 75 },
					profileStatePresence: "present",
					vertical: { status: "evaluated" },
					chainage: { status: "absent" },
					cant: { status: "absent" },
				};
			},
		},
		authoringController,
		View: RecordingView,
		documentRef,
	});

	await handlers.onPreview();
	await handlers.onAppend({
		elementId: "V2",
		endS: "100",
		gradientRate: "0.0002",
	});
	const derive = calls.find(([name]) => name === "derive")[1];
	assert.equal(derive.alignmentId, "A1");
	assert.strictEqual(derive.profileState, profileState);
	const append = calls.find(([name]) => name === "append")[1];
	assert.deepEqual(
		{
			alignmentId: append.alignmentId,
			revision: append.revision,
			s: append.s,
			elementId: append.elementId,
		},
		{
			alignmentId: "A1",
			revision: 7,
			s: 75,
			elementId: "V2",
		}
	);
	assert.strictEqual(append.profileState, profileState);
	assert.ok(
		calls.some(
			([name, value]) =>
				name === "status" && value === "saved"
		)
	);
	wiring.stop();
});

test("view exposes explicit parabolic inputs and remains render-only", async () => {
	const source = await readFile(
		new URL(
			"../../../app/view/alignment-profile/AlignmentProfileSynchronizedView.js",
			import.meta.url
		),
		"utf8"
	);
	assert.match(source, /Parabolic gradient change/);
	assert.match(source, /Derived canonical start conditions/);
	assert.match(source, /Gradient rate \[1\/m\]/);
	assert.doesNotMatch(
		source,
		/from ["'][^"']*(services|aim-core|model|shared|import)/
	);
	assert.doesNotMatch(
		source,
		/\b(fetch|sendCmdAwait|saveProfileState|repository|Spot\.)\b/
	);
});
