import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sources = [
	"app/controllers/alignment-profile/createAlignmentProfileProjectionController.js",
	"app/controllers/alignment-profile/createAlignmentProfileViewModel.js",
	"app/view/alignment-profile/AlignmentProfileSynchronizedView.js",
];

test("profile controller and view logic have no static dependencies or concrete application wiring", async () => {
	for (const sourcePath of sources) {
		const source = await readFile(
			new URL(`../../../${sourcePath}`, import.meta.url),
			"utf8"
		);
		assert.doesNotMatch(
			source,
			/\b(?:import|export)\s+(?:[^"'`]*?\sfrom\s*)?["'`]/
		);
		assert.doesNotMatch(
			source,
			/(?:aim-core|Spot|SharedMessaging|transitionEditor|Workbench|IndexedDB|localStorage|sessionStorage)/
		);
	}
});

test("profile projection controller exposes only service-shape injection and explicit projectAt delegation", async () => {
	const source = await readFile(
		new URL(
			"../../../app/controllers/alignment-profile/createAlignmentProfileProjectionController.js",
			import.meta.url
		),
		"utf8"
	);
	assert.match(source, /alignmentProfileApplicationService/);
	assert.match(source, /\.projectAt\(\{/);
	assert.match(source, /alignmentId:\s*expected\.alignmentId/);
	assert.match(source, /s:\s*expected\.s/);
	assert.match(source, /REVISION_MISMATCH/);
	assert.match(source, /CURSOR_MISMATCH/);
	assert.doesNotMatch(
		source,
		/(?:saveProfileState|saveById|dispatchEvent|querySelector|document\.)/
	);
});

test("view is an injected-host render-only component and carries no write or inference seam", async () => {
	const [viewModelSource, viewSource] = await Promise.all([
		readFile(
			new URL(
				"../../../app/controllers/alignment-profile/createAlignmentProfileViewModel.js",
				import.meta.url
			),
			"utf8"
		),
		readFile(
			new URL(
				"../../../app/view/alignment-profile/AlignmentProfileSynchronizedView.js",
				import.meta.url
			),
			"utf8"
		),
	]);
	assert.match(viewSource, /constructor\(\{\s*host\s*\}/);
	assert.match(viewSource, /this\.\#host\.replaceChildren\(root\)/);
	assert.doesNotMatch(
		`${viewModelSource}\n${viewSource}`,
		/(?:addEventListener|fetch\(|saveProfileState|saveById|repository|dispatch|mutate|command|infer|convert|transform)/
	);
	assert.match(viewModelSource, /vertical:\s*projection\.vertical/);
	assert.match(viewModelSource, /chainage:\s*projection\.chainage/);
	assert.match(viewModelSource, /cant:\s*projection\.cant/);
});
