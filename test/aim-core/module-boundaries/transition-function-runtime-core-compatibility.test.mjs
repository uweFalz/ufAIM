import assert from "node:assert/strict";
import test from "node:test";

import transitionLookup from "../../../src/domain/transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "../../../src/domain/transition/registry/RegistryResolver.js";
import { KappaFcnBuilder as legacyKappa } from "../../../src/domain/transition/build/KappaFcnBuilder.js";
import { computeAnchorsFromTotal as legacyAnchors } from "../../../src/domain/transition/registry/compose/computeAnchorsFromTotal.js";
import {
	KappaFcnBuilder as canonicalKappa,
} from "../../../src/aim-core/transition/runtime/KappaFcnBuilder.js";
import {
	computeAnchorsFromTotal as canonicalAnchors,
} from "../../../src/aim-core/transition/runtime/computeAnchorsFromTotal.js";
import { clamp01 } from "../../../src/aim-core/transition/runtime/clamp01.js";

const SAMPLE_U = [-Infinity, NaN, "invalid", -1, 0, 0.2, 0.5, 0.8, 1, 2, Infinity];

function snapshotPreset(preset) {
	return {
		keys: Object.keys(preset),
		presetId: preset.presetId,
		label: preset.label,
		lambdas: [...preset.lambdas],
		anchors: [...preset.normCrvAnchor],
		cuts01: { ...preset.cuts01 },
		cutsCrv: { ...preset.cutsCrv },
		meta: { ...preset.meta },
		values: SAMPLE_U.map((u) => ({
			kappa: preset.kappa(u),
			kappa1: preset.kappa1(u),
			kappa2: preset.kappa2(u),
			kappaInt: preset.kappaInt(u),
		})),
	};
}

function descriptor(id) {
	return new RegistryResolver(structuredClone(transitionLookup))
		.resolveTransitionDescriptor(id);
}

test("all five entry points share one runtime authority", async () => {
	const runtime = await import(
		"../../../src/aim-core/transition/runtime/index.js"
	);
	const transition = await import("../../../src/aim-core/transition/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(legacyKappa, canonicalKappa);
	assert.strictEqual(runtime.KappaFcnBuilder, canonicalKappa);
	assert.strictEqual(transition.KappaFcnBuilder, canonicalKappa);
	assert.strictEqual(root.KappaFcnBuilder, canonicalKappa);
	assert.strictEqual(legacyAnchors, canonicalAnchors);
	assert.strictEqual(runtime.computeAnchorsFromTotal, canonicalAnchors);
	assert.strictEqual(transition.computeAnchorsFromTotal, canonicalAnchors);
	assert.strictEqual(root.computeAnchorsFromTotal, canonicalAnchors);
	assert.strictEqual(runtime.clamp01, clamp01);
	assert.strictEqual(transition.clamp01, clamp01);
	assert.strictEqual(root.clamp01, clamp01);
});

test("KappaFcnBuilder retains exact public key order", () => {
	assert.deepEqual(Object.keys(canonicalKappa), [
		"buildFamiliesFromDescriptor",
		"buildPresetFromDescriptor",
		"buildPresetFromDefs",
	]);
});

test("clamp01 preserves productive coercion and finite handling", () => {
	for (const [input, expected] of [
		[-Infinity, 0],
		[Infinity, 0],
		[NaN, 0],
		[undefined, 0],
		[null, 0],
		["invalid", 0],
		["0.25", 0.25],
		[-2, 0],
		[0.5, 0.5],
		[2, 1],
		[true, 1],
		[false, 0],
	]) {
		assert.equal(clamp01(input), expected);
	}
	assert.throws(() => clamp01(Symbol("x")), TypeError);
});

test("linear polynomial sinusoidal and asymmetric descriptors remain equivalent", () => {
	for (const id of ["clothoid", "helmert", "bloss", "sine", "gubar"]) {
		const left = snapshotPreset(legacyKappa.buildPresetFromDescriptor(descriptor(id)));
		const right = snapshotPreset(canonicalKappa.buildPresetFromDescriptor(descriptor(id)));
		assert.deepEqual(right, left, id);
	}
});

test("partition defaults and overrides preserve arrays anchors metadata and results", () => {
	for (const opts of [{}, { w1: 0.2, w2: 0.85 }, { w1: "0.25", w2: "0.75" }]) {
		const left = legacyKappa.buildPresetFromDescriptor(descriptor("gubar"), opts);
		const right = canonicalKappa.buildPresetFromDescriptor(descriptor("gubar"), opts);
		assert.deepEqual(snapshotPreset(right), snapshotPreset(left));
		assert.deepEqual(Object.keys(right.meta), Object.keys(left.meta));
	}
});

test("compat defs bridge preserves every registered transition family", () => {
	for (const id of Object.keys(transitionLookup.transition)) {
		const left = legacyKappa.buildPresetFromDefs(
			structuredClone(transitionLookup),
			id
		);
		const right = canonicalKappa.buildPresetFromDefs(
			structuredClone(transitionLookup),
			id
		);
		assert.deepEqual(snapshotPreset(right), snapshotPreset(left), id);
	}
});

test("families retain endpoint normalization derivatives integrals and aliases", () => {
	const input = descriptor("bloss");
	const before = structuredClone(input);
	const familyPackage = canonicalKappa.buildFamiliesFromDescriptor(input);
	assert.deepEqual(input, before);
	assert.deepEqual(Object.keys(familyPackage), [
		"id",
		"label",
		"lambdas",
		"kappaFamilies",
		"normCrvAnchor",
		"meta",
	]);
	for (const family of familyPackage.kappaFamilies) {
		assert.equal(family.kappa(0), 0);
		assert.equal(family.kappa(1), 1);
		assert.equal(typeof family.kappa1(0.5), "number");
		assert.equal(typeof family.kappa2(0.5), "number");
		assert.equal(typeof family.kappaInt(0.5), "number");
	}
});

test("computeAnchors preserves normalization thresholds fallback and order", () => {
	const family = (slope) => ({ kappa1: () => slope });
	const cases = [
		{ families: [family(1), family(1), family(1)], lengths: [0.2, 0.5, 0.3] },
		{ families: [family(0), family(NaN), family(-2)], lengths: [1, 2, 3] },
		{ families: [], lengths: [] },
		{ families: null, lengths: null },
		{ families: [family(1)], lengths: [Infinity, 0, 0] },
		{ families: [family(1), family(1), family(1)], lengths: ["1", "2", "3"] },
	];
	for (const entry of cases) {
		assert.deepEqual(
			canonicalAnchors(entry.families, entry.lengths),
			legacyAnchors(entry.families, entry.lengths)
		);
	}
	assert.deepEqual(Object.keys({ value: canonicalAnchors([], []) }), ["value"]);
});

test("degenerate disabled unknown and malformed errors remain exact", () => {
	const invalidCalls = [
		() => canonicalKappa.buildPresetFromDescriptor(null),
		() => canonicalKappa.buildPresetFromDefs({}, "missing"),
		() => {
			const value = descriptor("bloss");
			value.halfWave1.protoDef = { disabled: true };
			return canonicalKappa.buildPresetFromDescriptor(value);
		},
		() => {
			const value = descriptor("bloss");
			value.halfWave1.source = "unknown";
			return canonicalKappa.buildPresetFromDescriptor(value);
		},
	];
	const legacyCalls = [
		() => legacyKappa.buildPresetFromDescriptor(null),
		() => legacyKappa.buildPresetFromDefs({}, "missing"),
		() => {
			const value = descriptor("bloss");
			value.halfWave1.protoDef = { disabled: true };
			return legacyKappa.buildPresetFromDescriptor(value);
		},
		() => {
			const value = descriptor("bloss");
			value.halfWave1.source = "unknown";
			return legacyKappa.buildPresetFromDescriptor(value);
		},
	];
	for (let i = 0; i < invalidCalls.length; i += 1) {
		let canonicalError;
		let legacyError;
		try { invalidCalls[i](); } catch (error) { canonicalError = error; }
		try { legacyCalls[i](); } catch (error) { legacyError = error; }
		assert.equal(canonicalError?.constructor, legacyError?.constructor);
		assert.equal(canonicalError?.message, legacyError?.message);
	}
});

test("runtime construction has no duplicate authority or source mutation", () => {
	const leftInput = descriptor("watorek");
	const rightInput = structuredClone(leftInput);
	const leftBefore = structuredClone(leftInput);
	const rightBefore = structuredClone(rightInput);
	const left = legacyKappa.buildPresetFromDescriptor(leftInput);
	const right = canonicalKappa.buildPresetFromDescriptor(rightInput);
	assert.deepEqual(snapshotPreset(left), snapshotPreset(right));
	assert.deepEqual(leftInput, leftBefore);
	assert.deepEqual(rightInput, rightBefore);
	assert.notStrictEqual(left, right);
	assert.strictEqual(legacyKappa, canonicalKappa);
});
