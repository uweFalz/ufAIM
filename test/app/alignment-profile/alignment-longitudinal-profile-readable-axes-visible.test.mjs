import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewUrl = new URL(
	"../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js",
	import.meta.url
);

test("readable axes preserve all accepted profile interaction and evidence contracts", async () => {
	const source = await readFile(viewUrl, "utf8");
	for (const contract of [
		"longitudinalProfilePath",
		"longitudinalCursorHitTarget",
		"longitudinalCursor",
		"longitudinalElementActive",
		"longitudinalElementInspector",
		"longitudinalElementDefinition",
		"longitudinalCursorEvidence",
	]) {
		assert.match(source, new RegExp(`dataset\\.${contract}`));
	}
	assert.match(source, /longitudinalHorizontalAxis/);
	assert.match(source, /longitudinalVerticalAxis/);
	assert.match(source, /longitudinalBoundaryLabel/);
});

test("view stays render-only and axis labels use direct String pass-through without station semantics", async () => {
	const source = await readFile(viewUrl, "utf8");
	assert.doesNotMatch(source, /^import |store|repository|aim-core|sendCmdAwait|saveProfileState|Spot\.|Worker|messaging/m);
	assert.doesNotMatch(source, /Math\.round|toFixed|snap|kilomet|chainage|stationing|unitConvert/i);
	assert.match(source, /text\.textContent = String\(textContent\)/);
	assert.match(source, /Object\.is\(value, boundary\)/);
	assert.match(source, /viewModel\.domain\.parameterKind === "intrinsic-s"/);
	assert.match(source, /"parameterKind" in \(viewModel\.domain \?\? \{\}\)/);
});
