import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewUrl = new URL(
	"../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js",
	import.meta.url
);

test("gradient evidence is conditional exact String-compatible cursor evidence", async () => {
	const source = await readFile(viewUrl, "utf8");
	assert.match(source, /Number\.isFinite\(viewModel\.cursor\.gradient\)/);
	assert.match(source, /` · gradient \$\{viewModel\.cursor\.gradient\}`/);
	assert.match(source, /gradientIsFinite \? `, gradient/);
	assert.doesNotMatch(source, /Math\.round|toFixed|snap|unitConvert/i);
});

test("gradient evidence preserves callout placement labels guides inspector and pointer contracts", async () => {
	const source = await readFile(viewUrl, "utf8");
	for (const contract of [
		"longitudinalCursorCallout",
		"longitudinalElementLabel",
		"longitudinalCursorVerticalGuide",
		"longitudinalCursorHorizontalGuide",
		"longitudinalCursorHitTarget",
		"longitudinalElementInspector",
	]) assert.match(source, new RegExp(contract));
	assert.match(source, /const calloutX = Math\.max/);
	assert.match(source, /const calloutY = Math\.max/);
	assert.doesNotMatch(source, /^import |store|repository|aim-core|saveProfileState|Spot\.|Worker|messaging/m);
});
