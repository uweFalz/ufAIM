import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentChangeProfileRefreshBridgeError, createAlignmentChangeProfileRefreshBridge } from "../../../app/controllers/alignment-profile/createAlignmentChangeProfileRefreshBridge.js";

class WindowTarget extends EventTarget {
	dispatchChange(detail) {
		const event = new Event("ufaim:alignment-changed");
		Object.defineProperty(event, "detail", { value: detail });
		this.dispatchEvent(event);
	}
}

const projected = (revision = 2, s = 25) => ({ status: "projected", alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s } });

test("exact verified change registers one profile refresh through waitUntil", async () => {
	const windowRef = new WindowTarget(); let refreshes = 0, waited = null;
	const bridge = createAlignmentChangeProfileRefreshBridge({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 25 } }) },
		profileSource: { async refresh() { refreshes += 1; return projected(); } }, windowRef,
	});
	assert.equal(bridge.start(), true); assert.equal(bridge.start(), false);
	windowRef.dispatchChange({ objectId: "A1", revision: 2, waitUntil(value) { assert.equal(waited, null); waited = value; } });
	assert.ok(waited instanceof Promise);
	assert.strictEqual(await waited, await waited);
	assert.equal((await waited).revision, 2);
	assert.equal(refreshes, 1);
	assert.equal(bridge.stop(), true); assert.equal(bridge.stop(), false);
});

test("foreign identity and missing revision fail closed before refresh", async () => {
	let refreshes = 0;
	const bridge = createAlignmentChangeProfileRefreshBridge({
		store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 25 } }) },
		profileSource: { async refresh() { refreshes += 1; return projected(); } }, windowRef: new WindowTarget(),
	});
	for (const [detail, code] of [
		[{ objectId: "B", revision: 2, waitUntil() {} }, "CHANGE_ALIGNMENT_MISMATCH"],
		[{ objectId: "A1", waitUntil() {} }, "CHANGE_REVISION_REQUIRED"],
		[{ objectId: "A1", revision: 2 }, "CHANGE_WAIT_UNAVAILABLE"],
	]) assert.throws(() => bridge.refreshForChange({ detail }), (error) => error instanceof AlignmentChangeProfileRefreshBridgeError && error.code === code);
	assert.equal(refreshes, 0);
});

test("revision cursor and post-refresh selection mismatches reject the registered wait", async () => {
	for (const fixture of [
		{ result: projected(3), code: "PROFILE_REFRESH_READBACK_MISMATCH" },
		{ result: projected(2, 30), code: "PROFILE_REFRESH_READBACK_MISMATCH" },
	]) {
		let waited;
		const bridge = createAlignmentChangeProfileRefreshBridge({ store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 25 } }) }, profileSource: { async refresh() { return fixture.result; } }, windowRef: new WindowTarget() });
		const operation = bridge.refreshForChange({ detail: { objectId: "A1", revision: 2, waitUntil(value) { waited = value; } } });
		assert.strictEqual(waited, operation);
		await assert.rejects(() => operation, (error) => error.code === fixture.code);
	}
	let active = "A1", waited;
	const bridge = createAlignmentChangeProfileRefreshBridge({ store: { getState: () => ({ workspace_selection: { primaryId: active }, cursor: { s: 25 } }) }, profileSource: { async refresh() { active = "B"; return projected(); } }, windowRef: new WindowTarget() });
	const operation = bridge.refreshForChange({ detail: { objectId: "A1", revision: 2, waitUntil(value) { waited = value; } } });
	assert.strictEqual(waited, operation);
	await assert.rejects(() => operation, (error) => error.code === "ACTIVE_CONTEXT_CHANGED");
});

test("invalid construction is rejected and stopped bridge no longer participates", async () => {
	assert.throws(() => createAlignmentChangeProfileRefreshBridge(), { code: "INVALID_BRIDGE" });
	const windowRef = new WindowTarget(); let refreshes = 0, waited = false;
	const bridge = createAlignmentChangeProfileRefreshBridge({ store: { getState: () => ({ workspace_selection: { primaryId: "A1" }, cursor: { s: 25 } }) }, profileSource: { async refresh() { refreshes += 1; return projected(); } }, windowRef });
	bridge.start(); bridge.stop();
	windowRef.dispatchChange({ objectId: "A1", revision: 2, waitUntil() { waited = true; } });
	await Promise.resolve();
	assert.equal(waited, false); assert.equal(refreshes, 0);
});
