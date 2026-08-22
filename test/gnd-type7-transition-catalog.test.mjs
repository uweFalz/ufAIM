import test from "node:test";
import assert from "node:assert/strict";

import transitionLookup from "../src/domain/transition/transitionLookup.json" with { type: "json" };
import { KappaFcnBuilder } from "../src/domain/transition/build/KappaFcnBuilder.js";
import { RegistryResolver } from "../src/domain/transition/registry/RegistryResolver.js";
import { resolveGndType7TransitionId } from "../src/import/parsers/technet/gndEdit/gnd/resolveGndType7TransitionId.js";

const resolver = new RegistryResolver(transitionLookup);

function preset(id) {
	return KappaFcnBuilder.buildPresetFromDescriptor(resolver.resolveTransitionDescriptor(id));
}

function approx(actual, expected, tolerance = 1e-12) {
	assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);
}

test("TransitionDB exposes both S-form half-wave directions as explicit catalogue records", () => {
	assert.deepEqual(transitionLookup.transition.s_form_halfwave_in.normLengthPartition, [1, 0, 0]);
	assert.deepEqual(transitionLookup.transition.s_form_halfwave_out.normLengthPartition, [0, 0, 1]);
	assert.equal(transitionLookup.transition.s_form_halfwave_in.halfWave1, "HW_BIQUAD");
	assert.equal(transitionLookup.transition.s_form_halfwave_out.halfWave2, "HW_BIQUAD");

	const full = preset("helmert");
	const entering = preset("s_form_halfwave_in");
	const exiting = preset("s_form_halfwave_out");
	for (const u of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
		approx(entering.kappa(u), 2 * full.kappa(u / 2));
		approx(exiting.kappa(u), 2 * (full.kappa(0.5 + u / 2) - 0.5));
	}
	approx(entering.kappa(0), 0);
	approx(entering.kappa(1), 1);
	approx(exiting.kappa(0), 0);
	approx(exiting.kappa(1), 1);
});

test("GND type 7 selects a half-wave only from unambiguous source curvature magnitudes", () => {
	assert.equal(resolveGndType7TransitionId({ typeCode: 7, radiusA: 0, radiusE: 500 }), "s_form_halfwave_in");
	assert.equal(resolveGndType7TransitionId({ typeCode: 7, radiusA: -1000, radiusE: -500 }), "s_form_halfwave_in");
	assert.equal(resolveGndType7TransitionId({ typeCode: 7, radiusA: 500, radiusE: 0 }), "s_form_halfwave_out");
	assert.equal(resolveGndType7TransitionId({ typeCode: 7, radiusA: -500, radiusE: -1000 }), "s_form_halfwave_out");
	assert.equal(resolveGndType7TransitionId({ typeCode: 7, radiusA: 500, radiusE: -500 }), null);
	assert.equal(resolveGndType7TransitionId({ typeCode: 7, radiusA: 500, radiusE: 500 }), null);
	assert.equal(resolveGndType7TransitionId({ typeCode: 7, radiusA: null, radiusE: 500 }), null);
	assert.equal(resolveGndType7TransitionId({ typeCode: 8, radiusA: 0, radiusE: 500 }), null);
});

test("the GND parser and TRA-like mapper carry the exact catalogue identity", async () => {
	const parserSource = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/import/parsers/technet/gndEdit/parseGND_XLSX.js", import.meta.url), "utf8"));
	const mapperSource = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/import/parsers/technet/shared/traLikeCoordGeom.js", import.meta.url), "utf8"));
	assert.match(parserSource, /transitionType:\s*Number\(edge\?\.typeCode\) === 7 \? resolveGndType7TransitionId\(edge\) : null/);
	assert.match(mapperSource, /rec\?\.transitionType/);
	assert.match(mapperSource, /spiType:\s*resolveRecordSpiralType\(rec, kind\)/);
});
