import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createPromotedAlignmentWorkspaceJourneyController } from "../../../app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js";

const projection = (overrides = {}) => ({ status: "projected", alignmentId: "A1", revision: { id: "R2" }, cursor: { parameterKind: "intrinsic-s", s: 40 }, vertical: { status: "absent" }, cant: { status: "absent" }, chainage: { status: "absent" }, ...overrides });

function fixture({ profileSource, revision = { id: "R2" } } = {}) {
	const state = { workspace_selection: { primaryId: null }, cursor: { s: 40 } };
	const controller = createPromotedAlignmentWorkspaceJourneyController({
		cockpit: {
			async activateSpotObject(id) { state.workspace_selection.primaryId = id; return true; },
			async refreshSpotState() { return { objects: [{ id: "A1", type: "alignment", data: { alignmentData: { id: "A1", revision } } }] }; },
			async refreshAll() {},
		},
		store: { getState: () => state },
		alignmentBimWorkspace: { activate() { return true; } },
		viewController: { getDebugState: () => ({ objectId: "A1", mode: "active" }) },
		profileSource,
	});
	return { controller, state };
}

test("canonical reopen resolves only after exact synchronized profile readback", async () => {
	let release, completed = false;
	const gate = new Promise((resolve) => { release = resolve; });
	const { controller } = fixture({ profileSource: { async refresh() { await gate; completed = true; return projection(); } } });
	let settled = false;
	const pending = controller.activateCanonicalAlignment("A1").then((value) => { settled = true; return value; });
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(settled, false);
	release();
	const result = await pending;
	assert.equal(completed, true);
	assert.equal(result.ok, true);
	assert.equal(result.objectId, "A1");
	assert.deepEqual(result.profileProjection, projection());
});

test("missing port or canonical revision fails closed", async () => {
	assert.equal((await fixture({ profileSource: null }).controller.activateCanonicalAlignment("A1")).code, "PROMOTED_ALIGNMENT_PROFILE_REFRESH_UNAVAILABLE");
	assert.equal((await fixture({ profileSource: { async refresh() { return projection(); } }, revision: null }).controller.activateCanonicalAlignment("A1")).code, "PROMOTED_ALIGNMENT_CANONICAL_REVISION_UNAVAILABLE");
});

test("context switch, refresh failure, and every malformed readback fail closed", async () => {
	const switched = fixture({ profileSource: null });
	switched.controller = createPromotedAlignmentWorkspaceJourneyController({
		cockpit: { async activateSpotObject(id) { switched.state.workspace_selection.primaryId = id; return true; }, async refreshSpotState() { return { objects: [{ id: "A1", data: { alignmentData: { revision: { id: "R2" } } } }] }; }, async refreshAll() {} },
		store: { getState: () => switched.state }, alignmentBimWorkspace: { activate() { return true; } }, viewController: { getDebugState: () => ({}) },
		profileSource: { async refresh() { switched.state.cursor.s = 41; return projection(); } },
	});
	assert.equal((await switched.controller.activateCanonicalAlignment("A1")).code, "PROMOTED_ALIGNMENT_ACTIVE_CONTEXT_CHANGED");
	assert.equal((await fixture({ profileSource: { async refresh() { throw new Error("failed"); } } }).controller.activateCanonicalAlignment("A1")).code, "PROMOTED_ALIGNMENT_PROFILE_REFRESH_FAILED");
	for (const malformed of [
		projection({ status: "error" }), projection({ alignmentId: "B" }), projection({ revision: { id: "R1" } }),
		projection({ cursor: { parameterKind: "chainage", s: 40 } }), projection({ cursor: { parameterKind: "intrinsic-s", s: 41 } }),
		Object.fromEntries(Object.entries(projection()).filter(([key]) => key !== "cant")),
	]) {
		const result = await fixture({ profileSource: { async refresh() { return malformed; } } }).controller.activateCanonicalAlignment("A1");
		assert.equal(result.code, "PROMOTED_ALIGNMENT_PROFILE_READBACK_MISMATCH");
	}
});

test("runtime injects the existing profile port without claiming awaited horizontal rendering", () => {
	const journey = fs.readFileSync(new URL("../../../app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js", import.meta.url), "utf8");
	const init = fs.readFileSync(new URL("../../../app/runtime/init/initFeatures.js", import.meta.url), "utf8");
	assert.match(init, /profileSource: ctx\.alignmentProfileSynchronizedView/);
	assert.match(journey, /await profileSource\.refresh\(\)/);
	assert.doesNotMatch(journey, /profileProjection\.horizontal|viewController\.refresh/);
});
