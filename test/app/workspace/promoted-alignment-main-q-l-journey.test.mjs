import assert from "node:assert/strict";
import test from "node:test";
import { createPromotedAlignmentWorkspaceJourneyController } from "../../../app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js";

test("canonical promoted Alignment becomes the one Main workspace context", async () => {
	const calls = [];
	const state = { workspace_selection: { primaryId: null }, cursor: { s: 0 } };
	const controller = createPromotedAlignmentWorkspaceJourneyController({
		cockpit: { async activateSpotObject(id) { calls.push(["activate", id]); state.workspace_selection.primaryId = id; return true; } },
		store: { getState: () => state },
		alignmentBimWorkspace: { activate(mode) { calls.push(["mode", mode]); return true; } },
		viewController: { getDebugState: () => ({ mode: "active", objectId: "A1" }) },
	});

	assert.deepEqual(await controller.activateCanonicalAlignment("A1"), {
		ok: true,
		objectId: "A1",
		s: 0,
		projection: { mode: "active", objectId: "A1" },
	});
	assert.deepEqual(calls, [["activate", "A1"], ["mode", "main"]]);
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
