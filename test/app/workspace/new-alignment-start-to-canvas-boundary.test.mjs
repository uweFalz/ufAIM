import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read=p=>fs.readFileSync(new URL(`../../../${p}`,import.meta.url),"utf8");

test("guided creation delegates canonical save readback activation and existing authoring",()=>{const controller=read("app/gndImportWorkbench/gndImportWorkbenchController.js"),creation=read("app/controllers/alignmentCreationController.js"),init=read("app/runtime/init/initFeatures.js");assert.match(controller,/create\?\.\(\{ name: explicitName \}\)/);assert.match(controller,/refreshWorkspaceState/);assert.match(controller,/activateSpotObject/);assert.match(controller,/alignmentEditorBridge\?\.open/);assert.match(creation,/editor\.newAlignment\(\{ name: explicitName \}\)/);assert.match(init,/alignmentEditorBridge: ctx\.alignmentEditorBridge/);});
test("start orchestration contains no geometry or engineering defaults",()=>{const controller=read("app/gndImportWorkbench/gndImportWorkbenchController.js"),view=read("app/gndImportWorkbench/gndImportWorkbenchView.js");for(const forbidden of [/length:\s*100/,/curvature:\s*0\.002/,/EPSG:/,/speed/i,/gauge/i,/stationAddress/])assert.doesNotMatch(controller,forbidden);assert.match(view,/ohne erfundene Geometrie/);});
test("no productive create entrance supplies the translated default name",()=>{const creation=read("app/controllers/alignmentCreationController.js");assert.doesNotMatch(creation,/alignment_creation\.default_name/);assert.match(creation,/data-create-name/);assert.match(creation,/create\(\{ name: root\.querySelector\("\[data-create-name\]"\)/);});
