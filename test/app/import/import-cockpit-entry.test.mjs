import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) {
	for (const [prefix, target] of Object.entries({ "@app/": "app/", "@src/": "src/" })) {
		if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context);
	}
	return nextResolve(specifier, context);
} });
const { renderCockpitRoot } = await import("../../../app/view/cockpit/renderCockpitRoot.js");

function surface() {
	const entry = { attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
	const root = { ownerDocument: { getElementById: id => id === "btnCockpit" ? entry : null } };
	return { root, entry };
}

test("unselected import exposes its existing review toggle, not a created object", () => {
	const { root, entry } = surface();
	renderCockpitRoot(root, { scene: { mode: "none" }, collections: { importRows: [{ itemId: "A", promotable: true }] } });
	assert.equal(entry.textContent, "Import prüfen");
	assert.equal(entry.attributes["aria-label"], entry.textContent);
	assert.equal(entry.attributes["title"], entry.textContent);
	for (const key of ["data-i18n", "data-i18n-title", "data-i18n-aria-label"]) assert.equal(entry.attributes[key], "panel_cockpit_import");
	assert.match(root.innerHTML, /1 Kandidaten/);
});

test("withheld candidates still offer review and never gain a promotion action", () => {
	const { root, entry } = surface();
	renderCockpitRoot(root, { scene: { mode: "preview", objectId: "SOURCE" }, collections: { importRows: [{ itemId: "C", promotable: false }] } });
	assert.equal(entry.textContent, "Import prüfen");
	assert.doesNotMatch(root.innerHTML, /data-cockpit-accept-show=/);
});

test("activation or empty imports restore the Cockpit label without altering the toggle", () => {
	const { root, entry } = surface();
	const candidates = { importRows: [{ itemId: "A", promotable: true }] };
	renderCockpitRoot(root, { collections: candidates });
	renderCockpitRoot(root, { scene: { mode: "spot", objectId: "CANONICAL" }, collections: candidates });
	assert.equal(entry.textContent, "Cockpit");
	assert.equal(entry.attributes["data-i18n"], "panel_cockpit");
	renderCockpitRoot(root, { collections: candidates });
	renderCockpitRoot(root, { collections: { importRows: [] } });
	assert.equal(entry.textContent, "Cockpit");
});

test("detached Cockpit rendering remains supported", () => {
	const root = {};
	assert.doesNotThrow(() => renderCockpitRoot(root));
	assert.match(root.innerHTML, /cockpit-sofa/);
});
