import assert from "node:assert/strict";
import test from "node:test";

import { createAlignmentChangeProfileRefreshBridge } from "../../../app/controllers/alignment-profile/createAlignmentChangeProfileRefreshBridge.js";

class WindowTarget extends EventTarget {}

async function dispatchProductiveChange(windowRef, change) {
	const pending = [];
	const event = new Event("ufaim:alignment-changed");
	Object.defineProperty(event, "detail", { value: { ...change, waitUntil(value) { pending.push(Promise.resolve(value)); } } });
	windowRef.dispatchEvent(event);
	await Promise.all(pending);
}

test("verified radius revision waits for same-cursor profile and dependent view refresh", async () => {
	const windowRef = new WindowTarget();
	const selection = { primaryId: "A1", elementId: "ARC1", elementDiscipline: "horizontal" };
	const state = { workspace_selection: selection, cursor: { s: 60 } };
	let canonical = { id: "A1", revision: 1, radius: 300 };
	let currentProjection = { status: "projected", alignmentId: "A1", revision: 1, cursor: { parameterKind: "intrinsic-s", s: 60 } };
	const subscriberRevisions = [];
	const profileSource = {
		async refresh() {
			currentProjection = { status: "projected", alignmentId: canonical.id, revision: canonical.revision, cursor: { parameterKind: "intrinsic-s", s: state.cursor.s }, vertical: { status: "evaluated" }, cant: { status: "evaluated" }, chainage: { status: "evaluated" } };
			subscriberRevisions.push(currentProjection.revision);
			return currentProjection;
		},
	};
	const bridge = createAlignmentChangeProfileRefreshBridge({ store: { getState: () => state }, profileSource, windowRef });
	bridge.start();

	// Productive radius authority has already saved and read back revision 2.
	canonical = { id: "A1", revision: 2, radius: 220 };
	await dispatchProductiveChange(windowRef, { objectId: "A1", elementId: "ARC1", revision: 2, source: "alignment-editor" });

	assert.equal(canonical.radius, 220);
	assert.equal(currentProjection.revision, 2);
	assert.equal(currentProjection.cursor.s, 60);
	assert.deepEqual(subscriberRevisions, [2]);
	assert.equal(currentProjection.vertical.status, "evaluated");
	assert.equal(currentProjection.cant.status, "evaluated");
	assert.equal(currentProjection.chainage.status, "evaluated");
	bridge.stop();
});

test("foreign Alignment radius change cannot refresh the active journey", async () => {
	const windowRef = new WindowTarget(); let refreshes = 0;
	const bridge = createAlignmentChangeProfileRefreshBridge({ store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 60 } }) }, profileSource: { async refresh() { refreshes += 1; return null; } }, windowRef });
	bridge.start();
	await dispatchProductiveChange(windowRef, { objectId: "B", elementId: "ARC9", revision: 8, source: "alignment-editor" });
	assert.equal(refreshes, 0);
	bridge.stop();
});
