import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { createImportSessionService } from "../../src/shared/messaging/service/ImportSessionService.js";

test("Import.GetState summary keeps terminal status small without traversing evidence or item payloads", () => {
	const items = Array.from({ length: 422 }, (_, index) => ({
		id: `I${index + 1}`,
		kind: "alignment",
		status: { valid: true, promotable: true, accepted: false },
	}));
	for (const item of items) {
		Object.defineProperty(item, "payload", {
			enumerable: true,
			get() { throw new Error("summary traversed item payload"); },
		});
	}
	const state = { sessionId: "large", phase: "ready", source: { fileName: "large.mdb" }, items, rejectedItems: [], error: null };
	Object.defineProperty(state, "resultEvidence", {
		enumerable: true,
		get() { throw new Error("summary traversed private evidence"); },
	});
	const service = createImportSessionService({ getState: () => state, setState() {} });

	const summary = service.getState({ projection: "summary" });
	assert.equal(summary.sessionId, "large");
	assert.equal(summary.phase, "ready");
	assert.equal(summary.stats.accepted, 422);
	assert.equal(summary.stats.promotable, 422);
	assert.equal(Object.hasOwn(summary, "items"), false);
	assert.equal(Object.hasOwn(summary, "rejectedItems"), false);
	assert.ok(JSON.stringify(summary).length < 10_000);
});

test("terminal import refresh requests the summary projection", async () => {
	const source = await fs.readFile(new URL("../../app/controllers/importController.js", import.meta.url), "utf8");
	assert.match(source, /sendImportCommand\("Import\.GetState", \{ projection: "summary" \}, 12000\)/);
});
