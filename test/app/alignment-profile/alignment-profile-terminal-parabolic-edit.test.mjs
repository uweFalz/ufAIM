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
	let state = createVerticalConstructiveState({
		id: "vertical:A1",
		alignmentId: "A1",
	});
	state = appendVerticalElement(state, {
		id: "V1",
		type: "constant-gradient",
		startS: 0,
		endS: 50,
		startElevation: 10,
		gradient: 0.01,
		provenance: { source: "authored" },
	});
	return appendVerticalElement(state, {
		id: "V2",
		type: "parabolic",
		startS: 50,
		endS: 100,
		startElevation: 10.5,
		startGradient: 0.01,
		gradientRate: 0.0002,
		unknownExtension: "preserved",
	});
}

function projection({ revision, s, vertical }) {
	const value = evaluateVerticalAt(vertical, { s });
	return {
		status: "projected",
		alignmentId: "A1",
		revision,
		cursor: { parameterKind: "intrinsic-s", s },
		vertical: { status: "evaluated", value },
		chainage: { status: "absent" },
		cant: { status: "absent" },
	};
}

test("rebuilds the exact profile and replaces only terminal V2 gradientRate", async () => {
	const originalVertical = verticalProfile();
	const cant = null;
	const mappings = [];
	const original = {
		vertical: originalVertical,
		cant,
		chainageMappings: mappings,
	};
	let persisted = original;
	const saves = [];
	const controller = createBasicVerticalProfileAuthoringController({
		alignmentProfileApplicationService: {
			async saveProfileState({ alignmentId, profileState }) {
				saves.push({ alignmentId, profileState });
				persisted = profileState;
				return {
					presence: "present",
					alignmentId,
					revision: 8,
					...profileState,
				};
			},
		},
		projectionController: {
			async projectAt({ revision, s }) {
				return projection({ revision, s, vertical: persisted.vertical });
			},
		},
	});

	const result = await controller.updateTerminalParabolicGradientRate({
		alignmentId: " A1 ",
		revision: 7,
		s: 75,
		profileState: original,
		elementId: " V2 ",
		gradientRate: "0.0004",
	});

	assert.equal(saves.length, 1);
	assert.equal(saves[0].alignmentId, "A1");
	assert.deepEqual(
		result.profileState.vertical.elements[0],
		originalVertical.elements[0]
	);
	assert.notStrictEqual(
		result.profileState.vertical.elements[0],
		originalVertical.elements[0]
	);
	assert.deepEqual(result.profileState.vertical.elements[1], {
		...originalVertical.elements[1],
		gradientRate: 0.0004,
	});
	assert.strictEqual(result.profileState.cant, cant);
	assert.strictEqual(result.profileState.chainageMappings, mappings);
	assert.deepEqual(evaluateVerticalAt(result.profileState.vertical, { s: 75 }), {
		elementId: "V2",
		s: 75,
		elevation: 10.875,
		gradient: 0.02,
	});
	assert.deepEqual(evaluateVerticalAt(result.profileState.vertical, { s: 100 }), {
		elementId: "V2",
		s: 100,
		elevation: 11.5,
		gradient: 0.03,
	});
	assert.equal(result.projection.revision, 8);
	assert.equal(Object.isFrozen(result), true);
});

test("rejects no-op, missing, non-parabolic, non-terminal and stale targets with zero writes", async () => {
	const profileState = {
		vertical: verticalProfile(),
		cant: null,
		chainageMappings: [],
	};
	let saves = 0;
	const controller = createBasicVerticalProfileAuthoringController({
		alignmentProfileApplicationService: {
			async saveProfileState() {
				saves += 1;
			},
		},
		projectionController: {
			async projectAt({ alignmentId, revision, s }) {
				if (revision === 6) {
					throw Object.assign(new Error("stale"), {
						code: "STALE_REVISION",
					});
				}
				return projection({
					revision,
					s,
					vertical: profileState.vertical,
				});
			},
		},
	});
	const attempt = (overrides) =>
		controller.updateTerminalParabolicGradientRate({
			alignmentId: "A1",
			revision: 7,
			s: 75,
			profileState,
			elementId: "V2",
			gradientRate: 0.0004,
			...overrides,
		});
	for (const [overrides, code] of [
		[{ gradientRate: 0.0002 }, "VERTICAL_PROFILE_NO_CHANGE"],
		[{ elementId: "missing" }, "VERTICAL_PROFILE_ELEMENT_NOT_FOUND"],
		[{ elementId: "V1" }, "VERTICAL_PROFILE_ELEMENT_NOT_PARABOLIC"],
		[{ revision: 6 }, "STALE_REVISION"],
	]) {
		await assert.rejects(
			attempt(overrides),
			(error) =>
				(error instanceof BasicVerticalProfileAuthoringError ||
					error.code === "STALE_REVISION") && error.code === code
		);
	}
	const withNonTerminalParabolic = {
		...profileState,
		vertical: Object.freeze({
			...profileState.vertical,
			elements: Object.freeze([
				Object.freeze({
					id: "P1",
					type: "parabolic",
					startS: 0,
					endS: 50,
					startElevation: 10,
					startGradient: 0.01,
					gradientRate: 0,
				}),
				profileState.vertical.elements[1],
			]),
		}),
	};
	await assert.rejects(
		attempt({
			profileState: withNonTerminalParabolic,
			elementId: "P1",
		}),
		(error) => error.code === "VERTICAL_PROFILE_ELEMENT_NOT_TERMINAL"
	);
	assert.equal(saves, 0);
});
