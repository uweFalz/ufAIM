import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const paths = ["../../../app/domain/workspace/buildMainGeoreferenceQualificationModel.js", "../../../app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js", "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js", "../../../app/runtime/init/initFeatures.js"];
const [modelSource, controllerSource, viewSource, initSource] = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")));
const packageSource = [modelSource, controllerSource, viewSource].join("\n");

test("qualification journey contains no CRS inference transform math or persistence authority", () => {
	assert.doesNotMatch(packageSource, /proj4|makeDbRef|resolveGnd|Math\.|parseFloat|sessionStorage|localStorage|sendCmdAwait|Spot\.Save/);
	assert.doesNotMatch(packageSource, /filename|fileName|PSTRRIKZ|trackSide|proximity/i);
	assert.match(packageSource, /transformationAvailable/);
	assert.match(packageSource, /validationStatus/);
});

test("map action delegates only to the existing coordinated Main activation", () => {
	assert.match(initSource, /showOnMap: \(\) => ctx\.alignmentBimWorkspace\?\.activate\?\.\("main"\)/);
	assert.doesNotMatch([modelSource, controllerSource, viewSource].join("\n"), /setCursor|setMarker|transform\(/);
});

test("qualified claim requires validation EPSG and approved transform together", () => {
	assert.match(modelSource, /QUALIFIED\.has\(validationStatus\) && Boolean\(resolvedEpsg\) && transformationAvailable/);
	assert.match(modelSource, /Number\.isFinite\(activeCursor\?\.x\) && Number\.isFinite\(activeCursor\?\.y\)/);
	assert.match(modelSource, /markerReady: qualified && sampledCursorAvailable/);
	assert.match(modelSource, /String\(debugObjectId \?\? ""\)\.trim\(\) === objectId/);
	assert.match(modelSource, /exactDebugObject \? cursor : null/);
});
