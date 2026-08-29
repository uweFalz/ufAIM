import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("TransEd is a global transitionDB app and never an Alignment-context control", async () => {
	const shell = await read("app/view/shell/buildWindowShell.js");
	const globalGroup = shell.slice(shell.indexOf('uf-toolbarGroup--global'), shell.indexOf('<div class="uf-lang">'));
	const contextGroup = shell.slice(shell.indexOf('uf-toolbarGroup--context'), shell.indexOf('id="btnToggleBands"'));
	assert.match(globalGroup, /id="btnTrans"/);
	assert.doesNotMatch(contextGroup, /id="btnTrans"/);
});

test("empty workspace cannot hide or disable the independent TransEd entry", async () => {
	const css = await read("app/styles/app.css");
	const emptyWorkspaceRules = css.match(/\.uf-shell\[data-workspace-empty="true"\][\s\S]*?\n\}/g)?.join("\n") ?? "";
	assert.doesNotMatch(emptyWorkspaceRules, /#btnTrans/);
});

test("TransEd keeps transitionDB commands and tool-local selection boundaries", async () => {
	const [bridge, inventory] = await Promise.all([
		read("app/controllers/bridges/transitionEditorBridge.js"),
		read("app/UI_SELECTION_CONTRACT_INVENTORY.md"),
	]);
	assert.match(bridge, /Transition\.GetCatalogue/);
	assert.match(bridge, /Transition\.UpdateWorkingCopy/);
	assert.match(bridge, /Transition\.ResetWorkingCopy/);
	assert.match(inventory, /TransEd[\s\S]*tool-local|TransEd[\s\S]*tool local/i);
});
