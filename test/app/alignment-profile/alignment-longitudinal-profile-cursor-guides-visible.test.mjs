import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewUrl = new URL(
	"../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js",
	import.meta.url
);

test("cursor guides are accessible and preserve accepted visible contracts", async () => {
	const source = await readFile(viewUrl, "utf8");
	assert.match(source, /longitudinalCursorVerticalGuide/);
	assert.match(source, /longitudinalCursorHorizontalGuide/);
	assert.match(source, /Shared intrinsic-s cursor guide at/);
	assert.match(source, /Shared elevation cursor guide at/);
	for (const contract of [
		"longitudinalProfilePath",
		"longitudinalCursorHitTarget",
		"longitudinalCursor",
		"longitudinalElementActive",
		"longitudinalElementInspector",
		"longitudinalHorizontalAxis",
		"longitudinalVerticalAxis",
		"longitudinalBoundaryLabel",
	]) assert.match(source, new RegExp(contract));
});

test("guides remain projected read-only evidence without inferred semantics", async () => {
	const source = await readFile(viewUrl, "utf8");
	assert.doesNotMatch(source, /^import |store|repository|aim-core|saveProfileState|Spot\.|Worker|messaging/m);
	assert.doesNotMatch(source, /Math\.round|toFixed|snap|kilomet|chainage|stationing|unitConvert/i);
	assert.match(source, /const cursorX = x\(viewModel\.cursor\.s\)/);
	assert.match(source, /const cursorY = y\(viewModel\.cursor\.elevation\)/);
});
