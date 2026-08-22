import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const source=fs.readFileSync(new URL("../../../app/controllers/alignmentCreationController.js",import.meta.url),"utf8");
test("UI orchestration contains no geometric defaults or transition-arc composite",()=>{for(const forbidden of [/length:\s*100/,/transitionLength:\s*60/,/curvature:\s*0\.002/,/transitionType:\s*["']clothoid/,/addTransitionArcToActiveAlignment/])assert.doesNotMatch(source,forbidden);assert.match(source,/addStraightToActiveAlignment\(qualified\.args\)/);assert.match(source,/addArcToActiveAlignment\(qualified\.args\)/);assert.match(source,/addTransitionToActiveAlignment\(qualified\.args\)/);});
test("canonical change path retains exact horizontal selection and productive refresh",()=>{assert.match(source,/elementDiscipline: "horizontal"/);assert.match(source,/dispatchProductiveAlignmentChange/);assert.match(source,/refreshProductiveViews/);assert.match(source,/if \(!button \|\| busy\) return/);assert.match(source,/creationOperation = "pending"/);});
