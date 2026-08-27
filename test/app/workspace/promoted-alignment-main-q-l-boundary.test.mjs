import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const journey = await readFile(new URL("../../../app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js", import.meta.url), "utf8");
const workbench = await readFile(new URL("../../../app/gndImportWorkbench/gndImportWorkbenchController.js", import.meta.url), "utf8");

test("promotion hands canonical identity to App orchestration without domain inference", () => {
	assert.match(workbench, /acceptImportItem\(itemId, \{ show: false \}\)/);
	assert.match(workbench, /acceptImportItem\(itemId, \{ show: true \}\)/);
	assert.match(workbench, /promotedAlignmentJourney\.activateCanonicalAlignment\(String\(promoted\.id\)\)/);
	assert.doesNotMatch(journey, /from\s+["'][^"']*(?:aim-core|parsers|repository|messaging)[^"']*["']/i);
	assert.doesNotMatch(journey, /(?:saveProfileState|saveById|dispatch\(|store\.set|store\.actions|Math\.|parseFloat|toFixed)/);
	assert.match(journey, /profileProjection\.state\?\.vertical/);
	assert.match(journey, /profileProjection\.state\?\.cant/);
	assert.match(journey, /profileProjection\.state\?\.chainageMappings/);
});

test("journey requires exact selected identity and finite existing cursor", () => {
	assert.match(journey, /activeId !== requestedId/);
	assert.match(journey, /Number\.isFinite\(s\)/);
	assert.match(journey, /activate\("main"\)/);
});
