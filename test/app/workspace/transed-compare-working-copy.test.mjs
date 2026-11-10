import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";

// The view imports JSXGraph from a CDN and @utils via the import map; neither
// is needed for sampling, so the CDN module is stubbed and the alias mapped.
const ROOT = new URL("../../../", import.meta.url);
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === "jsxgraph") return { url: "data:text/javascript,export const JSXGraph={};", shortCircuit: true };
		if (specifier.startsWith("@utils/")) return nextResolve(new URL(`src/lib/utils/${specifier.slice(7)}`, ROOT).href, context);
		return nextResolve(specifier, context);
	},
});
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.MutationObserver ??= class { observe() {} disconnect() {} };

const { makeTransitionEditorView } = await import("../../../app/view/editors/transitionEditorView.js");
const { KappaFcnBuilder } = await import("../../../src/domain/transition/build/KappaFcnBuilder.js");
const { createTransitionQueryService } = await import("../../../src/domain/transition/service/TransitionQueryService.js");
const { RegistryResolver } = await import("../../../src/domain/transition/registry/RegistryResolver.js");

const db = JSON.parse(await readFile(new URL("src/domain/transition/transitionLookup.json", ROOT), "utf8"));
const service = createTransitionQueryService({ db, registryResolver: new RegistryResolver(db) });
const messaging = { sendCmdAwait: async (name, payload) => {
	assert.equal(name, "Transition.GetPresetSpec");
	return service.getPresetSpec(payload.presetId);
} };
const store = { getState: () => ({}), subscribe: () => () => {} };
const makeView = () => makeTransitionEditorView(store, { messaging, kappaBuilder: KappaFcnBuilder });
const curve = (sampled) => sampled.samples.map((sample) => Number(sample.k.toFixed(6)));
const EDITED = [0.2, 0.6, 0.2];

for (const presetId of ["bloss", "sine", "helmert"]) {
	test(`TransEd comparison samples follow the ${presetId} working copy after apply and reset`, async (t) => {
		t.after(() => service.resetWorkingCopy({ presetId }));
		const view = makeView();
		const persisted = curve(await view.samplePreset(presetId));

		assert.equal(service.updateWorkingCopy({ presetId, normLengthPartition: EDITED }).ok, true);
		await view.invalidatePreset(presetId);
		const applied = curve(await view.samplePreset(presetId));
		const fresh = curve(await makeView().samplePreset(presetId));
		assert.deepEqual(applied, fresh, "cached view must match a fresh view after apply");
		assert.notDeepEqual(applied, persisted, "the edited partition must change the comparison curve");

		service.resetWorkingCopy({ presetId });
		await view.invalidatePreset(presetId);
		assert.deepEqual(curve(await view.samplePreset(presetId)), persisted, "reset must restore the persisted curve");
	});
}

test("TransEd bridge invalidates the view cache on apply and reset", async () => {
	const bridge = await readFile(new URL("app/controllers/bridges/transitionEditorBridge.js", ROOT), "utf8");
	const body = (name) => bridge.slice(bridge.indexOf(`async function ${name}`), bridge.indexOf("\n\t}", bridge.indexOf(`async function ${name}`)));
	for (const name of ["applyWorkingCopy", "resetWorkingCopy"]) {
		const source = body(name);
		assert.ok(source.indexOf("invalidatePreset") > -1 && source.indexOf("invalidatePreset") < source.indexOf("reloadCatalogue"), `${name} must invalidate before reloading`);
	}
});
