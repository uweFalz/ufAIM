import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) { for (const [prefix, target] of Object.entries({ "@app/": "app/", "@src/": "src/" })) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context); return nextResolve(specifier, context); } });

let clickHandler = null;
const root = { innerHTML: "", addEventListener(type, handler) { if (type === "click") clickHandler = handler; }, closest() { return { classList: { contains: () => false } }; }, querySelector() { return null; } };
globalThis.document = { getElementById: () => null, createElement: () => ({}), head: { append() {} } };
globalThis.window = { addEventListener() {} };
const { makeSpotView, renderSpotLoadingHtml, renderSpotErrorHtml } = await import("../../../app/view/overlays/spotView.js");

test("loading and error presentations never claim an empty canonical workspace", () => {
	assert.match(renderSpotLoadingHtml(), /data-spot-workspace-state="loading"/);
	assert.match(renderSpotLoadingHtml(), /Objekte werden geladen/);
	assert.doesNotMatch(renderSpotLoadingHtml(), /Noch keine Objekte|0 Objekte/);
	assert.match(renderSpotErrorHtml("worker unavailable"), /data-spot-workspace-state="error"/);
	assert.match(renderSpotErrorHtml("worker unavailable"), /worker unavailable/);
	assert.match(renderSpotErrorHtml("worker unavailable"), /data-spot-retry/);
});

test("view transitions loading to error retry and then the canonical object without reopening", async () => {
	let retries = 0;
	const view = makeSpotView({ rootEl: root });
	view.wireActions({ onRetry: () => { retries += 1; } });
	assert.match(root.innerHTML, /Objekte werden geladen/);
	view.showError(new Error("worker unavailable"));
	assert.match(root.innerHTML, /Erneut versuchen/);
	await clickHandler({ target: { closest: (selector) => selector === "[data-spot-retry]" ? {} : null } });
	assert.equal(retries, 1);
	view.showLoading();
	view.setSpotState({ rows: [{ spotId: "SYNTH_1_EL_0_100", label: "valid-minimal", type: "alignment" }] });
	view.refresh({ workspace_selection: { primaryId: null } });
	assert.match(root.innerHTML, /1 Objekt/);
	assert.match(root.innerHTML, /valid-minimal/);
	assert.doesNotMatch(root.innerHTML, /Noch keine Objekte/);
});
