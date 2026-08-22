import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const source=fs.readFileSync(new URL("../../../app/controllers/alignmentCreationController.js",import.meta.url),"utf8"),css=fs.readFileSync(new URL("../../../app/styles/alignmentCreation.css",import.meta.url),"utf8");
test("visible form exposes explicit type length arc authority and catalogue family fields",()=>{for(const marker of ["data-add-type","data-add-length","data-add-arc-authority","data-add-signed-value","data-add-transition-family","data-add-w1","data-add-w2","data-transition-pair-hint","data-add-submit"])assert.match(source,new RegExp(marker));assert.match(source,/w1 und w2 gemeinsam oder beide leer/);assert.match(source,/Transition\.ListPresets/);assert.match(css,/data-add-signed-value/);});
test("one-click geometry buttons and numeric placeholders are absent",()=>{assert.doesNotMatch(source,/data-add="straight"|data-add="arc"|data-add="transition"/);assert.doesNotMatch(source,/value="(?:100|60|0\.002|clothoid)"/);});
