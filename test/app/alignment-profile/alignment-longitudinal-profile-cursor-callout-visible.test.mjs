import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewUrl = new URL(
	"../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js",
	import.meta.url
);

test("callout has a stable accessible exact-value contract", async () => {
	const source = await readFile(viewUrl, "utf8");
	assert.match(source, /longitudinalCursorCallout/);
	assert.match(source, /`s \$\{viewModel\.cursor\.s\} · elevation \$\{viewModel\.cursor\.elevation\}\$\{gradientText\}`/);
	assert.match(source, /Number\.isFinite\(viewModel\.cursor\.gradient\)/);
	assert.match(source, /Shared cursor s/);
	assert.match(source, /const calloutX = Math\.max/);
	assert.match(source, /const calloutY = Math\.max/);
});

test("callout preserves existing noninteractive profile evidence and semantics", async () => {
	const source = await readFile(viewUrl, "utf8");
	for (const contract of [
		"longitudinalElementLabel",
		"longitudinalCursorVerticalGuide",
		"longitudinalCursorHorizontalGuide",
		"longitudinalCursorHitTarget",
		"longitudinalElementInspector",
		"longitudinalHorizontalAxis",
	]) assert.match(source, new RegExp(contract));
	assert.doesNotMatch(source, /^import |store|repository|aim-core|saveProfileState|Spot\.|Worker|messaging/m);
	assert.doesNotMatch(source, /Math\.round|toFixed|snap|kilomet|chainage|stationing|unitConvert/i);
});
