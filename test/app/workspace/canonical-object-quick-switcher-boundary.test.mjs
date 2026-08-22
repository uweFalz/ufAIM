import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("production seam uses canonical UI readback and exact canonical activation", async () => {
	const [wiring, runtime, controller] = await Promise.all([
		read("app/ui/uiWiring.js"), read("app/runtime/init/initFeatures.js"), read("app/controllers/workspace/createCanonicalObjectQuickSwitcherController.js"),
	]);
	assert.match(wiring, /sendCmdAwait\("Spot\.GetUiState"/);
	assert.match(wiring, /refreshCanonicalUiState/);
	assert.match(runtime, /promotedAlignmentJourney\.activateCanonicalAlignment\(id\)/);
	assert.match(controller, /result\?\.ok !== true/);
	assert.doesNotMatch(controller, /setWorkspaceSelection|setFocus|optimistic/i);
});

test("surface is keyboard-labelled responsive shell UI without object mutation semantics", async () => {
	const [shell, css, model, view] = await Promise.all([
		read("app/view/shell/buildWindowShell.js"), read("app/styles/app.css"), read("app/domain/workspace/buildCanonicalObjectQuickSwitcherModel.js"), read("app/view/workspace/CanonicalObjectQuickSwitcherView.js"),
	]);
	assert.match(shell, /canonicalObjectQuickSwitcherOverlay/);
	assert.match(shell, /data-tool-surface/);
	assert.match(shell, /aria-labelledby="canonicalObjectQuickSwitcherTitle"/);
	assert.match(css, /canonicalObjectQuickSwitcherOverlay\[data-tool-presentation="dock"\]/);
	assert.match(css, /data-tool-presentation="sheet"/);
	assert.match(view, /input\.type = "search"|input\.type="search"/);
	assert.match(model, /gndNavigator\?\.sourceFingerprint/);
	assert.doesNotMatch([model, view].join("\n"), /Rename|RemoveObject|Delete|SaveObject|Spot\.AddObjects|fileName|proximity|distance/i);
});

