import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
const aliases = { "@app/": "app/", "@src/": "src/", "@utils/": "src/lib/utils/", "@kimport/": "src/import/", "@spot/": "src/model/spot/", "@transition/": "src/domain/transition/" };
registerHooks({ resolve(specifier, context, nextResolve) { for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context); return nextResolve(specifier, context); } });
const { resolveAlignmentAuthoringTarget, resolveAlignmentEditorElementChoice } = await import("../../../app/controllers/bridges/alignmentEditorBridge.js");
const { watchWorkspaceToolSurface } = await import("../../../app/ui/uiWiring.js");

function responsiveWindow(initial = false) { const listeners = new Set(), query = { matches: initial, addEventListener(_, fn) { listeners.add(fn); }, removeEventListener(_, fn) { listeners.delete(fn); }, emit(value) { this.matches = value; for (const fn of listeners) fn(); }, get count() { return listeners.size; } }; return { query, matchMedia: () => query }; }

test("authoring target exact-binds canonical horizontal selection", () => {
	assert.deepEqual(resolveAlignmentAuthoringTarget({ activeObjectId: "A", requestedObjectId: "A", discipline: "horizontal", elementId: "H1" }), { supported: true, objectId: "A", discipline: "horizontal", elementId: "H1" });
	assert.equal(resolveAlignmentAuthoringTarget({ activeObjectId: "B", requestedObjectId: "A", discipline: "horizontal", elementId: "H1" }).supported, false);
	assert.equal(resolveAlignmentAuthoringTarget({ activeObjectId: "A", requestedObjectId: "A", discipline: "cant", elementId: "C1" }).supported, false);
});

test("stale exact element never falls through to another canonical element", () => {
	const elements = [{ id: "H2", type: "arc" }];
	assert.deepEqual(resolveAlignmentEditorElementChoice({ requestedElementId: "H1", previousElementId: "H2", workspaceElementId: "H2", elements }), { requested: true, found: false, selectedId: "" });
	assert.deepEqual(resolveAlignmentEditorElementChoice({ requestedElementId: "H2", elements }), { requested: true, found: true, selectedId: "H2" });
	assert.deepEqual(resolveAlignmentEditorElementChoice({ elements }), { requested: false, found: true, selectedId: "H2" });
});

test("authoring surface follows desktop and mobile presentation lifecycle", () => {
	const surface = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }, shell = { dataset: {} }, documentRef = { getElementById: id => id === "ufShell" ? shell : null }, windowRef = responsiveWindow(false);
	const stop = watchWorkspaceToolSurface({ surface, kind: "authoring", windowRef, documentRef });
	assert.equal(surface.attrs["data-tool-presentation"], "dock"); assert.equal(shell.dataset.toolDock, "authoring");
	windowRef.query.emit(true); assert.equal(surface.attrs.role, "dialog"); assert.equal(surface.attrs["aria-modal"], "true"); assert.equal(shell.dataset.toolDock, undefined);
	windowRef.query.emit(false); assert.equal(surface.attrs.role, "complementary"); assert.equal(shell.dataset.toolDock, "authoring");
	stop(); assert.equal(windowRef.query.count, 0);
});
