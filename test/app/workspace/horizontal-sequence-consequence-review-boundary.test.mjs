import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const model=fs.readFileSync(new URL("../../../app/domain/workspace/buildHorizontalSequenceConsequenceReview.js",import.meta.url),"utf8"),bridge=fs.readFileSync(new URL("../../../app/controllers/bridges/alignmentEditorBridge.js",import.meta.url),"utf8");
test("review is read-only and introduces no continuity solver classification or repair",()=>{for(const forbidden of [/solve/i,/repair/i,/reorder/i,/removeElement/i,/nearest/i,/C[012]/,/derivative/i])assert.doesNotMatch(model,forbidden);assert.doesNotMatch(bridge,/sequenceReview[\s\S]{0,800}removeElement/);});
test("curvature and domains require exact existing sparse values",()=>{assert.match(model,/Number\.isFinite\(realized\?\.curvature\)/);assert.match(model,/Number\.isFinite\(realized\?\.sStart\)/);assert.match(model,/status: "not-covered"/);assert.doesNotMatch(model,/1\s*\/|evaluate|poseAt/);});
test("claims require compatible edit type and explicit provenanced finding",()=>{assert.match(model,/type === "straight" && realizedKind === "straight"/);assert.match(model,/type === "arc" && realizedKind === "arc"/);assert.match(model,/!provenancePresent \|\| !explicitResult/);});
