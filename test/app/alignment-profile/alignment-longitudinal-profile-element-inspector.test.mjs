import assert from "node:assert/strict";
import test from "node:test";

import { createLongitudinalProfileController } from "../../../app/controllers/alignment-profile/createLongitudinalProfileController.js";

const V1 = {
	id: "V1",
	type: "constant-gradient",
	startS: 0,
	endS: 50,
	startElevation: 10,
	gradient: 0.01,
	provenance: { source: "authored" },
};
const V2 = {
	id: "V2",
	type: "parabolic",
	startS: 50,
	endS: 100,
	startElevation: 10.5,
	startGradient: 0.01,
	gradientRate: 0.0002,
	unknownExtension: "preserved",
};

function valueAt(s, boundaryElementId = "V1") {
	const elementId = s < 50 ? "V1" : s > 50 ? "V2" : boundaryElementId;
	if (elementId === "V1") {
		return { elementId, elevation: 10 + 0.01 * s, gradient: 0.01 };
	}
	const u = s - 50;
	return {
		elementId,
		elevation: 10.5 + 0.01 * u + 0.0001 * u * u,
		gradient: 0.01 + 0.0002 * u,
	};
}

function controller(boundaryElementId = "V1") {
	return createLongitudinalProfileController({
		alignmentProfileApplicationService: {
			async evaluateMany({ alignmentId, positions }) {
				return {
					alignmentId,
					positions,
					results: positions.map((s) => ({
						s,
						vertical: {
							status: "evaluated",
							value: valueAt(s, boundaryElementId),
						},
					})),
				};
			},
		},
	});
}

function profileState(elements = [V1, V2]) {
	return { vertical: { alignmentId: "A1", elements }, cant: null };
}

test("copies and freezes exact persisted V1 and V2 definitions without inference", async () => {
	const input = profileState();
	const v1 = await controller().project({
		alignmentId: "A1",
		revision: 7,
		s: 25,
		profileState: input,
	});
	assert.deepEqual(v1.activeElementDefinition, V1);
	assert.equal(Object.isFrozen(v1.activeElementDefinition), true);
	assert.notEqual(v1.activeElementDefinition, V1);
	assert.equal(v1.activeElementDefinition.provenance, V1.provenance);
	assert.equal("gradientRate" in v1.activeElementDefinition, false);

	const v2 = await controller().project({
		alignmentId: "A1",
		revision: 7,
		s: 75,
		profileState: input,
	});
	assert.deepEqual(v2.activeElementDefinition, V2);
	assert.equal("gradient" in v2.activeElementDefinition, false);
	assert.equal(v2.activeElementDefinition.unknownExtension, "preserved");
	assert.equal(Object.isFrozen(v2.elementDefinitions), true);
	assert.equal(JSON.stringify(input), JSON.stringify(profileState()));
});

test("uses evaluator identity at the shared boundary without a side convention", async () => {
	const result = await controller("V2").project({
		alignmentId: "A1",
		revision: 7,
		s: 50,
		profileState: profileState(),
	});
	assert.equal(result.cursor.elementId, "V2");
	assert.equal(result.activeElementDefinition.id, "V2");
});

test("missing duplicate and unknown evaluator identities expose no guessed record", async () => {
	for (const elements of [
		[{ ...V1, id: "other" }, V2],
		[V1, { ...V2, id: "V1" }],
	]) {
		const result = await controller().project({
			alignmentId: "A1",
			revision: 7,
			s: 25,
			profileState: profileState(elements),
		});
		assert.equal(result.activeElementDefinition, null);
	}
});

test("outside cursor has immutable definitions but no active record", async () => {
	const result = await controller().project({
		alignmentId: "A1",
		revision: 7,
		s: 125,
		profileState: profileState(),
	});
	assert.equal(result.cursor.status, "not-covered");
	assert.equal(result.activeElementDefinition, null);
	assert.equal(Object.isFrozen(result.elementDefinitions), true);
});
