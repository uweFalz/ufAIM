import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const builder = await readFile(new URL("../../../app/domain/workspace/buildPromotedGndWorkspaceEvidence.js", import.meta.url), "utf8");
const journey = await readFile(new URL("../../../app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js", import.meta.url), "utf8");
const evidence = await readFile(new URL("../../../src/import/evidence/importResultEvidence.js", import.meta.url), "utf8");

test("workspace handoff reads only persisted compact evidence without filename or relation inference", () => {
	assert.match(journey, /refreshSpotState/);
	assert.match(journey, /store\.subscribe/);
	assert.match(journey, /rehydrateCanonicalAlignment/);
	assert.match(journey, /buildPromotedGndWorkspaceEvidence/);
	assert.match(evidence, /relationEvidence/);
	assert.doesNotMatch(builder, /fileName.*(?:includes|match|test)|sourceIndex|gradient|crossLevel|radius/i);
	assert.doesNotMatch(journey, /parsers|aim-core|gradient|crossLevel|station/i);
});
