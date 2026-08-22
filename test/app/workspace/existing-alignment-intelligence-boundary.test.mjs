import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../../app/domain/workspace/buildExistingAlignmentIntelligenceModel.js", import.meta.url), "utf8");

test("Alignment Intelligence is pure App composition without engineering inference", () => {
	assert.doesNotMatch(source, /^import /m);
	assert.doesNotMatch(source, /parseFloat|toFixed|Math\.|EPSG|gauge|rail|platform|gradientRate|crossLevelRate/);
	assert.match(source, /constructive.*partial-evidence.*missing.*not-covered/);
});
