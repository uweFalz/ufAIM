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

test("a kink's turn is read from the sparse model's unit vector as well as from the angle", () => {
	// validateSparseAlignment and the LandFAT bridge carry deltaDir as
	// {x: cos, y: sin}; read as a number that was NaN and the kink went
	// straight through
	const turn = -0.2;
	const asVector = build([
		{ id: "F", type: "fixed", arcLength: 10, curvature: 0 },
		{ id: "K", type: "transition", arcLength: 0, transType: "kink", deltaDir: { x: Math.cos(turn), y: Math.sin(turn) } },
		{ id: "G", type: "fixed", arcLength: 10, curvature: 0 },
	]).alignment;
	const asAngle = build([
		{ id: "F", type: "fixed", arcLength: 10, curvature: 0 },
		{ id: "K", type: "transition", arcLength: 0, transType: "kink", deltaDir: turn },
		{ id: "G", type: "fixed", arcLength: 10, curvature: 0 },
	]).alignment;
	assert.equal(asVector.elements[1] instanceof KinkElement, true);
	assert.ok(Math.abs(asVector.elements[1].deltaDir - turn) < 1e-15, `vector read as ${asVector.elements[1].deltaDir}`);
	assert.equal(asAngle.elements[1].deltaDir, turn);
	const endVector = asVector.poseAt(20);
	const endAngle = asAngle.poseAt(20);
	assert.ok(Math.hypot(endVector.p.x - endAngle.p.x, endVector.p.y - endAngle.p.y) < 1e-12, "the two forms are one geometry");
	assert.ok(Math.abs(Math.atan2(endVector.t.y, endVector.t.x) - turn) < 1e-12, "and the heading turned by the angle");
});

test("fixed warnings and exact non-transition collaborator errors remain unchanged", () => {
	const missingCurvature = build([
		{ id: "F", type: "fixed", arcLength: "bad", curvature: "bad" },
	]);
	assert.equal(missingCurvature.alignment.elements[0] instanceof ZeroLengthFixed, true);
	assert.deepEqual(
		missingCurvature.warnings.map((entry) => entry.msg),
		["FixedElement missing curvature -> set 0"]
	);
	assert.throws(
		() => build([{ id: "T", type: "transition", arcLength: 2 }]),
		(error) => error.code === "ALIGNMENT_TRANSITION_BUILD_FAILED" &&
			error.stage === "transType" && error.elementId === "T" && error.arcLength === 2
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

test("positive-length resolver and builder failures refuse instead of Immediate fallback", () => {
	for (const [collaborator, stage, message] of [
		[
			{
				descriptorResolver: {
					resolveTransitionDescriptor() { throw new Error("resolve-x"); },
				},
				kappaBuilder: KappaFcnBuilder,
			},
			"descriptor",
			"resolve-x",
		],
		[
			{
				descriptorResolver: { resolveTransitionDescriptor: () => ({ id: "x" }) },
				kappaBuilder: {
					buildPresetFromDescriptor() { throw new Error("build-x"); },
				},
			},
			"preset",
			"build-x",
		],
	]) {
		assert.throws(() => canonicalFactory({
			startPose: START,
			sparse: [
				{ type: "fixed", arcLength: 1, curvature: 0 },
				{ type: "transition", arcLength: 1, transType: "x" },
				{ type: "fixed", arcLength: 1, curvature: 0.01 },
			],
			...collaborator,
		}), (error) => error.code === "ALIGNMENT_TRANSITION_BUILD_FAILED" &&
			error.stage === stage && error.cause?.message === message && error.arcLength === 1);
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
