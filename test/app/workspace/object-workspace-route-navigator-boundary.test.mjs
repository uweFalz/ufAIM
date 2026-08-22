import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
const repositoryUrl = new URL("../../../", import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) { const aliases = { "@app/": "app/", "@src/": "src/" }; for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), repositoryUrl).href, context); return nextResolve(specifier, context); } });

test("navigator derives neither grouping nor focus from forbidden heuristics", async () => {
	const model = await readFile(new URL("../../../src/model/spot/ui/buildSpotUiState.js", import.meta.url), "utf8");
	const view = await readFile(new URL("../../../app/view/overlays/spotView.js", import.meta.url), "utf8");
	assert.doesNotMatch(model, /dropOrder|proximity|pathSimilarity|fileName.*route|sourceLabel.*route/i);
	assert.match(model, /sourceEvidence/);
	assert.match(model, /importItemId/);
	assert.match(view, /sourceFingerprint/);
	assert.match(view, /actions\.onActivate/);
	assert.doesNotMatch(view, /onActivate\?\.[^(]*\([^)]*(?:route|fingerprint)/);
});

test("missing fingerprint or exact route is retained in review-required instead of merged", async () => {
	const { groupSpotRowsForRouteNavigator } = await import("../../../app/view/overlays/spotView.js");
	const result = groupSpotRowsForRouteNavigator([{ spotId: "A", label: "1720", gndNavigator: { route: "1720", role: "1", status: "review-required", sourceFingerprint: null } }, { spotId: "B", sourceLabel: "looks-like-1720.mdb" }]);
	assert.equal(result.groups.length, 0);
	assert.deepEqual(result.reviewRequired.map((row) => row.spotId), ["A", "B"]);
});
