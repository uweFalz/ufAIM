import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewUrl = new URL(
	"../../../app/view/alignment-profile/AlignmentLongitudinalProfileView.js",
	import.meta.url
);

test("visible active-element evidence preserves the complete path, boundaries, cursor, and hit target", async () => {
	const source = await readFile(viewUrl, "utf8");
	assert.match(source, /dataset\.longitudinalProfilePath/);
	assert.match(source, /dataset\.longitudinalBoundary/);
	assert.match(source, /dataset\.longitudinalCursor =/);
	assert.match(source, /dataset\.longitudinalCursorHitTarget/);
	assert.match(source, /dataset\.longitudinalElementSegment/);
	assert.match(source, /dataset\.longitudinalActiveElement/);
	assert.match(source, /Active vertical element/);
});

test("view remains render-only and never derives identity from station or boundaries", async () => {
	const source = await readFile(viewUrl, "utf8");
	assert.doesNotMatch(
		source,
		/^import |store|repository|aim-core|sendCmdAwait|saveProfileState|Spot\.|Worker|messaging/m
	);
	assert.doesNotMatch(source, /Math\.round|toFixed|snap/i);
	assert.match(source, /sample\.elementId/);
	assert.match(source, /viewModel\.cursor\?\.elementId/);
});
