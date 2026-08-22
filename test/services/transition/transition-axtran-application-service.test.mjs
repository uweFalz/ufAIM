import assert from "node:assert/strict";
import test from "node:test";

import { TransitionQuantityRole } from "../../../src/aim-core/transition/grammar/TransitionQuantityRoles.js";
import { TransitionAxtranApplicationService } from "../../../src/services/transition/TransitionAxtranApplicationService.js";
import { TransitionCatalogueAdapter } from "../../../src/services/transition/TransitionCatalogueAdapter.js";

function makeService() {
	return new TransitionAxtranApplicationService({
		catalogueAdapter: new TransitionCatalogueAdapter(),
	});
}

test("list and resolve retain deterministic canonical catalogue identities", () => {
	const service = makeService();
	const first = service.listTransitions();
	const second = service.listTransitions();
	const resolved = service.resolveTransition("bloss");

	assert.deepEqual(second, first);
	assert.ok(first.length > 0);
	assert.ok(first.every((entry) => entry?.id));
	assert.equal(resolved.record.id, "bloss");
	assert.equal(resolved.record.provenance.sourceFile, "src/domain/transition/transitionLookup.json");
	assert.strictEqual(
		resolved.record,
		service.catalogueAdapter.resolveVersionedTransitionRecord("bloss")
	);
	assert.strictEqual(
		resolved.descriptor,
		service.catalogueAdapter.resolveTransitionDescriptor("bloss")
	);
});

test("evaluation delegates unchanged quantity modes clamps and errors", () => {
	const service = makeService();
	const evaluated = service.evaluate({
		recordId: "bloss",
		quantity: TransitionQuantityRole.CURVATURE,
		at: {
			role: TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER,
			value: 2,
		},
	});
	assert.equal(evaluated.ok, true);
	assert.equal(evaluated.request.at.value, 1);
	assert.equal(evaluated.request.at.wasClampedToDomain, true);

	const unsupported = service.evaluate({
		recordId: "bloss",
		quantity: "unsupported",
		at: {
			role: TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER,
			value: 0.5,
		},
	});
	assert.deepEqual(unsupported.error, {
		code: "TRANSITION_QUANTITY_UNSUPPORTED",
		reason: "Unsupported quantity 'unsupported'",
		supported: [
			"curvature",
			"curvature-first-derivative",
			"curvature-second-derivative",
			"curvature-integral",
		],
	});
});

test("continuity evaluation and candidate validation remain Core results", () => {
	const service = makeService();
	const evaluated = service.evaluateContinuity({
		recordId: "bloss",
	});
	assert.equal(evaluated.ok, true);
	assert.equal(evaluated.recordId, "bloss");
	assert.ok(Array.isArray(evaluated.joins));

	const solved = service.solveContinuity({
		recordId: "bloss",
		problemId: "fixed-bloss",
		knownParameters: {},
		fixedParameters: [],
		freeParameters: [],
		constraints: [],
		requestedOutputQuantities: [TransitionQuantityRole.CURVATURE],
		provenance: { source: "test" },
	});
	assert.equal(solved.validation.ok, true);
	assert.equal(solved.candidate.authoritative, false);
	assert.equal(solved.candidate.reviewStatus, "unreviewed-calculation-candidate");
});

test("AXTRAN preparation remains solver-agnostic and preserves references", () => {
	const service = makeService();
	const components = [{ id: "enter" }];
	const constraints = [{ id: "c1" }];
	const out = service.prepareAxtranInput({
		recordId: "bloss",
		components,
		constraints,
	});

	assert.equal(out.transitionId, "bloss");
	assert.equal(out.status, "prepared-only");
	assert.strictEqual(out.orderedTransitionComponents, components);
	assert.strictEqual(out.constraints, constraints);
});

test("service requires the complete injected catalogue port", () => {
	assert.throws(
		() => new TransitionAxtranApplicationService({ catalogueAdapter: {} }),
		/catalogueAdapter\.listTransitionIds is required/
	);
});
