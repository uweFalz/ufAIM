import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (path) => fs.readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
test("session board contains no completion compliance mutation or persistence authority", () => { const source = read("app/domain/workspace/buildAlignmentDesignSessionBoardModel.js"); assert.doesNotMatch(source, /percent|complete\s*:|compliant|save|persist|dispatch|EPSG|PSTRRIKZ/i); for (const action of ["openHorizontal", "openVertical", "openCant", "openChainage", "openReview"]) assert.match(source, new RegExp(action)); });
test("integration uses current guarded projections and existing actions only", () => { const controller = read("app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js"), init = read("app/runtime/init/initFeatures.js"); assert.match(controller, /buildAlignmentDesignSessionBoardModel\(\{ intelligence: modelBase, horizontalSource: main, profileProjection, selection:/); for (const action of ["openHorizontal", "openVertical", "openCant", "openChainage", "openReview"]) assert.match(init, new RegExp(action)); });
