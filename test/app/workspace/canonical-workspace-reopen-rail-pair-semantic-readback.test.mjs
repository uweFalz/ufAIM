import assert from "node:assert/strict";
import test from "node:test";

import { createPromotedAlignmentWorkspaceJourneyController } from "../../../app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js";
import { createAlignmentProfileProjectionController } from "../../../app/controllers/alignment-profile/createAlignmentProfileProjectionController.js";
import { AlignmentProfileApplicationService } from "../../../src/services/alignment/AlignmentProfileApplicationService.js";
import { appendRailOffsetElement, createRailPairCantConstructiveState } from "../../../src/aim-core/alignment/profile/RailPairCantConstructiveState.js";

function railPairCant() {
	let cant = createRailPairCantConstructiveState({
		id: "RP1", alignmentId: "A1",
		coverage: { status: "complete", startS: 0, endS: 100, authority: "admitted-construction" },
		railPair: { leftRailId: "rail-L", rightRailId: "rail-R", separation: {
			kind: "horizontal-projection-between-governing-references", unit: "alignment-length-unit", value: 1.506,
			measurementDefinition: "governing-running-edges", provenance: { sourceId: "rule-47" },
		} },
		anchorRule: { id: "anchor-9", version: "2", kind: "left-reference", railId: "rail-L", provenance: { sourceId: "binding-4" } },
	});
	cant = appendRailOffsetElement(cant, { id: "L1", railId: "rail-L", type: "linear-rail-offset", startS: 0, endS: 100, startOffset: 0.02, offsetRate: 0.001 });
	return appendRailOffsetElement(cant, { id: "R1", railId: "rail-R", type: "constant-rail-offset", startS: 0, endS: 100, startOffset: -0.01 });
}

function fixture({ mutateProjectionState = (state) => state } = {}) {
	const stored = { id: "A1", type: "AlignmentData", revision: 7, profileState: { vertical: null, cant: railPairCant(), chainageMappings: [] } };
	const repository = { async loadById(id) { return id === "A1" ? structuredClone(stored) : null; }, async saveById() { throw new Error("read-only journey fixture"); } };
	const service = new AlignmentProfileApplicationService({ alignmentRepository: repository });
	const projectionController = createAlignmentProfileProjectionController({ alignmentProfileApplicationService: service });
	const state = { workspace_selection: { primaryId: null }, cursor: { s: 40 } };
	const profileSource = { async refresh() {
		const projected = await projectionController.projectAt({ alignmentId: "A1", revision: 7, s: 40 });
		return Object.freeze({ ...projected, state: mutateProjectionState(structuredClone(projected.state)) });
	} };
	const controller = createPromotedAlignmentWorkspaceJourneyController({
		cockpit: {
			async activateSpotObject(id) { state.workspace_selection.primaryId = id; return true; },
			async refreshSpotState() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: structuredClone(stored) } }] }; },
			async refreshAll() {},
		},
		store: { getState: () => state }, alignmentBimWorkspace: { activate() { return true; } },
		viewController: {
			getDebugState: () => ({ objectId: "A1", mode: "active" }),
			async refreshHorizontalProjection() { return { status: "rendered", objectId: "A1", revision: 7, cursor: { parameterKind: "intrinsic-s", s: 40 }, projectionSignature: "P7", mode: "active", selectedElementId: "ARC1" }; },
		},
		profileSource,
	});
	return { controller, stored };
}

test("canonical reopen accepts the exact persisted Rail-Pair state and derived same-cursor projection", async () => {
	const { controller, stored } = fixture();
	const result = await controller.activateCanonicalAlignment("A1");
	assert.equal(result.ok, true);
	assert.deepEqual(result.profileProjection.state.cant, stored.profileState.cant);
	assert.equal(result.profileProjection.cant.representation, "rail-pair");
	assert.equal(result.profileProjection.cant.left.railId, "rail-L");
	assert.equal(result.profileProjection.cant.right.railId, "rail-R");
	assert.equal(result.profileProjection.cursor.s, 40);
	assert.equal(result.horizontalProjection.cursor.s, 40);
});

test("canonical reopen rejects every Rail-Pair constructive semantic deviation", async () => {
	const mutations = [
		(state) => ({ ...state, cant: { ...state.cant, railPair: { ...state.cant.railPair, leftRailId: "other-L" } } }),
		(state) => ({ ...state, cant: { ...state.cant, railPair: { ...state.cant.railPair, separation: { ...state.cant.railPair.separation, value: 1.507 } } } }),
		(state) => ({ ...state, cant: { ...state.cant, anchorRule: { ...state.cant.anchorRule, version: "3" } } }),
		(state) => ({ ...state, cant: { ...state.cant, coverage: { ...state.cant.coverage, endS: 99 } } }),
		(state) => ({ ...state, cant: { ...state.cant, elements: state.cant.elements.map((element) => element.id === "L1" ? { ...element, startOffset: 0.03 } : element) } }),
	];
	for (const mutateProjectionState of mutations) {
		const result = await fixture({ mutateProjectionState }).controller.activateCanonicalAlignment("A1");
		assert.deepEqual(result, { ok: false, code: "PROMOTED_ALIGNMENT_PROFILE_STATE_READBACK_MISMATCH" });
	}
});
