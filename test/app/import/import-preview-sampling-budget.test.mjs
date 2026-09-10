import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

const aliases = {
	"@src/": "src/",
	"@spot/": "src/model/spot/",
	"@alignment/": "src/domain/alignment/",
	"@transition/": "src/domain/transition/",
};
registerHooks({
	resolve(specifier, context, nextResolve) {
		for (const [prefix, target] of Object.entries(aliases)) {
			if (specifier.startsWith(prefix)) {
				return nextResolve(new URL(target + specifier.slice(prefix.length), ROOT).href, context);
			}
		}
		return nextResolve(specifier, context);
	},
});

const {
	IMPORT_PREVIEW_MAX_POINTS_PER_ALIGNMENT,
	buildVisibleTracksFromImportItems,
} = await import("../../../app/io/import/importVisibleTracksAdapter.js");

test("import preview has a hard per-alignment point budget and skips unused segment sampling", async () => {
	const [adapter, projection, controller] = await Promise.all([
		read("app/io/import/importVisibleTracksAdapter.js"),
		read("src/domain/projection/AlignmentProjectionService.js"),
		read("src/domain/projection/ViewProjectionController.js"),
	]);

	assert.match(adapter, /IMPORT_PREVIEW_MAX_POINTS_PER_ALIGNMENT\s*=\s*256/);
	assert.match(adapter, /maxPoints:\s*IMPORT_PREVIEW_MAX_POINTS_PER_ALIGNMENT/);
	assert.match(adapter, /includeSegments:\s*false/);
	assert.match(controller, /maxPoints,\s*includeSegments/);
	assert.match(projection, /pointLimit\s*-\s*1/);
	assert.match(projection, /includeSegments\s*\?\s*sampleAlignmentSegments/);

	const tracks = buildVisibleTracksFromImportItems({
		fileName: "long.xml",
		items: [{
			id: "LONG",
			kind: "alignment",
			payload: { name: "Long alignment" },
			derived: {
				sparseAlignment: {
					type: "sparseAlignment",
					startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
					sparse: [{
						id: "H1",
						type: "fixed",
						poseA: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
						arcLength: 100_000,
						curvature: 0,
					}],
				},
			},
		}],
	});

	assert.equal(tracks.length, 1);
	assert.equal(IMPORT_PREVIEW_MAX_POINTS_PER_ALIGNMENT, 256);
	assert.equal(tracks[0].polyline2d.length, IMPORT_PREVIEW_MAX_POINTS_PER_ALIGNMENT);
	assert.deepEqual(tracks[0].polyline2d[0], { x: 0, y: 0 });
	assert.deepEqual(tracks[0].polyline2d.at(-1), { x: 100_000, y: 0 });
});

test("the preview optimization changes projection cost only, not import or admission truth", async () => {
	const [adapter, controller] = await Promise.all([
		read("app/io/import/importVisibleTracksAdapter.js"),
		read("src/domain/projection/ViewProjectionController.js"),
	]);
	const source = `${adapter}\n${controller}`;

	assert.doesNotMatch(source, /admissible|evidence-only|Import\.CommitJob|Spot\.|promot/i);
	assert.doesNotMatch(adapter, /profile|cant|staEq|attachment/i);
});
