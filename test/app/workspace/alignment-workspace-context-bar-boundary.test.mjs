import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function read(path) { return readFile(new URL(`../../../${path}`, import.meta.url), "utf8"); }

test("context bar is projection-only and delegates existing workspace actions", async () => {
	const [model, view, init, controller] = await Promise.all([read("app/domain/workspace/buildAlignmentWorkspaceContextBarModel.js"), read("app/view/workspace/ExistingAlignmentIntelligenceView.js"), read("app/runtime/init/initFeatures.js"), read("app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js")]);
	assert.match(model, /georeferenceQualification/); assert.match(view, /activateMode/); assert.match(init, /alignmentBimWorkspace\?\.activate/); assert.match(init, /btnSpot/); assert.match(init, /btnGndImportWorkbench/); assert.match(init, /data-alignment-task-rail/);
	assert.doesNotMatch([model, view].join("\n"), /localStorage|sessionStorage|Spot\.Save|sendCmdAwait|nearest|transform\(|projectPoint|EPSG:\d{4}/i);
	assert.match(controller, /route: null, sourceRole: null/);
});

test("shell keeps canvas primary and context bar adapts to dock and mobile", async () => {
	const [shell, css] = await Promise.all([read("app/view/shell/buildWindowShell.js"), read("app/styles/app.css")]);
	assert.match(shell, /id="workspaceContextBar"/); assert.match(shell, /id="view3d"/); assert.match(css, /\.uf-shell\[data-tool-dock\] \.uf-workspaceContextBar/); assert.match(css, /@media \(max-width:760px\)/); assert.match(css, /grid-template-columns:1fr auto/);
});
