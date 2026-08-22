import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentLongitudinalProfileView } from "../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js";
import { wireAlignmentProfileSynchronizedView } from "../../../app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";

class FakeElement {
	constructor(documentRef, name) {
		this.ownerDocument = documentRef;
		this.name = name;
		this.children = [];
		this.dataset = {};
		this.attributes = new Map();
		this.textContent = "";
		this.value = "";
	}
	append(...children) { this.children.push(...children); }
	replaceChildren(...children) { this.children = children; }
	setAttribute(name, value) { this.attributes.set(name, String(value)); }
	getBoundingClientRect() { return { left: 0, width: 640 }; }
	querySelector() { return null; }
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
	return { host, view: new AlignmentLongitudinalProfileView({ host }) };
}

function model(definition) {
	return {
		status: "projected",
		domain: { parameterKind: "intrinsic-s", startS: 0, endS: 100 },
		boundaries: [0, 50, 100],
		elevationExtent: { min: 10, max: 11.5 },
		samples: [
			{ s: 0, elevation: 10, elementId: "V1" },
			{ s: 50, elevation: 10.5, elementId: "V2" },
			{ s: 75, elevation: 10.875, elementId: "V2" },
			{ s: 100, elevation: 11.5, elementId: "V2" },
		],
		cursor: {
			status: "evaluated",
			s: definition?.id === "V2" ? 75 : 25,
			elevation: definition?.id === "V2" ? 10.875 : 10.25,
			gradient: definition?.id === "V2" ? 0.02 : 0.01,
			elementId: definition?.id ?? null,
		},
		activeElementDefinition: definition,
	};
}

function evidence(host, key) {
	return host.find((entry) =>
		Object.prototype.hasOwnProperty.call(entry.dataset, key)
	);
}

test("renders an exact V2-only edit form and submits only explicit identity and input", async () => {
	const { host, view } = fixture();
	const submissions = [];
	view.setTerminalParabolicGradientRateHandler((value) => {
		submissions.push(value);
	});
	view.render(model({
		id: "V2",
		type: "parabolic",
		startS: 50,
		endS: 100,
		startElevation: 10.5,
		startGradient: 0.01,
		gradientRate: 0.0002,
	}));
	const form = evidence(host, "terminalParabolicGradientRateEdit");
	const input = evidence(host, "terminalParabolicGradientRateInput");
	assert.equal(form.dataset.terminalParabolicGradientRateEdit, "V2");
	assert.equal(input.value, "0.0002");
	input.value = "0.0004";
	let prevented = 0;
	form.onsubmit({ preventDefault() { prevented += 1; } });
	await Promise.resolve();
	assert.equal(prevented, 1);
	assert.deepEqual(submissions, [{ elementId: "V2", gradientRate: "0.0004" }]);
	view.renderTerminalParabolicEditStatus("saved");
	assert.equal(
		evidence(host, "terminalParabolicGradientRateStatus").textContent,
		"saved"
	);
	assert.equal(evidence(host, "longitudinalCursorCallout").textContent,
		"s 75 · elevation 10.875 · gradient 0.02");
});

test("does not expose the edit form for V1, unknown or non-finite definitions", () => {
	for (const definition of [
		{ id: "V1", type: "constant-gradient", gradient: 0.01 },
		null,
		{ id: "V2", type: "parabolic", gradientRate: Number.NaN },
	]) {
		const { host, view } = fixture();
		view.setTerminalParabolicGradientRateHandler(() => {});
		view.render(model(definition));
		assert.equal(evidence(host, "terminalParabolicGradientRateEdit"), null);
	}
});

test("wiring rereads canonical state and refreshes from the verified revision", async () => {
	const panel = new FakeElement(null, "panel");
	const documentRef = {
		createElement(name) { return new FakeElement(documentRef, name); },
		getElementById(id) { return id === "cockpitPanel" ? panel : null; },
	};
	panel.ownerDocument = documentRef;
	const oldProfile = { vertical: { alignmentId: "A1", elements: [] }, cant: null, chainageMappings: [] };
	const newProfile = { vertical: { alignmentId: "A1", elements: [{ id: "V2", gradientRate: 0.0004 }] }, cant: null, chainageMappings: [] };
	let canonical = { id: "A1", revision: 7, profileState: oldProfile };
	let reads = 0;
	const storeState = { workspace_selection: { primaryId: "A1" }, cursor: { s: 75 } };
	const statuses = [];
	const longitudinalInputs = [];
	let editHandler;
	class ProfileView {
		setBasicVerticalAuthoringHandler() {}
		setParabolicGradientChangeHandlers() {}
		render() {}
	}
	class LongitudinalView {
		setCursorSelectionHandler() {}
		setTerminalParabolicGradientRateHandler(handler) { editHandler = handler; }
		renderTerminalParabolicEditStatus(status) { statuses.push(status); }
		render() {}
	}
	const projection = (revision) => ({
		status: "projected",
		alignmentId: "A1",
		revision,
		cursor: { parameterKind: "intrinsic-s", s: 75 },
		profileStatePresence: "present",
		profileStatePresence: "present",
		vertical: { status: "evaluated" },
		chainage: { status: "absent" },
		cant: { status: "absent" },
	});
	const wiring = wireAlignmentProfileSynchronizedView({
		store: { getState: () => storeState, subscribe: () => () => {}, actions: { setCursorS() {} } },
		messaging: {
			async sendCmdAwait(command) {
				assert.equal(command, "Spot.GetState");
				reads += 1;
				return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: canonical } }] };
			},
		},
		projectionController: { async projectAt({ revision }) { return projection(revision); } },
		authoringController: {
			async submit() {},
			async updateTerminalParabolicGradientRate(input) {
				assert.strictEqual(input.profileState, oldProfile);
				assert.deepEqual(
					{ alignmentId: input.alignmentId, revision: input.revision, s: input.s, elementId: input.elementId },
					{ alignmentId: "A1", revision: 7, s: 75, elementId: "V2" }
				);
				canonical = { id: "A1", revision: 8, profileState: newProfile };
				return {
					status: "saved",
					profileState: newProfile,
					snapshot: { revision: 8 },
					projection: projection(8),
				};
			},
		},
		longitudinalController: {
			async project(input) { longitudinalInputs.push(input); return { status: "projected" }; },
		},
		View: ProfileView,
		LongitudinalView,
		documentRef,
	});
	await Promise.resolve();
	assert.equal(typeof editHandler, "function");
	const result = await editHandler({ elementId: "V2", gradientRate: "0.0004" });
	assert.ok(result, JSON.stringify(statuses));
	assert.equal(result.status, "saved");
	assert.ok(reads >= 2);
	assert.deepEqual(statuses.slice(-2), ["saving", "saved"]);
	assert.strictEqual(longitudinalInputs.at(-1).profileState, newProfile);
	assert.equal(longitudinalInputs.at(-1).revision, 8);
	wiring.stop();
});
