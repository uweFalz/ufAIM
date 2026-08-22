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
	let state = createVerticalConstructiveState({ id: "vertical:A1", alignmentId: "A1" });
	state = appendVerticalElement(state, {
		id: "V1", type: "constant-gradient", startS: 0, endS: 50,
		startElevation: 10, gradient: 0.01, provenance: { source: "authored" },
	});
	return appendVerticalElement(state, {
		id: "V2", type: "parabolic", startS: 50, endS: 100,
		startElevation: 10.5, startGradient: 0.01, gradientRate: 0.0004,
		unknownExtension: "preserved",
	});
}

function projection({ revision, s, vertical }) {
	return {
		status: "projected",
		alignmentId: "A1",
		revision,
		cursor: { parameterKind: "intrinsic-s", s },
		vertical: { status: "evaluated", value: evaluateVerticalAt(vertical, { s }) },
		chainage: { status: "absent" },
		cant: { status: "absent" },
	};
}

test("changes only terminal V2 endS and evaluates the extended canonical domain", async () => {
	const originalVertical = verticalProfile();
	const mappings = [];
	const original = { vertical: originalVertical, cant: null, chainageMappings: mappings };
	let persisted = original;
	const saves = [];
	const controller = createBasicVerticalProfileAuthoringController({
		alignmentProfileApplicationService: {
			async saveProfileState({ alignmentId, profileState }) {
				saves.push({ alignmentId, profileState });
				persisted = profileState;
				return { presence: "present", alignmentId, revision: 9, ...profileState };
			},
		},
		projectionController: {
			async projectAt({ revision, s }) {
				return projection({ revision, s, vertical: persisted.vertical });
			},
		},
	});

	const result = await controller.updateTerminalParabolicEndS({
		alignmentId: " A1 ", revision: 8, s: 75, profileState: original,
		elementId: " V2 ", endS: "120",
	});

	assert.equal(saves.length, 1);
	assert.deepEqual(result.profileState.vertical.elements[0], originalVertical.elements[0]);
	assert.deepEqual(result.profileState.vertical.elements[1], {
		...originalVertical.elements[1], endS: 120,
	});
	assert.strictEqual(result.profileState.cant, original.cant);
	assert.strictEqual(result.profileState.chainageMappings, mappings);
	assert.deepEqual(evaluateVerticalAt(result.profileState.vertical, { s: 120 }), {
		elementId: "V2", s: 120, elevation: 12.18, gradient: 0.038,
	});
	assert.deepEqual(evaluateVerticalAt(result.profileState.vertical, { s: 75 }), {
		elementId: "V2", s: 75, elevation: 10.875, gradient: 0.02,
	});
	assert.equal(result.snapshot.revision, 9);
	assert.equal(Object.isFrozen(result), true);
});

test("rejects invalid targets, invalid domain, no-op and stale context before writing", async () => {
	const profileState = { vertical: verticalProfile(), cant: null, chainageMappings: [] };
	let saves = 0;
	const controller = createBasicVerticalProfileAuthoringController({
		alignmentProfileApplicationService: { async saveProfileState() { saves += 1; } },
		projectionController: {
			async projectAt({ revision, s }) {
				if (revision === 7) throw Object.assign(new Error("stale"), { code: "STALE_REVISION" });
				return projection({ revision, s, vertical: profileState.vertical });
			},
		},
	});
	const attempt = (overrides) => controller.updateTerminalParabolicEndS({
		alignmentId: "A1", revision: 8, s: 75, profileState,
		elementId: "V2", endS: 120, ...overrides,
	});
	for (const [overrides, code] of [
		[{ elementId: "missing" }, "VERTICAL_PROFILE_ELEMENT_NOT_FOUND"],
		[{ elementId: "V1" }, "VERTICAL_PROFILE_ELEMENT_NOT_PARABOLIC"],
		[{ endS: 50 }, "INVALID_TERMINAL_PARABOLIC_DOMAIN_EDIT"],
		[{ endS: Number.NaN }, "INVALID_BASIC_VERTICAL_PROFILE"],
		[{ endS: 100 }, "VERTICAL_PROFILE_NO_CHANGE"],
		[{ revision: 7 }, "STALE_REVISION"],
	]) {
		await assert.rejects(attempt(overrides), (error) =>
			(error instanceof BasicVerticalProfileAuthoringError || error.code === "STALE_REVISION") &&
			error.code === code);
	}
	const nonTerminal = {
		...profileState,
		vertical: Object.freeze({
			...profileState.vertical,
			elements: Object.freeze([
				Object.freeze({ id: "P1", type: "parabolic", startS: 0, endS: 50,
					startElevation: 10, startGradient: 0.01, gradientRate: 0 }),
				profileState.vertical.elements[1],
			]),
		}),
	};
	await assert.rejects(attempt({ profileState: nonTerminal, elementId: "P1" }),
		(error) => error.code === "VERTICAL_PROFILE_ELEMENT_NOT_TERMINAL");
	assert.equal(saves, 0);
});

test("save or readback mismatch never reports success", async () => {
	const profileState = { vertical: verticalProfile(), cant: null, chainageMappings: [] };
	const makeController = (saveProfileState) => createBasicVerticalProfileAuthoringController({
		alignmentProfileApplicationService: { saveProfileState },
		projectionController: {
			async projectAt({ revision, s }) { return projection({ revision, s, vertical: profileState.vertical }); },
		},
	});
	await assert.rejects(
		makeController(async () => { throw new Error("storage"); }).updateTerminalParabolicEndS({
			alignmentId: "A1", revision: 8, s: 75, profileState, elementId: "V2", endS: 120,
		}), (error) => error.code === "VERTICAL_PROFILE_SAVE_FAILED");
	await assert.rejects(
		makeController(async () => ({ presence: "present", revision: 9, ...profileState })).updateTerminalParabolicEndS({
			alignmentId: "A1", revision: 8, s: 75, profileState, elementId: "V2", endS: 120,
		}), (error) => error.code === "PROFILE_READBACK_MISMATCH");
});
