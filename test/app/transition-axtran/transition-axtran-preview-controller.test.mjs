import assert from "node:assert/strict";
import test from "node:test";

import { createTransitionAxtranPreviewController } from "../../../app/controllers/transition-axtran/createTransitionAxtranPreviewController.js";

function makeService({ failStage = null } = {}) {
	const calls = [];
	const invoke = (stage, input, output) => {
		calls.push([stage, input]);
		if (failStage === stage) throw new Error(`${stage} rejected`);
		return output;
	};
	return {
		calls,
		resolveTransition(recordId) {
			return invoke("resolve", recordId, {
				descriptor: { id: recordId, family: "polynomial" },
				record: { id: recordId, version: "transition/v1" },
			});
		},
		evaluate(input) {
			return invoke("evaluate", input, { ok: true, value: 0.25 });
		},
		evaluateContinuity(input) {
			return invoke("continuity", input, { ok: true, joins: [] });
		},
		solveContinuity(input) {
			return invoke("solve", input, {
				candidate: { id: "candidate-1", authoritative: false },
				validation: { ok: true, errors: [] },
			});
		},
		prepareAxtranInput(input) {
			return invoke("axtran", input, {
				contractVersion: "future-axtran-input/v1",
				status: "prepared-only",
			});
		},
	};
}

function request() {
	return {
		active: {
			alignmentId: "alignment-1",
			revision: 7,
			elementId: "transition-1",
		},
		selected: {
			recordId: "bloss",
			parameters: { length: 80 },
		},
		evaluation: { quantity: "curvature", at: { value: 0.5 } },
		continuityProblem: { problemId: "preview-1", constraints: [] },
		axtranInput: { constraints: [{ id: "c1" }] },
		provenance: { source: "selected-transition-editor-record" },
	};
}

test("creates a deterministic immutable unapplied projection", () => {
	const service = makeService();
	const controller = createTransitionAxtranPreviewController({
		transitionAxtranApplicationService: service,
	});
	const input = request();
	const before = structuredClone(input);
	const first = controller.createPreview(input);
	const second = controller.createPreview(input);

	assert.deepEqual(first, second);
	assert.deepEqual(input, before);
	assert.equal(first.status, "unapplied");
	assert.equal(first.active.alignmentId, "alignment-1");
	assert.equal(first.selected.recordId, "bloss");
	assert.equal(first.descriptor.id, "bloss");
	assert.equal(first.evaluation.value, 0.25);
	assert.equal(first.continuity.candidate.authoritative, false);
	assert.equal(first.continuity.validation.ok, true);
	assert.equal(first.axtranContract.status, "prepared-only");
	assert.deepEqual(first.provenance, {
		source: "selected-transition-editor-record",
	});
	assert.deepEqual(first.errors, []);
	assert.ok(Object.isFrozen(first));
	assert.ok(Object.isFrozen(first.active));
	assert.ok(Object.isFrozen(first.continuity));
	assert.ok(Object.isFrozen(first.axtranContract));
	assert.notStrictEqual(first.selected.parameters, input.selected.parameters);

	const firstPass = service.calls.slice(0, 5);
	assert.deepEqual(firstPass.map(([stage]) => stage), [
		"resolve",
		"evaluate",
		"continuity",
		"solve",
		"axtran",
	]);
	assert.strictEqual(firstPass[3][1].transitionRecord.id, "bloss");
	assert.deepEqual(firstPass[4][1].knownParameters, { length: 80 });
});

test("captures service failures without claiming an applied result", () => {
	const controller = createTransitionAxtranPreviewController({
		transitionAxtranApplicationService: makeService({ failStage: "solve" }),
	});
	const projection = controller.createPreview(request());

	assert.equal(projection.status, "unapplied");
	assert.equal(projection.continuity.candidate, null);
	assert.equal(projection.continuity.validation, null);
	assert.deepEqual(projection.errors, [{
		stage: "continuity-candidate",
		code: "TRANSITION_AXTRAN_PREVIEW_FAILED",
		name: "Error",
		message: "solve rejected",
	}]);
	assert.equal(projection.axtranContract.status, "prepared-only");
});

test("invalid active identity is deterministic and invokes no service", () => {
	const service = makeService();
	const controller = createTransitionAxtranPreviewController({
		transitionAxtranApplicationService: service,
	});
	const projection = controller.createPreview({
		active: { alignmentId: "", revision: null, elementId: "" },
		selected: { recordId: "bloss", parameters: {} },
	});

	assert.equal(projection.status, "unapplied");
	assert.deepEqual(projection.errors.map((error) => error.path), [
		"active.alignmentId",
		"active.revision",
		"active.elementId",
	]);
	assert.deepEqual(service.calls, []);
});

test("requires the complete injected application-service shape", () => {
	assert.throws(
		() => createTransitionAxtranPreviewController({
			transitionAxtranApplicationService: {},
		}),
		/transitionAxtranApplicationService\.resolveTransition is required/
	);
});
