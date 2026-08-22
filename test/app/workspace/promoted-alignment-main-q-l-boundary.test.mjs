import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const journey = await readFile(new URL("../../../app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js", import.meta.url), "utf8");
const workbench = await readFile(new URL("../../../app/gndImportWorkbench/gndImportWorkbenchController.js", import.meta.url), "utf8");

test("promotion hands canonical identity to App orchestration without domain inference", () => {
	assert.match(workbench, /acceptImportItem\(itemId, \{ show: false \}\)/);
	assert.match(workbench, /acceptImportItem\(itemId, \{ show: true \}\)/);
	assert.match(workbench, /promotedAlignmentJourney\.activateCanonicalAlignment\(String\(promoted\.id\)\)/);
	assert.doesNotMatch(journey, /aim-core|parsers|repository|messaging|gradient|cant|chainage|station/i);
	assert.doesNotMatch(journey, /Math\.|parseFloat|toFixed/);
});

test("journey requires exact selected identity and finite existing cursor", () => {
	assert.match(journey, /activeId !== requestedId/);
	assert.match(journey, /Number\.isFinite\(s\)/);
	assert.match(journey, /activate\("main"\)/);
});
