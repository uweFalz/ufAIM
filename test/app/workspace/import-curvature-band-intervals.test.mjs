import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
const aliases = {
	"@app/": "app/", "@src/": "src/", "@utils/": "src/lib/utils/",
	"@spot/": "src/model/spot/", "@transition/": "src/domain/transition/",
	"@alignment/": "src/domain/alignment/", "@projection/": "src/domain/projection/",
};
registerHooks({ resolve(specifier, context, nextResolve) {
	for (const [prefix, target] of Object.entries(aliases)) {
		if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context);
	}
	return nextResolve(specifier, context);
} });

const { buildCurvatureBandIntervals } = await import("../../../app/controllers/curvatureBandController.js");
const { materializeAlignmentDataFromSparse } = await import("../../../src/domain/alignment/editor/materializeAlignmentDataFromSparse.js");
const { makeAlignment2DFromSparse } = await import("../../../src/domain/alignment/build/AlignmentFactory.js");
const { RegistryResolver } = await import("../../../src/domain/transition/registry/RegistryResolver.js");
const { KappaFcnBuilder } = await import("../../../src/domain/transition/build/KappaFcnBuilder.js");

test("unannotated imported arcs and immediate transitions have finite selectable band intervals before any edit", () => {
	const kernel = {
		startPose: { p: { x: 4510643, y: 5379188 }, t: { x: 1, y: 0 } },
		// No kind, sStart or sEnd: the existing imported sparse_v1 shape.
		sparse: [
			{ id: "A1", type: "fixed", arcLength: 41.51400218, curvature: 0.0036719607435594394 },
			{ id: "T2", type: "transition", arcLength: 0, transType: "immediate" },
			{ id: "A3", type: "fixed", arcLength: 19.67443926, curvature: 0.0015915864237577909 },
			{ id: "T4", type: "transition", arcLength: 0, transType: "immediate" },
			{ id: "A5", type: "fixed", arcLength: 41.5939144, curvature: -0.00033285343939512264 },
		],
	};
	const before = structuredClone(kernel);
	const data = materializeAlignmentDataFromSparse({ id: "W467-468", data: { kernel } });
	const { alignment, warnings } = makeAlignment2DFromSparse({ ...kernel, descriptorResolver: new RegistryResolver(), kappaBuilder: KappaFcnBuilder });
	assert.deepEqual(warnings, []);
	const intervals = buildCurvatureBandIntervals(kernel, data.editModel);
	assert.deepEqual(intervals.map(({ id, kind }) => [id, kind]), [["A1", "arc"], ["T2", "transition"], ["A3", "arc"], ["T4", "transition"], ["A5", "arc"]]);
	assert.equal(intervals[0].sStart, 0);
	assert.equal(intervals[1].sStart, intervals[1].sEnd);
	assert.equal(intervals[4].sStart, 61.18844144);
	assert.equal(intervals[4].sEnd, alignment.arcLength);
	assert.ok(Math.abs(alignment.arcLength - 102.78235584) < 1e-10);
	for (const row of intervals) {
		assert.ok(Number.isFinite(row.sStart) && Number.isFinite(row.sEnd));
		assert.ok(Number.isFinite(alignment.curvatureAt((row.sStart + row.sEnd) / 2)));
	}
	assert.deepEqual(kernel, before, "rendering must not mutate imported evidence");
});

test("band kind lookup follows stable identities, not edit-model array order", () => {
	const intervals = buildCurvatureBandIntervals({ elements: [{ id: "S", arcLength: 10 }, { id: "A", arcLength: 20 }] }, { elements: [{ id: "A", type: "arc" }, { id: "S", type: "straight" }] });
	assert.deepEqual(intervals, [{ id: "S", kind: "straight", sStart: 0, sEnd: 10 }, { id: "A", kind: "arc", sStart: 10, sEnd: 30 }]);
});

test("invalid runtime lengths are not silently drawn as valid intervals", () => {
	for (const arcLength of [NaN, Infinity, -1]) assert.throws(() => buildCurvatureBandIntervals({ elements: [{ id: "bad", arcLength }] }, {}), /invalid runtime element length/);
	assert.deepEqual(buildCurvatureBandIntervals({ elements: [] }, {}), []);
});
