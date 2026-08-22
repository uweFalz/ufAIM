import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("route workspace forbids heuristic grouping and domain relation claims", async () => {
	const source = await readFile(new URL("../../../app/domain/workspace/buildGndRouteWorkspaceModel.js", import.meta.url), "utf8");
	assert.doesNotMatch(source, /fileName|drop.?order|proximity|distance|topolog/i);
	assert.match(source, /route/);
	assert.match(source, /KM_LINE_REQUIRED/);
});

test("route package does not import parser Core Kernel or persistence authority", async () => {
	const source = await readFile(new URL("../../../app/domain/workspace/buildGndRouteWorkspaceModel.js", import.meta.url), "utf8");
	assert.doesNotMatch(source, /parseGND|knowledgeKernel|IndexedDb|SpotService|AIM.Core/i);
});
