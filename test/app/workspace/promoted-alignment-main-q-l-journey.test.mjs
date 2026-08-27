import assert from "node:assert/strict";
import test from "node:test";
import { createPromotedAlignmentWorkspaceJourneyController } from "../../../app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js";

test("canonical promoted Alignment becomes the one Main workspace context", async () => {
	const calls = [];
	const state = { workspace_selection: { primaryId: null }, cursor: { s: 0 } };
	const profileProjection = { status: "projected", alignmentId: "A1", revision: 2, cursor: { parameterKind: "intrinsic-s", s: 0 }, vertical: { status: "absent" }, cant: { status: "absent" }, chainage: { status: "absent" } };
	const controller = createPromotedAlignmentWorkspaceJourneyController({
		cockpit: { async activateSpotObject(id) { calls.push(["activate", id]); state.workspace_selection.primaryId = id; return true; }, async refreshSpotState() { return { objects: [{ id: "A1", data: { alignmentData: { id: "A1", revision: 2 } } }] }; }, async refreshAll() {} },
		store: { getState: () => state },
		alignmentBimWorkspace: { activate(mode) { calls.push(["mode", mode]); return true; } },
		viewController: { getDebugState: () => ({ mode: "active", objectId: "A1" }) },
		profileSource: { async refresh() { calls.push(["profile", "A1"]); return profileProjection; } },
	});

	assert.deepEqual(await controller.activateCanonicalAlignment("A1"), {
		ok: true,
		objectId: "A1",
		s: 0,
		projection: { mode: "active", objectId: "A1" },
		profileProjection,
	});
	assert.deepEqual(calls, [["activate", "A1"], ["mode", "main"], ["profile", "A1"]]);
});

test("identity mismatch cannot produce a false workspace handoff", async () => {
	const controller = createPromotedAlignmentWorkspaceJourneyController({
		cockpit: { async activateSpotObject() { return true; } },
		store: { getState: () => ({ workspace_selection: { primaryId: "OTHER" }, cursor: { s: 0 } }) },
		alignmentBimWorkspace: { activate() { assert.fail("Main must not open after identity mismatch"); } },
		viewController: { getDebugState: () => ({}) },
	});
	assert.deepEqual(await controller.activateCanonicalAlignment("A1"), {
		ok: false,
		code: "PROMOTED_ALIGNMENT_IDENTITY_MISMATCH",
	});
});
