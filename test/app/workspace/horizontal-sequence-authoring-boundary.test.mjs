import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const source=fs.readFileSync(new URL("../../../app/controllers/alignmentCreationController.js",import.meta.url),"utf8");
test("UI orchestration has no geometric defaults and routes the explicitly declared transition-arc atomically",()=>{for(const forbidden of [/length:\s*100/,/transitionLength:\s*60/,/curvature:\s*0\.002/,/transitionType:\s*["']clothoid/])assert.doesNotMatch(source,forbidden);assert.match(source,/addStraightToActiveAlignment\(qualified\.args\)/);assert.match(source,/addArcToActiveAlignment\(qualified\.args\)/);assert.match(source,/addTransitionArcToActiveAlignment\(qualified\.args\)/);});
test("canonical change path retains exact horizontal selection and productive refresh",()=>{assert.match(source,/elementDiscipline: "horizontal"/);assert.match(source,/dispatchProductiveAlignmentChange/);assert.match(source,/refreshProductiveViews/);assert.match(source,/if \(!button \|\| busy\) return/);assert.match(source,/creationOperation = "pending"/);});
test("a failed dependent projection cannot relabel an already persisted geometry change as rejected",()=>{assert.match(source,/Geometrie gespeichert · Folgeansicht noch nicht aktualisiert/);assert.match(source,/status\.dataset\.kind = "warn"/);});
test("guided creation releases the shared authoring rail before returning",()=>{assert.match(source,/Guided creation calls this method directly/);assert.match(source,/busy = false/);assert.match(source,/delete root\.dataset\.creationOperation/);});
