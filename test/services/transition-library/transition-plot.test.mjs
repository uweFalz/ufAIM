import assert from "node:assert/strict";
import test from "node:test";

import { couplingPlotSvg, formatRange, plotParameterAt, transitionPlotSvg } from "../../../src/services/transition-library/transitionPlot.js";

const samples = Array.from({ length: 11 }, (_, index) => { const u = index / 10; return { u, k: 3 * u * u - 2 * u ** 3, k1: 6 * u - 6 * u * u, k2: 6 - 12 * u }; });
const pointsOf = (svg, series) => svg.match(new RegExp(`<polyline data-series="${series}" points="([^"]+)"`))[1].split(" ").map((p) => p.split(",").map(Number));

test("the transition picture carries κ, κ′, κ″ and both cut lines", () => {
	const { svg, ranges } = transitionPlotSvg({ samples, w1: 0.3, w2: 0.7 });
	for (const series of ["k", "k1", "k2"]) assert.equal(pointsOf(svg, series).length, 11);
	assert.deepEqual(ranges.k2, { min: -6, max: 6 });
	assert.ok(Math.abs(ranges.k1.max - 1.5) < 1e-12);
	assert.equal((svg.match(/data-cut="w1"/g) ?? []).length, 1);
	assert.equal((svg.match(/data-cut="w2"/g) ?? []).length, 1);
	// κ rises: its first point is the lowest on screen (largest y), its last the highest.
	const k = pointsOf(svg, "k");
	assert.ok(k[0][1] > k.at(-1)[1]);
	assert.ok(!svg.includes("<script"));
});

test("cut lines at the ends are not drawn, and a counter-swerve widens the frame", () => {
	assert.equal((transitionPlotSvg({ samples, w1: 0, w2: 1 }).svg.match(/data-cut=/g) ?? []).length, 0);
	const swerve = samples.map((sample) => ({ ...sample, k: sample.k - 0.2 * Math.sin(Math.PI * sample.u) * (1 - sample.u) }));
	const flat = pointsOf(transitionPlotSvg({ samples }).svg, "k");
	const wide = pointsOf(transitionPlotSvg({ samples: swerve }).svg, "k");
	assert.ok(wide[0][1] < flat[0][1], "zero sits higher when the frame reaches below zero");
	assert.deepEqual(transitionPlotSvg({ samples: [] }), { svg: "", ranges: null });
});

test("the coupling picture shows both quantities and emphasises the given one", () => {
	const pairs = samples.map((sample) => ({ u: sample.u, curvature: sample.k, cant: sample.u }));
	const asCurvature = couplingPlotSvg({ samples: pairs, given: "curvature" }).svg;
	const asCant = couplingPlotSvg({ samples: pairs, given: "cant" }).svg;
	assert.match(asCurvature, /data-series="curvature"[^>]*stroke-width="3"/);
	assert.match(asCant, /data-series="cant"[^>]*stroke-width="3"/);
	assert.equal(pointsOf(asCurvature, "cant").length, 11);
});

test("pointer fractions map onto the plotted parameter", () => {
	assert.equal(plotParameterAt(44 / 720), 0);
	assert.equal(plotParameterAt((720 - 14) / 720), 1);
	assert.equal(plotParameterAt(0), 0);
	assert.equal(plotParameterAt(1), 1);
	assert.ok(Math.abs(plotParameterAt((44 + 0.5 * (720 - 58)) / 720) - 0.5) < 1e-12);
	assert.equal(formatRange({ min: -5.99999, max: 1 / 3 }), "-6 … 0.333");
	assert.equal(formatRange(null), "—");
});
