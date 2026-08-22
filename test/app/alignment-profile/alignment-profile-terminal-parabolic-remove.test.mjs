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
		id: "V2", type: "parabolic", startS: 50, endS: 120,
		startElevation: 10.5, startGradient: 0.01, gradientRate: 0.0004,
		unknownExtension: "preserved",
	});
}

function projection({ revision, s, vertical }) {
	let result;
	try { result = evaluateVerticalAt(vertical, { s }); } catch { result = null; }
	return {
		status: "projected", alignmentId: "A1", revision,
		cursor: { parameterKind: "intrinsic-s", s },
		vertical: result ? { status: "evaluated", value: result } : { status: "not-covered" },
		chainage: { status: "absent" }, cant: { status: "absent" },
	};
}

test("removes only terminal V2 and preserves canonical V1 plus profile siblings", async () => {
	const originalVertical = verticalProfile();
	const mappings = [];
	const original = { vertical: originalVertical, cant: null, chainageMappings: mappings };
	let persisted = original;
	const saves = [];
	const controller = createBasicVerticalProfileAuthoringController({
		alignmentProfileApplicationService: {
			async saveProfileState({ alignmentId, profileState }) {
				saves.push({ alignmentId, profileState }); persisted = profileState;
				return { presence: "present", revision: 10, ...profileState };
			},
		},
		projectionController: {
			async projectAt({ revision, s }) { return projection({ revision, s, vertical: persisted.vertical }); },
		},
	});

	const result = await controller.removeTerminalParabolicElement({
		alignmentId: " A1 ", revision: 9, s: 75, profileState: original, elementId: " V2 ",
	});
	assert.equal(saves.length, 1);
	assert.equal(result.status, "removed");
	assert.equal(result.elementId, "V2");
	assert.deepEqual(result.profileState.vertical.elements, [originalVertical.elements[0]]);
	assert.strictEqual(result.profileState.cant, original.cant);
	assert.strictEqual(result.profileState.chainageMappings, mappings);
	assert.deepEqual(evaluateVerticalAt(result.profileState.vertical, { s: 25 }), {
		elementId: "V1", s: 25, elevation: 10.25, gradient: 0.01,
	});
	assert.equal(result.projection.vertical.status, "not-covered");
	assert.equal(Object.isFrozen(result), true);
});

test("missing wrong-type non-terminal sole-element and stale removal are zero-write", async () => {
	const profileState = { vertical: verticalProfile(), cant: null, chainageMappings: [] };
	let saves = 0;
	const controller = createBasicVerticalProfileAuthoringController({
		alignmentProfileApplicationService: { async saveProfileState() { saves += 1; } },
		projectionController: {
			async projectAt({ revision, s }) {
				if (revision === 8) throw Object.assign(new Error("stale"), { code: "STALE_REVISION" });
				return projection({ revision, s, vertical: profileState.vertical });
			},
		},
	});
	const attempt = (overrides) => controller.removeTerminalParabolicElement({
		alignmentId: "A1", revision: 9, s: 75, profileState, elementId: "V2", ...overrides,
	});
	for (const [overrides, code] of [
		[{ elementId: "missing" }, "VERTICAL_PROFILE_ELEMENT_NOT_FOUND"],
		[{ elementId: "V1" }, "VERTICAL_PROFILE_ELEMENT_NOT_PARABOLIC"],
		[{ revision: 8 }, "STALE_REVISION"],
	]) {
		await assert.rejects(attempt(overrides), (error) =>
			(error instanceof BasicVerticalProfileAuthoringError || error.code === "STALE_REVISION") &&
			error.code === code);
	}
	const nonTerminal = {
		...profileState,
		vertical: Object.freeze({ ...profileState.vertical, elements: Object.freeze([
			Object.freeze({ id: "P1", type: "parabolic", startS: 0, endS: 50,
				startElevation: 10, startGradient: 0.01, gradientRate: 0 }),
			profileState.vertical.elements[1],
		]) }),
	};
	await assert.rejects(attempt({ profileState: nonTerminal, elementId: "P1" }),
		(error) => error.code === "VERTICAL_PROFILE_ELEMENT_NOT_TERMINAL");
	const sole = { ...profileState, vertical: Object.freeze({ ...profileState.vertical,
		elements: Object.freeze([profileState.vertical.elements[1]]) }) };
	await assert.rejects(attempt({ profileState: sole }),
		(error) => error.code === "VERTICAL_PROFILE_REMOVE_REQUIRES_PREDECESSOR");
	assert.equal(saves, 0);
});

test("save and readback failures never report removal", async () => {
	const profileState = { vertical: verticalProfile(), cant: null, chainageMappings: [] };
	const make = (saveProfileState) => createBasicVerticalProfileAuthoringController({
		alignmentProfileApplicationService: { saveProfileState },
		projectionController: { async projectAt({ revision, s }) {
			return projection({ revision, s, vertical: profileState.vertical });
		} },
	});
	const input = { alignmentId: "A1", revision: 9, s: 75, profileState, elementId: "V2" };
	await assert.rejects(make(async () => { throw new Error("storage"); })
		.removeTerminalParabolicElement(input), (error) => error.code === "VERTICAL_PROFILE_SAVE_FAILED");
	await assert.rejects(make(async () => ({ presence: "present", revision: 10, ...profileState }))
		.removeTerminalParabolicElement(input), (error) => error.code === "PROFILE_READBACK_MISMATCH");
});
