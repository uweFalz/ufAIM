import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
const aliases = { "@app/": "app/", "@src/": "src/", "@spot/": "src/model/spot/", "@projection/": "src/domain/projection/", "@transition/": "src/domain/transition/", "@alignment/": "src/domain/alignment/", "@domain/": "src/domain/", "@shared/": "src/shared/", "@runtime/": "app/runtime/", "@controllers/": "app/controllers/", "@view/": "app/view/", "@ui/": "app/ui/", "@io/": "app/io/", "@kimport/": "src/import/", "@kgeom/": "src/lib/geom/", "@kmath/": "src/lib/math/", "@utils/": "src/lib/utils/" };
registerHooks({ resolve(specifier, context, nextResolve) { for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context); return nextResolve(specifier, context); } });
const { createObjectWorkspaceHydrator } = await import("../../../app/ui/uiWiring.js");

function deferred() {
	let resolve, reject;
	const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

test("initial visible hydration deduplicates canonical requests and renders the eventual object", async () => {
	const request = deferred(), calls = [], phases = [];
	const ui = {
		elements: { overlaySpot: { classList: { contains: () => false } } },
		showSpotLoading() { phases.push("loading"); },
		setSpotState(value) { phases.push(["ready", value.rows[0].spotId]); },
		refreshSpot() { phases.push("rendered"); },
		showSpotError(error) { phases.push(["error", error.message]); },
	};
	const hydrator = createObjectWorkspaceHydrator({ ui, store: { getState: () => ({}) }, messaging: { sendCmdAwait(name) { calls.push(name); return request.promise; } } });
	const first = hydrator.refresh(), duplicate = hydrator.refresh();
	assert.equal(calls.length, 1);
	assert.deepEqual(phases, ["loading"]);
	request.resolve({ rows: [{ spotId: "SYNTH_1_EL_0_100", label: "valid-minimal" }] });
	assert.equal(await first, true); assert.equal(await duplicate, true);
	assert.deepEqual(calls, ["Spot.GetUiState"]);
	assert.deepEqual(phases, ["loading", ["ready", "SYNTH_1_EL_0_100"], "rendered"]);
});

test("failure stays explicit and retry starts exactly one fresh canonical request", async () => {
	let attempt = 0; const phases = [];
	const ui = { elements: { overlaySpot: { classList: { contains: () => false } } }, showSpotLoading() { phases.push("loading"); }, showSpotError(error) { phases.push(["error", error.message]); }, setSpotState(value) { phases.push(["ready", value.rows.length]); }, refreshSpot() { phases.push("rendered"); } };
	const hydrator = createObjectWorkspaceHydrator({ ui, store: { getState: () => ({}) }, messaging: { async sendCmdAwait() { attempt += 1; if (attempt === 1) throw new Error("worker unavailable"); return { rows: [{ spotId: "SYNTH_1_EL_0_100" }] }; } } });
	assert.equal(await hydrator.refresh(), false);
	assert.deepEqual(phases, ["loading", ["error", "worker unavailable"]]);
	assert.equal(await hydrator.retry(), true);
	assert.equal(attempt, 2);
	assert.deepEqual(phases.slice(-3), ["loading", ["ready", 1], "rendered"]);
});
