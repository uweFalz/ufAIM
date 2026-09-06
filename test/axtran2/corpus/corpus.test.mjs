import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

// The corpus lives in test/samples, which is not versioned: it is customer
// data. Where it is absent these tests skip and say so; they never pass by
// finding nothing to check.

const SAMPLES = new URL("../../samples/", import.meta.url);
const present = existsSync(new URL("eifel/", SAMPLES));
const skip = present ? false : "test/samples is not checked out on this machine";

const { loadTraAlignment, buildProductionAlignment } = await import("./loadTraAlignment.mjs");
const { createTraScenario, chooseProfile, momentsFor, deps } = await import("./createTraScenario.mjs");
const { createAlignmentPoseJacobian } =
	await import(new URL("../../../src/domain/optimization/alignment/AlignmentPoseJacobian.js", import.meta.url));

// five alignments across the corpus, small to long, clothoid and Bloss, one
// with a junction arc inserted
const FILES = [
	"Landshut/W424-426.TRA",
	"metroB/Freihöls_Gleis3.TRA",
	"Landshut/5500L074-082.TRA",
	"Landshut/5500S074-082.TRA",
	"metroB/5904072S_ER0.TRA",
];
const at = (name) => new URL(name, SAMPLES);

test("the loader's chain reaches every file's own end point", { skip }, async () => {
	for (const name of FILES) {
		const a = await loadTraAlignment(at(name));
		assert.equal(a.unsupported.length, 0, `${name}: ${JSON.stringify(a.unsupported)}`);
		const chain = createAlignmentPoseJacobian({ elements: a.elements, startPose: a.startPose, momentsFor });
		const miss = Math.hypot(chain.endPose.x - a.endPoint.x, chain.endPose.y - a.endPoint.y);
		assert.ok(miss < 1e-3, `${name}: chain misses the recorded end point by ${miss.toExponential(2)} m over ${chain.arcLength.toFixed(0)} m`);
	}
});

test("a right-hand curve in the file is a right-hand curve in the kernel", { skip }, async () => {
	// R > 0 is a right-hand curve in Verm.esn. Read as 1/R the whole alignment
	// mirrors and misses its end by kilometres; the sign is the loader's, not
	// the parser's, and the chain test above is what holds it.
	const a = await loadTraAlignment(at("eifel/2631R139_Bestand_VR_DBREF03_A.TRA"));
	const first = a.elements.find((e) => e.type === "arc");
	assert.ok(first.curvature < 0, `R = +500 in the file, curvature ${first.curvature} in the kernel`);
});

test("the production geometry and the moment chain agree", { skip }, async () => {
	for (const name of FILES) {
		const a = await loadTraAlignment(at(name));
		const local = { x: 0, y: 0, theta: a.startPose.theta };
		const chain = createAlignmentPoseJacobian({ elements: a.elements, startPose: local, momentsFor });
		const alignment = buildProductionAlignment({ elements: a.elements, startPose: local, deps });
		const p = alignment.poseAt(alignment.arcLength);
		const gap = Math.hypot(p.p.x - chain.endPose.x, p.p.y - chain.endPose.y);
		assert.ok(gap < 1e-3, `${name}: production and chain differ by ${gap.toExponential(2)} m`);
		assert.ok(Math.abs(alignment.arcLength - chain.arcLength) < 1e-6);
	}
});

test("a transition pair meeting at a curvature gets a held arc of zero length", { skip }, async () => {
	const a = await loadTraAlignment(at("Landshut/5500L074-082.TRA"));
	assert.ok(a.insertedJunctionArcs >= 1);
	const junction = a.elements.find((e) => e.held);
	assert.equal(junction.type, "arc");
	assert.equal(junction.length, 0);
	assert.notEqual(junction.curvature, 0);
});

test("the chosen profile admits the truth, with a named exception for every inherited element", { skip }, async () => {
	for (const name of FILES) {
		const a = await loadTraAlignment(at(name));
		const profile = chooseProfile(a.elements, { sourceName: name });
		assert.equal(profile.design.status, "confirmed");
		for (const e of a.elements) {
			if (e.length === 0) continue;
			const floor = profile.design.minimumLengthFor(e.type, e.id);
			assert.ok(e.length >= floor * (1 - 1e-9), `${name} ${e.id}: ${e.type} of ${e.length} m under a floor of ${floor} m`);
			if (e.type === "arc") {
				const cap = profile.design.maximumCurvatureFor(e.id);
				assert.ok(Math.abs(e.curvature) <= cap * (1 + 1e-9), `${name} ${e.id}: |k| ${Math.abs(e.curvature)} above ${cap}`);
			}
		}
		for (const id of profile.design.exceptionIds) {
			assert.match(profile.design.exceptionFor(id).source, /corpus: inherited/);
		}
	}
});

test("the scenario frees what may move and holds what anchors", { skip }, async () => {
	const sc = await createTraScenario(at("Landshut/5500L074-082.TRA"));
	const free = new Set(sc.codec.freeNames);
	assert.ok(!free.has(`${sc.ids[0]}.length`), "the first element anchors poseA and stays held");
	for (const e of sc.truth.elements) {
		if (e.held) {
			assert.ok(!free.has(`${e.id}.length`) && !free.has(`${e.id}.curvature`), `${e.id} is a junction and holds everything`);
		} else if (e.type === "arc") {
			assert.ok(free.has(`${e.id}.curvature`), `${e.id}.curvature`);
		}
	}
	assert.ok(sc.pointCount >= 6);
	// the start is the truth, disturbed: every free quantity within a few percent
	const start = sc.codec.decode(sc.codec.encode());
	for (const e of sc.truth.elements) {
		const patch = start[e.id]; if (!patch || e.held) continue;
		if (Number.isFinite(patch.length)) assert.ok(Math.abs(patch.length / e.length - 1) <= 0.03 + 1e-9, `${e.id}.length`);
	}
});
