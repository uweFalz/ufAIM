import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const model = fs.readFileSync(new URL("../../../app/domain/workspace/buildHorizontalRealizationChangeReceipt.js", import.meta.url), "utf8");

test("receipt observes exact supplied fields and owns no geometry or AXTRAN calculation", () => {
	assert.match(model, /curvature/);
	assert.match(model, /sStart/);
	assert.match(model, /sEnd/);
	assert.match(model, /arcLength/);
	assert.match(model, /poseA/);
	assert.doesNotMatch(model, /AlignmentFactory|poseAt|evaluate|1\s*\/|Math\./);
	assert.match(model, /AXTRAN diagnostics are not available in the current result contract/);
});
