import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../../../app/view/shell/buildWindowShell.js", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("../../../app/controllers/bridges/alignmentEditorBridge.js", import.meta.url), "utf8");
const view = fs.readFileSync(new URL("../../../app/view/workspace/renderHorizontalRealizationChangeReceipt.js", import.meta.url), "utf8");
const model = fs.readFileSync(new URL("../../../app/domain/workspace/buildHorizontalRealizationChangeReceipt.js", import.meta.url), "utf8");

test("authoring surface exposes a live verified receipt separate from draft consequence", () => {
	assert.match(shell, /id="aeConsequence"/);
	assert.match(shell, /id="aeRealizationReceipt"/);
	assert.match(bridge, /beforeAlignmentData = activeSnapshot\?\.alignmentData/);
	assert.match(bridge, /buildHorizontalRealizationChangeReceipt/);
	assert.match(bridge, /verified receipt context changed/);
	assert.match(view, /Observed persisted realization changes/);
	assert.match(model, /AXTRAN diagnostics are not available/);
	assert.doesNotMatch(view, /applyCandidate|saveCandidate|canonical replacement/i);
});

test("visible receipt labels AXTRAN2 output as evidence-only and inadmissible", () => {
	assert.match(view, /data\.axtranEvidence|dataset\.axtranEvidence/);
	assert.match(view, /Admissible/);
	assert.match(model, /AXTRAN2 consequence evidence · evidence-only/);
	assert.match(model, /axtranEvidence\?\.admissible === false/);
});
