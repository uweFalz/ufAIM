import assert from "node:assert/strict";
import test from "node:test";
import { buildWindowShell } from "../../../app/view/shell/buildWindowShell.js";

test("shell exposes accessible workbench and object tool surfaces plus focusable canvas", () => {
	const roots = Object.fromEntries(["app-root", "overlay-root", "debug-root"].map((id) => [id, { innerHTML: "" }]));
	const previous = globalThis.document; globalThis.document = { getElementById: (id) => roots[id] ?? null };
	try { buildWindowShell(); } finally { globalThis.document = previous; }
	assert.match(roots["app-root"].innerHTML, /id="geoStage" tabindex="-1"/);
	assert.match(roots["overlay-root"].innerHTML, /id="gndImportWorkbenchOverlay"[^>]*data-tool-kind="workbench"[^>]*role="complementary"[^>]*aria-hidden="true"/);
	assert.match(roots["overlay-root"].innerHTML, /id="spotOverlay"[^>]*data-tool-kind="objects"[^>]*role="complementary"[^>]*aria-hidden="true"/);
	assert.match(roots["app-root"].innerHTML, /data-workspace-view-mode="main"/); assert.match(roots["app-root"].innerHTML, /data-workspace-view-mode="q"/); assert.match(roots["app-root"].innerHTML, /data-workspace-view-mode="l"/);
});
