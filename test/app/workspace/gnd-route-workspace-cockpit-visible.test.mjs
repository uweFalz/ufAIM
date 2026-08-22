import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
const repositoryUrl = new URL("../../../", import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) { const aliases = { "@app/": "app/", "@src/": "src/" }; for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), repositoryUrl).href, context); return nextResolve(specifier, context); } });
const { renderSpotHtml } = await import("../../../app/view/overlays/spotView.js");
const { renderGndImportWorkbench } = await import("../../../app/gndImportWorkbench/gndImportWorkbenchView.js");

function node(tag) { return { tag, dataset: {}, attributes: {}, classList: { add() {}, remove() {} }, children: [], append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; }, addEventListener() {}, querySelector() { return null; }, setAttribute(name, value) { this.attributes[name] = String(value); }, textContent: "" }; }
test("object overlay shows canonical route role and source-review status", () => {
	const html = renderSpotHtml({ spotState: { rows: [{ spotId: "A", label: "A", type: "alignment", sourceKind: "imported", spatialMode: "local", gndRoute: { route: "1720", role: "1", sourceAssociationStatus: "reviewed" } }] }, storeState: { workspace_selection: { primaryId: "A" } } });
	assert.match(html, /data-spot-gnd-route="1720"/);
	assert.match(html, /data-spot-gnd-role="1"/);
	assert.match(html, /Strecke 1720 · Quellrolle 1 · reviewed/);
});

test("Workbench visibly presents route roles and explicit set promotion", () => {
	const priorDocument = globalThis.document;
	globalThis.document = { createElement: node, createDocumentFragment: () => node("fragment") };
	try {
		const root = node("div");
		const roles = ["0", "1", "2", "3", "4"].map((code) => ({ code, label: code === "1" ? "Richtungsgleis" : code, status: code === "1" || code === "2" ? "present" : "missing", families: { EL: "constructive", EH: "missing", EU: "missing", EK: "missing" } }));
		renderGndImportWorkbench(root, { phase: "ready", workspacePhase: "ready", workspaceObjects: [], activeEvidenceId: "E", records: [{ evidenceId: "E", source: { fileName: "source.mdb" }, inventory: [], diagnostics: [], relationCandidates: [], unresolvedEvidence: [] }], items: [], rejectedItems: [], routeWorkspaces: [{ id: "route:1720", route: "1720", status: "review-required", diagnostics: ["KM_LINE_REQUIRED"], promotableItemIds: ["A1", "A2"], roles }, { id: "route:1730", route: "1730", status: "ready", diagnostics: [], promotableItemIds: [], roles }], fileOutcomes: [] });
		const text = JSON.stringify(root, (key, value) => ["parentElement", "classList"].includes(key) ? undefined : value);
		assert.match(text, /Strecke 1720/); assert.match(text, /Richtungsgleis/); assert.match(text, /KM_LINE_REQUIRED/); assert.match(text, /Review-Satz übernehmen \(2\)/);
		assert.match(text, /Review-Satz übernehmen \(0\)/); assert.match(text, /"disabled":true/);
	} finally { globalThis.document = priorDocument; }
});
