import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	TRANSITION_COMPARISON_MODES,
	buildTransitionComparison,
	formatTransitionRange,
} from "../../../app/controllers/bridges/transitionComparisonModel.js";

const ROOT = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");
const sampled = (presetId, fn) => ({
	presetId,
	samples: Array.from({ length: 5 }, (_, index) => { const u = index / 4; return { u, ...fn(u) }; }),
});
const linear = sampled("clothoid", (u) => ({ k: u, k1: 1, k2: 0 }));
const cubic = sampled("bloss", (u) => ({ k: 3 * u * u - 2 * u * u * u, k1: 6 * u - 6 * u * u, k2: 6 - 12 * u }));

test("TransEd has no κ/κ′/κ″ switch; plot and comparison are mode-free", async () => {
	const [shell, bridge, view, wiring] = await Promise.all([
		read("app/view/shell/buildWindowShell.js"),
		read("app/controllers/bridges/transitionEditorBridge.js"),
		read("app/view/editors/transitionEditorView.js"),
		read("app/ui/uiWiring.js"),
	]);
	for (const [name, source] of Object.entries({ shell, bridge, view, wiring })) {
		assert.doesNotMatch(source, /tePlot|te_plot|setTePlot/, `${name} still depends on the plot mode`);
	}
});

test("comparison carries κ, κ′ and κ″ for both transitions", () => {
	const comparison = buildTransitionComparison(cubic, linear);
	assert.deepEqual(comparison.modes, ["k", "k1", "k2"]);
	assert.deepEqual(comparison.modes, TRANSITION_COMPARISON_MODES.map((mode) => mode.id));
	assert.equal(comparison.primaryId, "bloss");
	assert.equal(comparison.secondaryId, "clothoid");
	for (const row of comparison.rows) {
		assert.equal(row.primary.points.split(" ").length, 5);
		assert.equal(row.secondary.points.split(" ").length, 5);
		assert.notEqual(row.primary.points, row.secondary.points, `${row.mode} curves must differ`);
	}
});

test("each quantity is scaled to the joint range of both transitions", () => {
	const { rows } = buildTransitionComparison(cubic, linear, { width: 100, height: 100, pad: 0 });
	const k1 = rows.find((row) => row.mode === "k1");
	assert.deepEqual(k1.range, { min: 0, max: 1.5 });
	// κ′ of the clothoid is constantly 1 -> two thirds of the joint range [0, 1.5].
	assert.ok(k1.secondary.points.split(" ").every((point) => Math.abs(Number(point.split(",")[1]) - 100 / 3) < 0.01));
	const k2 = rows.find((row) => row.mode === "k2");
	assert.deepEqual(k2.range, { min: -6, max: 6 });
	assert.deepEqual(k2.primary.summary, { start: 6, end: -6, min: -6, max: 6 });
	assert.equal(k2.secondary.points.split(" ")[0], "0.00,50.00");
});

test("ranges are printed readably and missing data is marked", () => {
	assert.equal(formatTransitionRange({ min: 0, max: 1.5 }), "0 … 1.5");
	assert.equal(formatTransitionRange({ min: -5.99999999, max: 1 / 3 }), "-6 … 0.3333");
	assert.equal(formatTransitionRange(null), "—");
	assert.equal(buildTransitionComparison(cubic, { presetId: "x", samples: [] }), null);
});
