import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const files = ["../../../app/domain/workspace/buildAlignmentEngineeringHudModel.js", "../../../app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js", "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js"];
const source = (await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), "utf8")))).join("\n");

test("HUD is projection and presentation only, without engineering defaults or forbidden dependencies", () => {
	assert.doesNotMatch(source, /aim-core|parsers|TrackNetworkTopology|proj4|EPSG:\\d|defaultGauge|defaultSpeed|assume/i);
	assert.doesNotMatch(source, /Math\.|toFixed|parseFloat/);
	assert.match(source, /partial-evidence/); assert.match(source, /not-covered/); assert.match(source, /provenancePresent/);
});

test("HUD actions route only to supplied existing App actions", () => {
	assert.match(source, /this\.actions\.openObjects/); assert.match(source, /this\.actions\.openImport/); assert.match(source, /this\.actions\.openReview/);
	assert.doesNotMatch(source, /sendCmdAwait|fetch\(|save\(|promoteImport/);
});

test("HUD never claims reload-durable cursor state", () => {
	assert.doesNotMatch(source, /sessionStorage|localStorage|sourceEvidence.*cursor|cursor.*sourceEvidence/);
});
