import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const paths = ["../../../app/domain/workspace/buildQLokEngineeringViewModel.js", "../../../app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js", "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js"];
const [modelSource, controllerSource, viewSource] = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")));
const packageSource = [modelSource, viewSource].join("\n");

test("Lok view has no geometry solver safety speed braking visibility or persistence authority", () => {
	assert.doesNotMatch(modelSource, /aim-core|parser|proj4|transform\(|save\(|persist|sessionStorage|localStorage|brak|visibility|safety|speed limit|signal|topolog/i);
	assert.doesNotMatch([modelSource, controllerSource, viewSource].join("\n"), /setCursor|setWorkspaceSelection|sendCmdAwait/);
});

test("ahead is restricted to supplied boundaries and domain endpoints", async () => {
	const model = await readFile(new URL("../../../app/domain/workspace/buildQLokEngineeringViewModel.js", import.meta.url), "utf8");
	assert.match(model, /value\?\.boundaries/); assert.match(model, /value\?\.domain\?\.endS/); assert.match(model, /candidate\.s < next\.s/);
	assert.match(model, /profileProjection\?\.alignmentId/); assert.match(model, /profileProjection\?\.cursor\?\.parameterKind === "intrinsic-s"/); assert.match(model, /Object\.is\(profileProjection\?\.cursor\?\.s, s\)/);
	assert.doesNotMatch(model, /curvature.*ahead|gradient.*ahead|speed.*ahead|distance|lookahead/i);
});

test("q is explicitly local even when Main can be qualified", () => {
	assert.match(modelSource, /cameraMode: "local-engineering"/); assert.match(viewSource, /LOCAL engineering camera/);
});
