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

test("the editor asks the one question the length prior needs, and the receipt answers it", () => {
	// Decided A (docs/app/architecture/AXTRAN2_LENGTH_PRIOR_PROPOSAL.md): keep
	// the plan with σ 5 % as the default, samples only as the alternative; one
	// sentence in the result says which ran and which lengths were not
	// determined. The choice is read when the edit is applied, never stored.
	const de = fs.readFileSync(new URL("../../../app/i18n/strings.de.js", import.meta.url), "utf8");
	const en = fs.readFileSync(new URL("../../../app/i18n/strings.en.js", import.meta.url), "utf8");
	const service = fs.readFileSync(new URL("../../../src/services/alignment/AlignmentAxtranEvidenceService.js", import.meta.url), "utf8");
	assert.match(shell, /id="aeFitMode"/);
	assert.match(shell, /value="keep-plan"[^>]*data-i18n="alignment_editor\.fit_mode\.keep_plan"/);
	assert.match(shell, /value="measurements-only"[^>]*data-i18n="alignment_editor\.fit_mode\.measurements_only"/);
	for (const strings of [de, en]) {
		assert.match(strings, /"alignment_editor\.label\.fit_mode"/);
		assert.match(strings, /"alignment_editor\.fit_mode\.keep_plan": "[^"]*σ 5 %/);
		assert.match(strings, /"alignment_editor\.fit_mode\.measurements_only"/);
	}
	assert.match(bridge, /fitMode: document\.getElementById\("aeFitMode"\)/);
	assert.match(bridge, /fields\.fitMode\?\.value === "measurements-only" \? "measurements-only" : "keep-plan"/);
	assert.match(bridge, /evaluateChange\?\.\(\{ beforeAlignmentData, afterAlignmentData: result\.alignmentChange\?\.alignmentData, fitMode \}\)/);
	assert.doesNotMatch(bridge, /localStorage\.[gs]etItem\([^)]*fitMode/);
	assert.match(service, /DEFAULT_PLAN_SIGMA = 0\.05/);
	assert.match(service, /lengthPrior: \{ sigma: planSigma \}/);
	assert.match(model, /hielt den bearbeiteten Plan/);
	assert.match(model, /folgte nur den Proben/);
	assert.match(view, /dataset\.fitMode/);
	assert.match(view, /Undetermined lengths/);
});
