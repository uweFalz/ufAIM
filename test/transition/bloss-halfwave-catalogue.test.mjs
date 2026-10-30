import assert from "node:assert/strict";
import test from "node:test";

import transitionLookup from "../../src/domain/transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "../../src/domain/transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "../../src/domain/transition/build/KappaFcnBuilder.js";
import { TransitionElement } from "../../src/aim-core/geometry/TransitionElement.js";
import { makeAlignment2DFromSparse } from "../../src/aim-core/alignment/aggregate/AlignmentFactory.js";
import { buildSparseAlignment } from "../../src/aim-core/alignment/aggregate/SparseAlignmentBuilder.js";
import { createTransitionMomentsCatalogue } from "../../src/domain/optimization/alignment/TransitionMomentsCatalogue.js";

const resolver = new RegistryResolver(transitionLookup);
const dependencies = { descriptorResolver: resolver, kappaBuilder: KappaFcnBuilder };
const momentsFor = createTransitionMomentsCatalogue(dependencies);
const shape = (id) => KappaFcnBuilder.buildPresetFromDescriptor(resolver.resolveTransitionDescriptor(id));
const close = (actual, expected, tolerance = 1e-11) => {
	assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

// Independent polynomial oracles for the existing Bloss prototype cropped
// to [0, 1/2], normalized to [0, 1], and its normalized reversal.
// These are catalogue definitions, not evidence of a Technet type-8 binding.
const forms = [
	{
		id: "bloss_halfwave_in", partition: [1, 0, 0], integral: 3 / 8,
		f: (u) => 1.5 * u ** 2 - 0.5 * u ** 3,
		d1: (u) => 3 * u - 1.5 * u ** 2,
		d2: (u) => 3 - 3 * u,
		F: (u) => 0.5 * u ** 3 - 0.125 * u ** 4,
	},
	{
		id: "bloss_halfwave_out", partition: [0, 0, 1], integral: 5 / 8,
		f: (u) => 1.5 * u - 0.5 * u ** 3,
		d1: (u) => 1.5 - 1.5 * u ** 2,
		d2: (u) => -3 * u,
		F: (u) => 0.75 * u ** 2 - 0.125 * u ** 4,
	},
];

for (const form of forms) {
	test(`${form.id}: explicit identity, polynomial, derivatives and integral`, () => {
		const record = transitionLookup.transition[form.id];
		assert.deepEqual(record.normLengthPartition, form.partition);
		assert.equal(record.halfWave1, "HW_BLOSS");
		assert.equal(record.halfWave2, "HW_BLOSS");
		const preset = shape(form.id);
		for (const u of [0, 0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 1]) {
			close(preset.kappa(u), form.f(u));
			close(preset.kappa1(u), form.d1(u));
			close(preset.kappa2(u), form.d2(u));
			close(preset.kappaInt(u), form.F(u));
		}
		close(preset.kappaInt(1), form.integral);
		assert.notEqual(preset.kappa(0.5), shape("bloss").kappa(0.5));
	});

	test(`${form.id}: physical length and signed endpoint curvature survive`, () => {
		for (const [kappaA, kappaB] of [[0, 1 / 500], [1 / 500, 0], [-1 / 1000, -1 / 500], [1 / 500, 1 / 1000]]) {
			const element = new TransitionElement({ id: form.id, arcLength: 80, runtimePreset: shape(form.id), kappaA, kappaB });
			assert.equal(element.arcLength, 80);
			for (const u of [0, 0.25, 0.5, 0.75, 1]) {
				close(element.curvatureAt(80 * u), kappaA + (kappaB - kappaA) * form.f(u));
			}
			const start = { p: { x: 12, y: -7 }, t: { x: 1, y: 0 } };
			const end = element.poseAt(80, start, { quality: "exact" });
			const expectedTurn = 80 * (kappaA + (kappaB - kappaA) * form.integral);
			close(Math.atan2(end.t.y, end.t.x), expectedTurn);
			assert.ok(Math.hypot(end.p.x - start.p.x, end.p.y - start.p.y) > 79);
		}
	});

	test(`${form.id}: AXTRAN moment catalogue consumes the same declared law`, () => {
		const moments = momentsFor(form.id);
		close(moments.totalTurn, form.integral);
		for (const u of [0, 0.2, 0.5, 0.8, 1]) close(moments.khat(u), form.F(u));
		assert.strictEqual(momentsFor(form.id), moments);
	});
}

test("Bloss halfwaves reverse into one another without changing full Bloss", () => {
	const entering = shape("bloss_halfwave_in");
	const exiting = shape("bloss_halfwave_out");
	const full = shape("bloss");
	for (const u of [0, 0.1, 0.25, 0.5, 0.8, 1]) {
		close(exiting.kappa(u), 1 - entering.kappa(1 - u));
		close(full.kappa(u), 3 * u ** 2 - 2 * u ** 3);
		close(entering.kappa(u), 2 * full.kappa(u / 2));
		close(exiting.kappa(u), 2 * (full.kappa((1 + u) / 2) - 0.5));
	}
	assert.deepEqual(transitionLookup.transition.bloss.normLengthPartition, [0.5, 0, 0.5]);
});

test("a sole entering halfwave retains both one-sided endpoint derivatives", () => {
	const quadratic = shape("s_form_halfwave_in");
	for (const u of [0, 0.5, 1]) {
		close(quadratic.kappa(u), u * u);
		close(quadratic.kappa1(u), 2 * u);
		close(quadratic.kappa2(u), 2);
	}
	// Ordinary two-halfwave joins and the clamped input convention are unchanged.
	close(shape("bloss").kappa1(1), 0);
	close(shape("bloss_halfwave_in").kappa1(2), 1.5);
	close(quadratic.kappa2(2), 2);
});

test("explicit halfwave identities survive constructive edit realization without shortening", () => {
	for (const form of forms) {
		const input = {
			type: "AlignmentData", id: "bloss-097",
			editModel: {
				startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
				elements: [
					{ id: "A", type: "straight", parameters: { length: 10 } },
					{ id: "T", type: "transition", parameters: { length: 80, transitionType: form.id } },
					{ id: "B", type: "arc", parameters: { length: 20, curvature: 1 / 500 } },
				],
			},
		};
		const before = structuredClone(input);
		const geometry = buildSparseAlignment(input, dependencies);
		assert.equal(geometry.length, 110);
		assert.equal(geometry.sparse[1].transType, form.id);
		assert.equal(geometry.sparse[1].arcLength, 80);
		const { alignment, warnings } = makeAlignment2DFromSparse({
			startPose: geometry.startPose, sparse: geometry.sparse, ...dependencies,
		});
		assert.equal(alignment.arcLength, 110);
		assert.ok(alignment.elements[1] instanceof TransitionElement);
		assert.deepEqual(warnings, []);
		assert.deepEqual(input, before);
	}
});

test("unresolved Technet type-8 label cannot silently become Immediate or full Bloss", () => {
	const sparse = [
		{ id: "A", type: "fixed", arcLength: 10, curvature: 0 },
		{ id: "T8", type: "transition", arcLength: 80, transType: "Bloss (1f geschw.)" },
		{ id: "B", type: "fixed", arcLength: 20, curvature: 1 / 500 },
	];
	const before = structuredClone(sparse);
	assert.throws(() => makeAlignment2DFromSparse({
		startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }, sparse, ...dependencies,
	}), (error) => error.code === "ALIGNMENT_TRANSITION_BUILD_FAILED" &&
		error.stage === "descriptor" && error.elementId === "T8" &&
		error.transType === "bloss (1f geschw.)" && error.arcLength === 80);
	assert.deepEqual(sparse, before);
});
