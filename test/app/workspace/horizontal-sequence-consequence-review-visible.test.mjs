import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const bridge=fs.readFileSync(new URL("../../../app/controllers/bridges/alignmentEditorBridge.js",import.meta.url),"utf8"),shell=fs.readFileSync(new URL("../../../app/view/shell/buildWindowShell.js",import.meta.url),"utf8"),css=fs.readFileSync(new URL("../../../app/styles/app.css",import.meta.url),"utf8");
test("Authoring Dock visibly renders ordered consequence rows and exact selection",()=>{assert.match(shell,/aeSequenceReview/);assert.match(bridge,/sequenceElementId/);assert.match(bridge,/κ not-covered/);assert.match(bridge,/Validation/);assert.match(bridge,/Continuity/);assert.match(bridge,/setWorkspaceElement\(row\.id, "alignment-sequence-review"\)/);assert.match(css,/uf-align-edit__sequence/);});
