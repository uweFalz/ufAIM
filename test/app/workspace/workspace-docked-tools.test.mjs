import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
const aliases = { "@app/": "app/", "@src/": "src/", "@utils/": "src/lib/utils/", "@kimport/": "src/import/", "@spot/": "src/model/spot/" };
registerHooks({ resolve(specifier, context, nextResolve) { for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context); return nextResolve(specifier, context); } });
const { configureWorkspaceToolSurface, clearWorkspaceToolSurface, watchWorkspaceToolSurface } = await import("../../../app/ui/uiWiring.js");
const { watchGndWorkbenchToolSurface } = await import("../../../app/gndImportWorkbench/gndImportWorkbenchController.js");

function surface() { return { attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } }; }
function documentWithShell() { const shell = { dataset: {} }; return { shell, getElementById: (id) => id === "ufShell" ? shell : null }; }
function responsiveWindow(initial = false) { const listeners = new Set(), query = { matches: initial, addEventListener(type, fn) { if (type === "change") listeners.add(fn); }, removeEventListener(type, fn) { if (type === "change") listeners.delete(fn); }, emit(matches) { this.matches = matches; for (const fn of listeners) fn({ matches }); }, get listenerCount() { return listeners.size; } }; return { query, matchMedia: () => query }; }

test("desktop uses one non-modal dock and close clears only its ownership", () => {
	const panel = surface(), documentRef = documentWithShell();
	assert.equal(configureWorkspaceToolSurface({ surface: panel, kind: "objects", windowRef: { matchMedia: () => ({ matches: false }) }, documentRef }), "dock");
	assert.deepEqual(panel.attrs, { role: "complementary", "aria-modal": "false", "data-tool-presentation": "dock" });
	assert.equal(documentRef.shell.dataset.toolDock, "objects");
	clearWorkspaceToolSurface({ kind: "workbench", documentRef }); assert.equal(documentRef.shell.dataset.toolDock, "objects");
	clearWorkspaceToolSurface({ kind: "objects", documentRef }); assert.equal(documentRef.shell.dataset.toolDock, undefined);
});

test("narrow layout is an explicit modal sheet", () => {
	const panel = surface(), documentRef = documentWithShell();
	assert.equal(configureWorkspaceToolSurface({ surface: panel, kind: "workbench", windowRef: { matchMedia: () => ({ matches: true }) }, documentRef }), "sheet");
	assert.equal(panel.attrs.role, "dialog"); assert.equal(panel.attrs["aria-modal"], "true"); assert.equal(panel.attrs["data-tool-presentation"], "sheet");
});

test("Object surface follows desktop mobile desktop live and cleans its single listener", () => {
	const panel = surface(), documentRef = documentWithShell(), windowRef = responsiveWindow(false);
	const stop = watchWorkspaceToolSurface({ surface: panel, kind: "objects", windowRef, documentRef });
	assert.equal(windowRef.query.listenerCount, 1); assert.equal(panel.attrs.role, "complementary"); assert.equal(documentRef.shell.dataset.toolDock, "objects");
	windowRef.query.emit(true); assert.equal(panel.attrs.role, "dialog"); assert.equal(panel.attrs["aria-modal"], "true"); assert.equal(documentRef.shell.dataset.toolDock, undefined);
	windowRef.query.emit(false); assert.equal(panel.attrs.role, "complementary"); assert.equal(documentRef.shell.dataset.toolDock, "objects");
	stop(); assert.equal(windowRef.query.listenerCount, 0);
});

test("Workbench surface follows live breakpoints and reopen does not duplicate listeners", () => {
	const panel = surface(), documentRef = documentWithShell(), windowRef = responsiveWindow(false), previous = globalThis.document; globalThis.document = documentRef;
	try {
		let stop = watchGndWorkbenchToolSurface(panel, "workbench", windowRef); assert.equal(windowRef.query.listenerCount, 1);
		windowRef.query.emit(true); assert.equal(panel.attrs["data-tool-presentation"], "sheet"); assert.equal(documentRef.shell.dataset.toolDock, undefined);
		windowRef.query.emit(false); assert.equal(panel.attrs["data-tool-presentation"], "dock"); assert.equal(documentRef.shell.dataset.toolDock, "workbench");
		stop(); stop = watchGndWorkbenchToolSurface(panel, "workbench", windowRef); assert.equal(windowRef.query.listenerCount, 1); stop(); assert.equal(windowRef.query.listenerCount, 0);
	} finally { globalThis.document = previous; }
});
