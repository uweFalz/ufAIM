import assert from "node:assert/strict";
import test from "node:test";

import {
	appendVerticalElement,
	createVerticalConstructiveState,
	evaluateVerticalAt,
} from "../../../src/aim-core/alignment/profile/VerticalConstructiveState.js";
import {
	BasicVerticalProfileAuthoringError,
	createBasicVerticalProfileAuthoringController,
} from "../../../app/controllers/alignment-profile/createBasicVerticalProfileAuthoringController.js";

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

function projection({ revision, s, vertical }) {
	const last = vertical.elements.at(-1);
	const evaluated =
		last && s >= vertical.elements[0].startS && s <= last.endS
			? evaluateVerticalAt(vertical, { s })
			: null;
	return {
		status: "projected",
		alignmentId: "A1",
		revision,
		cursor: { parameterKind: "intrinsic-s", s },
		profileStatePresence: "present",
		vertical: evaluated
			? { status: "evaluated", ...evaluated }
			: { status: "not-covered" },
		chainage: { status: "absent" },
		cant: { status: "absent" },
	};
}

test("appends one canonical parabolic element from the persisted endpoint", async () => {
	const originalVertical = verticalProfile();
	const mappings = [];
	const original = {
		vertical: originalVertical,
		cant: null,
		chainageMappings: mappings,
	};
	const calls = [];
	let persisted = original;
	const service = {
		async saveProfileState({ alignmentId, profileState }) {
			calls.push({ alignmentId, profileState });
			persisted = profileState;
			return {
				presence: "present",
				alignmentId,
				revision: 2,
				...profileState,
			};
		},
	};
	const projectionController = {
		async projectAt({ revision, s }) {
			return projection({
				revision,
				s,
				vertical: persisted.vertical,
			});
		},
	};
	const controller =
		createBasicVerticalProfileAuthoringController({
			alignmentProfileApplicationService: service,
			projectionController,
		});

	const derived =
		controller.deriveParabolicGradientChangeStart({
			alignmentId: "A1",
			profileState: original,
		});
	assert.deepEqual(derived, {
		startS: 50,
		startElevation: 10.5,
		startGradient: 0.01,
		previousElementId: "V1",
	});

	const result = await controller.appendParabolicGradientChange({
		alignmentId: "A1",
		revision: 1,
		s: 75,
		profileState: original,
		elementId: "V2",
		endS: 100,
		gradientRate: 0.0002,
	});

	assert.equal(calls.length, 1);
	assert.equal(calls[0].profileState.vertical.elements.length, 2);
	assert.strictEqual(
		calls[0].profileState.vertical.elements[0],
		originalVertical.elements[0]
	);
	assert.strictEqual(calls[0].profileState.cant, original.cant);
	assert.strictEqual(
		calls[0].profileState.chainageMappings,
		mappings
	);
	assert.deepEqual(calls[0].profileState.vertical.elements[1], {
		id: "V2",
		type: "parabolic",
		startS: 50,
		endS: 100,
		startElevation: 10.5,
		startGradient: 0.01,
		gradientRate: 0.0002,
	});
	assert.equal(result.projection.vertical.elevation, 10.8125);
	assert.equal(result.projection.vertical.gradient, 0.015);
	assert.deepEqual(
		evaluateVerticalAt(result.profileState.vertical, { s: 100 }),
		{
			elementId: "V2",
			s: 100,
			elevation: 11.25,
			gradient: 0.02,
		}
	);
	assert.equal(result.projection.cant.status, "absent");
	assert.equal(result.projection.chainage.status, "absent");
});

test("rejects empty, invalid, stale and mismatched readback without false success", async () => {
	const original = {
		vertical: verticalProfile(),
		cant: null,
		chainageMappings: [],
	};
	let saves = 0;
	const controller =
		createBasicVerticalProfileAuthoringController({
			alignmentProfileApplicationService: {
				async saveProfileState({ profileState }) {
					saves += 1;
					return {
						presence: "present",
						revision: 2,
						vertical: profileState.vertical,
						cant: {},
						chainageMappings: [],
					};
				},
			},
			projectionController: {
				async projectAt({ alignmentId, revision, s }) {
					if (revision === 0) {
						throw Object.assign(new Error("stale"), {
							code: "STALE_REVISION",
						});
					}
					return projection({
						revision,
						s,
						vertical: original.vertical,
					});
				},
			},
		});

	assert.throws(
		() =>
			controller.deriveParabolicGradientChangeStart({
				alignmentId: "A1",
				profileState: {
					...original,
					vertical: createVerticalConstructiveState({
						id: "vertical:A1",
						alignmentId: "A1",
					}),
				},
			}),
		(error) =>
			error instanceof BasicVerticalProfileAuthoringError &&
			error.code === "INVALID_PARABOLIC_GRADIENT_CHANGE"
	);
	await assert.rejects(
		controller.appendParabolicGradientChange({
			alignmentId: "A1",
			revision: 1,
			s: 75,
			profileState: original,
			elementId: "V2",
			endS: 50,
			gradientRate: 0.0002,
		}),
		(error) =>
			error.code === "INVALID_PARABOLIC_GRADIENT_CHANGE"
	);
	await assert.rejects(
		controller.appendParabolicGradientChange({
			alignmentId: "A1",
			revision: 0,
			s: 75,
			profileState: original,
			elementId: "V2",
			endS: 100,
			gradientRate: 0.0002,
		}),
		(error) => error.code === "STALE_REVISION"
	);
	assert.equal(saves, 0);
	await assert.rejects(
		controller.appendParabolicGradientChange({
			alignmentId: "A1",
			revision: 1,
			s: 75,
			profileState: original,
			elementId: "V2",
			endS: 100,
			gradientRate: 0.0002,
		}),
		(error) => error.code === "PROFILE_READBACK_MISMATCH"
	);
	assert.equal(saves, 1);
});
