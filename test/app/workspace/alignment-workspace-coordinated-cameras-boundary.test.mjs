import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const paths = [
	"../../../app/controllers/workspace/createAlignmentBimWorkspaceController.js",
	"../../../app/controllers/viewController.js",
	"../../../app/view/viewers/threeViewer.js",
	"../../../app/controllers/adapters/geo/MapLibreThreeAdapter.js",
];
const source = (await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")))).join("\n");

test("coordinated cameras depend on existing selection, cursor, projection and CRS qualification only", () => {
	assert.match(source, /workspace_selection/);
	assert.match(source, /cursor/);
	assert.match(source, /georeference/);
	assert.doesNotMatch(source, /parsers|TransitionDB|TrackNetworkTopology|constructVertical|constructCant/i);
});

test("camera coordination never guesses EPSG or adds coordinate transforms", () => {
	const workspace = source.slice(source.indexOf("function buttonFor"), source.indexOf("export default createAlignmentBimWorkspaceController"));
	assert.doesNotMatch(workspace, /EPSG:\\d|proj4|longitude.*=|latitude.*=/);
	assert.match(workspace, /LOCAL map/);
	assert.match(workspace, /LOCAL camera/);
});
