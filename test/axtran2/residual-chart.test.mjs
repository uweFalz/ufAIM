import assert from "node:assert/strict";
import test from "node:test";

// The residual curve as a string: two panels along the station, before to
// its own scale, after to the tolerance band, points outside the band
// ringed. Pure, so the app, the bundle and this test draw the same picture.

const { residualChartSvg } = await import(new URL("../../src/services/axtran2/residualChart.js", import.meta.url));

const point = (station, offsetBefore, offset, tolerance = 0.15) => ({ kind: "measured", station, offsetBefore, offset, within: Math.abs(offset) <= tolerance });

test("two panels, both paths through every point, the band as the tolerance, outside points ringed", () => {
	const points = [point(100, 12.0, 0.02), point(200, 8.5, -0.04), point(300, 3.1, 0.21), point(400, -1.2, 0.01)];
	const svg = residualChartSvg(points, { tolerance: 0.15, width: 1000, height: 100 });
	assert.ok(svg.startsWith("<svg") && svg.endsWith("</svg>"));
	assert.equal((svg.match(/<path /g) ?? []).length, 2, "one path before, one after");
	assert.equal((svg.match(/<circle /g) ?? []).length, 1, "the one point outside the tolerance is ringed");
	assert.match(svg, /vorher/);
	assert.match(svg, /nachher, Band = Toleranz ±15 cm/);
	assert.match(svg, /\+20 m/, "the before scale rounds up to a round number above 12 m");
	assert.match(svg, /Station 100 m/);
	assert.match(svg, />400 m</);
	// the paths run from the first to the last station across the plot width
	const [before, after] = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
	assert.ok(before.startsWith("M72.0 ") && after.startsWith("M72.0 "), "both start at the left edge of the plot");
	assert.ok(before.endsWith("984.0 55.3") || /984\.0 [0-9.]+$/.test(before), "and end at its right edge");
	assert.equal(before.split("L").length, 4, "four points on the before path");
});

test("points without a station, Zwangspunkte and excluded points stay out of the curve; fewer than two points give nothing", () => {
	const svg = residualChartSvg([point(10, 1, 0.01), { kind: "zwangspunkt", station: 20, offsetBefore: 2, offset: 2 }, { kind: "excluded", station: null, offsetBefore: null, offset: null }, point(30, 0.5, -0.02)]);
	assert.equal((svg.match(/<path d="M[^"]*"/g) ?? [])[0].split("L").length, 2, "two measured points on the before path");
	assert.equal(residualChartSvg([point(10, 1, 0.01)]), "");
	assert.equal(residualChartSvg([]), "");
	assert.equal(residualChartSvg(null), "");
});

test("labels are escaped and the SVG carries no script", () => {
	const svg = residualChartSvg([point(0, 1, 0), point(50, 1, 0)], { unit: "<m>" });
	assert.ok(svg.includes("&lt;m&gt;") && !svg.includes("<m>"));
	assert.ok(!/<script/i.test(svg));
});
