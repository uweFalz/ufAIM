import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
const repositoryUrl = new URL("../../../", import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) { const aliases = { "@app/": "app/", "@src/": "src/" }; for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), repositoryUrl).href, context); return nextResolve(specifier, context); } });
const { renderSpotHtml } = await import("../../../app/view/overlays/spotView.js");

function row(id, fingerprint, route = "1720") { return { spotId: id, label: id, type: "alignment", sourceKind: "imported", spatialMode: "local", gndRoute: { route, role: "1", sourceAssociationStatus: "reviewed" }, gndNavigator: { route, role: "1", status: "qualified", sourceFingerprint: fingerprint, sourceAssociationStatus: "reviewed", sevenLine: { constructive: 2, partial: 3, reviewRequired: 0, missing: 2 }, diagnostics: ["KM_LINE_REQUIRED"] } }; }
test("Object Overlay visibly renders professional route groups and canonical row actions", () => {
	const html = renderSpotHtml({ spotState: { rows: [row("A", "fp-a"), row("B", "fp-b"), { spotId: "C", label: "C", type: "alignment", spatialMode: "local" }] }, storeState: { workspace_selection: { primaryId: "A" } } });
	assert.equal((html.match(/data-spot-route-group="1720"/g) ?? []).length, 2);
	assert.match(html, /data-spot-source-fingerprint="fp-a"/);
	assert.match(html, /data-spot-route-review-required/);
	assert.match(html, /Nicht eindeutig zugeordnet/);
	assert.match(html, /7 Bänder · 2 konstruktiv · 3 Quellevidenz · 0 zu prüfen · 2 fehlend/);
	assert.match(html, /KM_LINE_REQUIRED/);
	assert.equal((html.match(/data-spot-activate=/g) ?? []).length, 3);
});
