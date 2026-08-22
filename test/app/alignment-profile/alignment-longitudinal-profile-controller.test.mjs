import assert from "node:assert/strict";
import test from "node:test";

import { createLongitudinalProfileController } from "../../../app/controllers/alignment-profile/createLongitudinalProfileController.js";

function profileState() {
	return {
		vertical: {
			alignmentId: "A1",
			elements: [
				{ id: "V1", startS: 0, endS: 50 },
				{ id: "V2", startS: 50, endS: 100 },
			],
		},
		cant: null,
		chainageMappings: [],
	};
}

function valueAt(s) {
	if (s <= 50) {
		return {
			elementId: "V1",
			elevation: 10 + 0.01 * s,
			gradient: 0.01,
		};
	}
	const u = s - 50;
	return {
		elementId: "V2",
		elevation: 10.5 + 0.01 * u + 0.0001 * u * u,
		gradient: 0.01 + 0.0002 * u,
	};
}

test("derives exact domain and deterministic samples including boundaries and cursor", async () => {
	const calls = [];
	const controller = createLongitudinalProfileController({
		alignmentProfileApplicationService: {
			async evaluateMany({ alignmentId, positions }) {
				calls.push({ alignmentId, positions });
				return {
					alignmentId,
					positions,
					results: positions.map((s) => ({
						s,
						vertical: {
							status: "evaluated",
							value: valueAt(s),
						},
					})),
				};
			},
		},
	});
	const result = await controller.project({
		alignmentId: "A1",
		revision: 7,
		s: 75,
		profileState: profileState(),
	});

	assert.equal(calls.length, 1);
	assert.deepEqual(result.domain, {
		parameterKind: "intrinsic-s",
		startS: 0,
		endS: 100,
	});
	assert.deepEqual(result.boundaries, [0, 50, 100]);
	assert.ok(calls[0].positions.includes(0));
	assert.ok(calls[0].positions.includes(50));
	assert.ok(calls[0].positions.includes(75));
	assert.ok(calls[0].positions.includes(100));
	assert.deepEqual(
		calls[0].positions,
		[...calls[0].positions].sort((left, right) => left - right)
	);
	assert.deepEqual(result.cursor, {
		status: "evaluated",
		s: 75,
		elevation: 10.8125,
		gradient: 0.015,
		elementId: "V2",
	});
	assert.equal(Object.isFrozen(result), true);
	assert.equal(Object.isFrozen(result.samples), true);
	assert.equal(Object.isFrozen(result.samples[0]), true);
});

test("reports absent malformed outside-domain and service errors truthfully", async () => {
	let calls = 0;
	const controller = createLongitudinalProfileController({
		alignmentProfileApplicationService: {
			async evaluateMany() {
				calls += 1;
				throw Object.assign(new Error("unavailable"), {
					code: "READ_FAILED",
				});
			},
		},
	});
	const absent = await controller.project({
		alignmentId: "A1",
		revision: 1,
		s: 0,
		profileState: { vertical: null },
	});
	assert.equal(absent.status, "absent");
	assert.equal(calls, 0);
	const malformed = await controller.project({
		alignmentId: "A1",
		revision: 1,
		s: 0,
		profileState: { vertical: { alignmentId: "A1", elements: [] } },
	});
	assert.equal(malformed.status, "error");
	assert.equal(malformed.error.code, "INVALID_VERTICAL_PROFILE");

	const evaluating = createLongitudinalProfileController({
		alignmentProfileApplicationService: {
			async evaluateMany({ alignmentId, positions }) {
				return {
					alignmentId,
					positions,
					results: positions.map((s) => ({
						s,
						vertical: {
							status: "evaluated",
							value: valueAt(s),
						},
					})),
				};
			},
		},
	});
	const outside = await evaluating.project({
		alignmentId: "A1",
		revision: 1,
		s: 125,
		profileState: profileState(),
	});
	assert.equal(outside.status, "projected");
	assert.deepEqual(outside.cursor, {
		status: "not-covered",
		s: 125,
	});
	const failed = await controller.project({
		alignmentId: "A1",
		revision: 1,
		s: 25,
		profileState: profileState(),
	});
	assert.equal(failed.status, "error");
	assert.equal(failed.error.code, "READ_FAILED");
});
