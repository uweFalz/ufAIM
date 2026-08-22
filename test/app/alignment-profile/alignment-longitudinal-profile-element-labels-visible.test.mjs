import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewUrl = new URL(
	"../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js",
	import.meta.url
);

test("element labels expose stable visible and accessible identity contracts", async () => {
	const source = await readFile(viewUrl, "utf8");
	assert.match(source, /longitudinalElementLabel:/);
	assert.match(source, /longitudinalElementLabelActive:/);
	assert.match(source, /vertical element label/);
	assert.match(source, /group\.samples\[0\]/);
	assert.match(source, /Object\.is\(group\.elementId, cursorElementId\)/);
});

test("labels preserve existing view-only axes cursor inspector and pointer contracts", async () => {
	const source = await readFile(viewUrl, "utf8");
	for (const contract of [
		"longitudinalHorizontalAxis",
		"longitudinalBoundaryLabel",
		"longitudinalCursorVerticalGuide",
		"longitudinalCursorHorizontalGuide",
		"longitudinalCursorHitTarget",
		"longitudinalElementSegment",
		"longitudinalElementInspector",
	]) assert.match(source, new RegExp(contract));
	assert.doesNotMatch(source, /^import |store|repository|aim-core|saveProfileState|Spot\.|Worker|messaging/m);
	assert.doesNotMatch(source, /Math\.round|toFixed|snap|kilomet|chainage|stationing|unitConvert/i);
});
