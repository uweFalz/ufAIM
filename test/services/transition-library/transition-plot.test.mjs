import assert from "node:assert/strict";
import test from "node:test";

import { couplingPlotSvg, formatRange, functionPlotSvg, plotParameterAt, transitionPlotSvg } from "../../../src/services/transition-library/transitionPlot.js";

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

test("the function picture shows f, f′, f″ and the frame cut out by the argument interval", () => {
	const fn = Array.from({ length: 21 }, (_, index) => { const x = -0.5 + index * 0.1; return { x, f: 3 * x * x - 2 * x ** 3, f1: 6 * x - 6 * x * x, f2: 6 - 12 * x }; });
	const { svg, ranges } = functionPlotSvg({ samples: fn, frame: { a: 0, b: 0.5, fa: 0, fb: 0.5 } });
	for (const series of ["f", "f1", "f2"]) assert.equal(pointsOf(svg, series).length, 21);
	assert.ok(Math.abs(ranges.f.max - 1) < 1e-9);
	const frame = svg.match(/<rect data-frame="1" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/).slice(1).map(Number);
	// x from 0 to 0.5 on a range of -0.5 .. 1.5 is the second quarter of the plot width
	const inner = 720 - 44 - 14;
	assert.ok(Math.abs(frame[0] - (44 + 0.25 * inner)) < 0.01 && Math.abs(frame[2] - 0.25 * inner) < 0.01);
	assert.ok(frame[3] > 1);
	// a backwards interval draws the same box
	assert.equal(functionPlotSvg({ samples: fn, frame: { a: 0.5, b: 0, fa: 0.5, fb: 0 } }).svg.match(/<rect data-frame[^>]*>/)[0], svg.match(/<rect data-frame[^>]*>/)[0]);
	assert.equal((functionPlotSvg({ samples: fn }).svg.match(/data-frame/g) ?? []).length, 0);
	assert.ok(functionPlotSvg({ samples: fn.map((s) => ({ ...s, f: 2 })) }).svg.length > 0, "a constant function still gets a picture");
});
