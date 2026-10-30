import assert from "node:assert/strict";
import test from "node:test";

import { TransitionElement } from "../../../src/aim-core/geometry/TransitionElement.js";
import { Alignment2D } from "../../../src/aim-core/geometry/Alignment2D.js";
import { RegistryResolver } from "../../../src/domain/transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "../../../src/aim-core/transition/runtime/KappaFcnBuilder.js";
import transitionLookup from "../../../src/domain/transition/transitionLookup.json" with { type: "json" };

const resolver = new RegistryResolver(transitionLookup);
const shape = (id) => KappaFcnBuilder.buildPresetFromDescriptor(resolver.resolveTransitionDescriptor(id));
const samples = [0, 0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 1];
const close = (actual, expected, tolerance = 1e-12) =>
	assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const start = { p: { x: 12, y: -7 }, t: { x: Math.cos(0.3), y: Math.sin(0.3) } };

for (const [id, f, F] of [
	["bloss_halfwave_in", (u) => 1.5 * u ** 2 - 0.5 * u ** 3,
		(u) => 0.5 * u ** 3 - 0.125 * u ** 4],
	["bloss_halfwave_out", (u) => 1.5 * u - 0.5 * u ** 3,
		(u) => 0.75 * u ** 2 - 0.125 * u ** 4],
]) {
	test(`${id}: reverse agrees with the independent reflected polynomial and integral`, () => {
		const element = new TransitionElement({
			arcLength: 80, runtimePreset: shape(id), kappaA: 0, kappaB: 1 / 500,
		});
		const reversed = element.reverse();
		for (const u of samples) {
			close(reversed.curvatureAt(80 * u), -f(1 - u) / 500);
			close(reversed.runtime.kappa(u), 1 - f(1 - u));
			close(reversed.runtime.kappaInt(u), u - F(1) + F(1 - u));
		}
		close(reversed.curvatureAt(40), id.endsWith("_in") ? -0.000625 : -0.001375);
	});
}

for (const id of Object.keys(transitionLookup.transition)) {
	test(`${id}: signed curvature derivatives, XY return and double reversal`, () => {
		const runtime = shape(id);
		const originalDescriptors = Object.getOwnPropertyDescriptors(runtime);
		Object.freeze(runtime);
		for (const [kappaA, kappaB] of [
			[0, 1 / 500], [1 / 500, 0], [-1 / 1000, -1 / 500], [1 / 500, -1 / 1000],
		]) {
			const element = new TransitionElement({ arcLength: 80, runtimePreset: runtime, kappaA, kappaB });
			const reversed = element.reverse();
			const twice = reversed.reverse();
			assert.equal(reversed.arcLength, 80);
			// The existing constructor normalizes signed zero to +0.
			close(reversed.kappaA, -kappaB, 0);
			close(reversed.kappaB, -kappaA, 0);
			assert.strictEqual(twice.runtime, runtime);
			assert.equal(twice.kappaA, kappaA);
			assert.equal(twice.kappaB, kappaB);
			assert.deepEqual(Object.keys(reversed.runtime).sort(), ["kappa", "kappa1", "kappa2", "kappaInt"]);
			for (const u of samples) {
				const s = 80 * u;
				close(reversed.curvatureAt(s), -element.curvatureAt(80 - s));
				close(reversed.curvature1At(s), element.curvature1At(80 - s));
				close(reversed.curvature2At(s), -element.curvature2At(80 - s));
				assert.equal(twice.curvatureAt(s), element.curvatureAt(s));
				assert.equal(twice.curvature1At(s), element.curvature1At(s));
				assert.equal(twice.curvature2At(s), element.curvature2At(s));
			}
			const end = element.poseAt(80, start, { quality: "exact" });
			const reverseStart = { p: { ...end.p }, t: { x: -end.t.x, y: -end.t.y } };
			for (const u of [0, 0.25, 0.5, 0.75, 1]) {
				const originalPose = element.poseAt(80 * (1 - u), start, { quality: "exact" });
				const reversePose = reversed.poseAt(80 * u, reverseStart, { quality: "exact" });
				// Numerical integration differs by direction. Keep the tighter
				// new-Bloss check; permit 1 micrometre for other 80-metre cases.
				const positionTolerance = id.startsWith("bloss_halfwave_") ? 2e-7 : 1e-6;
				close(reversePose.p.x, originalPose.p.x, positionTolerance);
				close(reversePose.p.y, originalPose.p.y, positionTolerance);
				close(reversePose.t.x, -originalPose.t.x);
				close(reversePose.t.y, -originalPose.t.y);
				assert.deepEqual(twice.poseAt(80 * u, start), element.poseAt(80 * u, start));
			}
		}
		for (const [key, descriptor] of Object.entries(originalDescriptors)) {
			assert.strictEqual(runtime[key], descriptor.value, `unchanged runtime field ${key}`);
		}
	});
}

test("bound runtime methods stay bound and optional derivatives stay absent", () => {
	const runtime = Object.freeze({
		power: 2,
		presetId: "not-a-reversed-descriptor",
		lambdas: Object.freeze([1, 0, 0]),
		kappa(u) { assert.strictEqual(this, runtime); return u ** this.power; },
		kappaInt(u) { assert.strictEqual(this, runtime); return u ** (this.power + 1) / (this.power + 1); },
	});
	const originalDescriptors = Object.getOwnPropertyDescriptors(runtime);
	const element = new TransitionElement({ arcLength: 80, runtimePreset: runtime, kappaA: 0, kappaB: 0.002 });
	const reversed = element.reverse();
	assert.deepEqual(Object.keys(reversed.runtime), ["kappa", "kappaInt"]);
	for (const u of samples) {
		close(reversed.runtime.kappa(u), 1 - (1 - u) ** 2);
		close(reversed.runtime.kappaInt(u), u - 1 / 3 + (1 - u) ** 3 / 3);
		assert.equal(reversed.curvature1At(u * 80), 0);
		assert.equal(reversed.curvature2At(u * 80), 0);
	}
	assert.strictEqual(reversed.reverse().runtime, runtime);
	assert.deepEqual(Object.getOwnPropertyDescriptors(runtime), originalDescriptors);
	assert.equal(Object.isFrozen(reversed.runtime), true);
});

test("optional bound derivative methods retain their receiver and reflection signs", () => {
	const runtime = Object.freeze({
		power: 3,
		kappa(u) { return u ** this.power; },
		kappaInt(u) { return u ** (this.power + 1) / (this.power + 1); },
		kappa1(u) { assert.strictEqual(this, runtime); return this.power * u ** (this.power - 1); },
		kappa2(u) { assert.strictEqual(this, runtime); return this.power * (this.power - 1) * u ** (this.power - 2); },
	});
	const reversed = new TransitionElement({ arcLength: 80, runtimePreset: runtime }).reverse();
	for (const u of samples) {
		close(reversed.runtime.kappa1(u), 3 * (1 - u) ** 2);
		close(reversed.runtime.kappa2(u), -6 * (1 - u));
	}
});

test("fresh reversals observe optional derivative changes without stale capability caching", () => {
	const runtime = {
		kappa: (u) => u ** 2,
		kappaInt: (u) => u ** 3 / 3,
	};
	const element = new TransitionElement({ arcLength: 80, runtimePreset: runtime, kappaA: 0, kappaB: 0.002 });
	const withoutDerivatives = element.reverse();
	assert.equal(withoutDerivatives.runtime.kappa1, undefined);
	assert.equal(withoutDerivatives.runtime.kappa2, undefined);
	runtime.kappa1 = (u) => 2 * u;
	runtime.kappa2 = () => 2;
	const withDerivatives = element.reverse();
	assert.notStrictEqual(withDerivatives.runtime, withoutDerivatives.runtime);
	close(withDerivatives.curvature1At(40), element.curvature1At(40));
	close(withDerivatives.curvature2At(40), -element.curvature2At(40));
	delete runtime.kappa1;
	runtime.kappa2 = null;
	assert.equal(withDerivatives.curvature1At(40), 0);
	assert.equal(withDerivatives.curvature2At(40), 0);
	const removedDerivatives = element.reverse();
	assert.equal(removedDerivatives.runtime.kappa1, undefined);
	assert.equal(removedDerivatives.runtime.kappa2, undefined);
	assert.strictEqual(withoutDerivatives.reverse().runtime, runtime);
	assert.strictEqual(withDerivatives.reverse().runtime, runtime);
	assert.strictEqual(removedDerivatives.reverse().runtime, runtime);
});

test("aggregate reversal follows the same asymmetric geometry from its true end pose", () => {
	const alignment = new Alignment2D([
		new TransitionElement({ arcLength: 80, runtimePreset: shape("bloss_halfwave_in"), kappaA: 0, kappaB: 0.002 }),
		new TransitionElement({ arcLength: 60, runtimePreset: shape("s_form_halfwave_out"), kappaA: 0.002, kappaB: -0.001 }),
	], start);
	const reversed = alignment.reverse();
	assert.equal(reversed.arcLength, alignment.arcLength);
	for (const s of [0, 10, 30, 59, 61, 80, 100, 140]) {
		const expected = alignment.poseAt(140 - s);
		const actual = reversed.poseAt(s);
		close(actual.p.x, expected.p.x, 2e-7);
		close(actual.p.y, expected.p.y, 2e-7);
		close(actual.t.x, -expected.t.x);
		close(actual.t.y, -expected.t.y);
		close(reversed.curvatureAt(s), -alignment.curvatureAt(140 - s));
	}
});
