import assert from "node:assert/strict";
import test from "node:test";

import transitionLookup from "../../../src/domain/transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "../../../src/domain/transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "../../../src/aim-core/transition/runtime/KappaFcnBuilder.js";
import { makeAlignment2DFromSparse as canonicalFactory } from "../../../src/aim-core/alignment/aggregate/AlignmentFactory.js";
import { makeAlignment2DFromSparse as legacyFactory } from "../../../src/domain/alignment/build/AlignmentFactory.js";
import { Alignment2D } from "../../../src/aim-core/geometry/Alignment2D.js";
import { FixedElement } from "../../../src/aim-core/geometry/FixedElement.js";
import { TransitionElement } from "../../../src/aim-core/geometry/TransitionElement.js";
import { ZeroLengthFixed } from "../../../src/aim-core/geometry/ZeroLengthFixed.js";
import { ImmediateElement } from "../../../src/aim-core/geometry/ImmediateElement.js";
import { KinkElement } from "../../../src/aim-core/geometry/KinkElement.js";

const START = { p: { x: 1, y: 2 }, t: { x: 1, y: 0 } };

function collaborators() {
	return {
		descriptorResolver: new RegistryResolver(structuredClone(transitionLookup)),
		kappaBuilder: KappaFcnBuilder,
	};
}

function build(sparse, overrides = {}) {
	return canonicalFactory({
		startPose: START,
		sparse,
		...collaborators(),
		...overrides,
	});
}

test("legacy canonical Aggregate and Root exports are strictly identical", async () => {
	const aggregate = await import(
		"../../../src/aim-core/alignment/aggregate/index.js"
	);
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(legacyFactory, canonicalFactory);
	assert.strictEqual(aggregate.makeAlignment2DFromSparse, canonicalFactory);
	assert.strictEqual(root.makeAlignment2DFromSparse, canonicalFactory);
});

test("representative sparse sequence constructs every existing element specialization", () => {
	const sparse = [
		{ id: "F", type: "fixed", arcLength: 10, curvature: 0 },
		{ id: "T", type: "transition", arcLength: 5, transType: "clothoid" },
		{ id: "C", type: "fixed", arcLength: 10, curvature: 0.01 },
		{ id: "Z", type: "fixed", arcLength: 0, curvature: 0.01 },
		{ id: "I", type: "transition", arcLength: 0, transType: "clothoid" },
		{ id: "K", type: "transition", arcLength: 0, transType: "clothoid", deltaDir: -0.2 },
	];
	const before = structuredClone(sparse);
	const { alignment, warnings } = build(sparse);
	assert.ok(alignment instanceof Alignment2D);
	assert.equal(alignment.elements[0] instanceof FixedElement, true);
	assert.equal(alignment.elements[1] instanceof TransitionElement, true);
	assert.equal(alignment.elements[2] instanceof FixedElement, true);
	assert.equal(alignment.elements[3] instanceof ZeroLengthFixed, true);
	assert.equal(alignment.elements[4] instanceof ImmediateElement, true);
	assert.equal(alignment.elements[5] instanceof KinkElement, true);
	assert.deepEqual(warnings, []);
	assert.deepEqual(sparse, before);
	assert.strictEqual(alignment.pose0.p === START.p, false);
});

test("warnings fallbacks and exact collaborator errors remain unchanged", () => {
	const missingType = build([
		{ id: "F", type: "fixed", arcLength: "bad", curvature: "bad" },
		{ id: "T", type: "transition", arcLength: 2 },
	]);
	assert.equal(missingType.alignment.elements[0] instanceof ZeroLengthFixed, true);
	assert.equal(missingType.alignment.elements[1] instanceof ImmediateElement, true);
	assert.deepEqual(
		missingType.warnings.map((entry) => entry.msg),
		[
			"FixedElement missing curvature -> set 0",
			'Transition missing transType -> treated as Immediate',
		]
	);
	assert.throws(() => canonicalFactory(), /AlignmentFactory: missing startPose/);
	assert.throws(
		() => canonicalFactory({ startPose: START, sparse: null }),
		/AlignmentFactory: sparse must be an array/
	);
	assert.throws(
		() => canonicalFactory({ startPose: START, sparse: [] }),
		/AlignmentFactory: missing descriptorResolver\.resolveTransitionDescriptor/
	);
	assert.throws(
		() => canonicalFactory({
			startPose: START,
			sparse: [],
			descriptorResolver: { resolveTransitionDescriptor() {} },
		}),
		/AlignmentFactory: missing kappaBuilder\.buildPresetFromDescriptor/
	);
});

test("injected resolver and builder preserve call order references and options", () => {
	const calls = [];
	const descriptor = { id: "custom" };
	const runtimePreset = {
		kappa: (u) => u,
		kappa1: () => 1,
		kappa2: () => 0,
		kappaInt: (u) => u * u / 2,
	};
	const descriptorResolver = {
		resolveTransitionDescriptor(id) {
			calls.push(["resolve", id]);
			return descriptor;
		},
	};
	const kappaBuilder = {
		buildPresetFromDescriptor(value, opts) {
			calls.push(["build", value, opts]);
			return runtimePreset;
		},
	};
	const opts = { w1: 0.2, w2: 0.8 };
	const result = canonicalFactory({
		startPose: START,
		sparse: [
			{ type: "fixed", arcLength: 1, curvature: -0.01 },
			{ type: "transition", arcLength: 2, transType: "CUSTOM", opts },
			{ type: "fixed", arcLength: 1, curvature: 0.02 },
		],
		descriptorResolver,
		kappaBuilder,
	});
	assert.deepEqual(calls, [["resolve", "custom"], ["build", descriptor, opts]]);
	assert.strictEqual(result.alignment.elements[1].runtime, runtimePreset);
	assert.equal(result.alignment.elements[1].kappaA, -0.01);
	assert.equal(result.alignment.elements[1].kappaB, 0.02);
});

test("resolver builder and construction failures retain ordered Immediate fallbacks", () => {
	for (const [collaborator, expected] of [
		[
			{
				descriptorResolver: {
					resolveTransitionDescriptor() { throw new Error("resolve-x"); },
				},
				kappaBuilder: KappaFcnBuilder,
			},
			"Descriptor resolve failed -> Immediate (resolve-x)",
		],
		[
			{
				descriptorResolver: { resolveTransitionDescriptor: () => ({ id: "x" }) },
				kappaBuilder: {
					buildPresetFromDescriptor() { throw new Error("build-x"); },
				},
			},
			"Runtime preset build failed -> Immediate (build-x)",
		],
	]) {
		const result = canonicalFactory({
			startPose: START,
			sparse: [
				{ type: "fixed", arcLength: 1, curvature: 0 },
				{ type: "transition", arcLength: 1, transType: "x" },
				{ type: "fixed", arcLength: 1, curvature: 0.01 },
			],
			...collaborator,
		});
		assert.equal(result.alignment.elements[1] instanceof ImmediateElement, true);
		assert.equal(result.warnings[0].msg, expected);
	}
});

test("all catalogue transition families remain constructible through injected collaborators", () => {
	for (const id of Object.keys(transitionLookup.transition)) {
		const result = build([
			{ type: "fixed", arcLength: 1, curvature: 0 },
			{ type: "transition", arcLength: 2, transType: id },
			{ type: "fixed", arcLength: 1, curvature: 0.01 },
		]);
		assert.equal(result.alignment.elements.length, 3, id);
		assert.equal(result.alignment.elements[1] instanceof TransitionElement, true, id);
		assert.deepEqual(result.warnings, [], id);
	}
});
