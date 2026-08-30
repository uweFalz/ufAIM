import assert from "node:assert/strict";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);
const load = (path) => import(new URL(path, ROOT));

const { buildSparseFromEditModel } = await load("src/aim-core/alignment/aggregate/SparseAlignmentBuilder.js");
const { makeAlignment2DFromSparse } = await load("src/aim-core/alignment/aggregate/AlignmentFactory.js");
const { RegistryResolver } = await load("src/domain/transition/registry/RegistryResolver.js");
const { KappaFcnBuilder } = await load("src/domain/transition/build/KappaFcnBuilder.js");
const lookup = (await import(new URL("src/domain/transition/transitionLookup.json", ROOT), { with: { type: "json" } })).default;
const { createTransitionMoments, curvatureIntegralFrom } =
	await load("src/domain/optimization/alignment/TransitionMoments.js");
const { createAlignmentPoseJacobian } =
	await load("src/domain/optimization/alignment/AlignmentPoseJacobian.js");

const deps = { descriptorResolver: new RegistryResolver(lookup), kappaBuilder: KappaFcnBuilder };

const momentCache = new Map();
function momentsFor(family = "bloss") {
	const key = family ?? "bloss";
	if (momentCache.has(key)) return momentCache.get(key);
	const preset = KappaFcnBuilder.buildPresetFromDescriptor(
		deps.descriptorResolver.resolveTransitionDescriptor(key)
	);
	const khat = curvatureIntegralFrom((u) => preset.kappa(Math.max(0, Math.min(1, u))));
	const built = Object.freeze({
		...createTransitionMoments({ id: key, curvatureIntegral: khat }),
		khat,
	});
	momentCache.set(key, built);
	return built;
}

const TYPES = ["straight", "transition", "arc", "transition", "straight", "transition", "arc", "transition", "straight"];
const LENGTHS = [200, 90, 300, 90, 150, 80, 260, 80, 180];
const CURVATURES = [1 / 700, -1 / 900];

function buildReal(lengths, curvatures) {
	const element = (i) => {
		const type = TYPES[i];
		const extra = type === "transition"
			? { transitionType: "bloss" }
			: type === "arc"
				? { curvature: i === 2 ? curvatures[0] : curvatures[1] }
				: {};
		return { id: `E${i}`, type, parameters: { length: lengths[i], ...extra }, length: lengths[i], ...extra };
	};
	const document = buildSparseFromEditModel({
		type: "AlignmentData", id: "t", name: "t", source: { kind: "editor", native: true },
		editModel: {
			startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
			elements: TYPES.map((_, i) => element(i)),
		},
	}, deps);
	return makeAlignment2DFromSparse({ startPose: document.startPose, sparse: document.sparse, ...deps }).alignment;
}

function buildAnalytic(lengths, curvatures) {
	return createAlignmentPoseJacobian({
		elements: TYPES.map((type, i) => ({
			id: `E${i}`,
			type,
			length: lengths[i],
			curvature: type === "arc" ? (i === 2 ? curvatures[0] : curvatures[1]) : undefined,
			family: type === "transition" ? "bloss" : undefined,
		})),
		startPose: { x: 0, y: 0, theta: 0 },
		momentsFor,
	});
}

const poseOf = (alignment, s) => {
	const pose = alignment.poseAt(s);
	return { x: pose.p.x, y: pose.p.y, theta: Math.atan2(pose.t.y, pose.t.x) };
};

// ---------------------------------------------------------------- moments

test("the moment series reproduces the transition element of the geometry kernel", () => {
	// closed form L * [C(a,b), S(a,b)] against the production TransitionElement,
	// including a transition running between two non-zero curvatures of opposite sign
	const cases = [
		["bloss", 90, 0, 1 / 700],
		["bloss", 90, 1 / 700, 0],
		["bloss", 120, 1 / 900, -1 / 600],
		["clothoid", 90, 0, 1 / 700],
		["watorek", 80, 0, -1 / 500],
	];
	for (const [family, length, entry, exit] of cases) {
		const cap = (id, curvature, len) => (curvature === 0
			? { id, type: "straight", parameters: { length: len }, length: len }
			: { id, type: "arc", parameters: { length: len, curvature }, length: len, curvature });
		const eps = 1e-4;
		const document = buildSparseFromEditModel({
			type: "AlignmentData", id: "x", name: "x", source: { kind: "editor", native: true },
			editModel: {
				startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
				elements: [
					cap("A", entry, eps),
					{ id: "T", type: "transition", parameters: { length, transitionType: family }, length, transitionType: family },
					cap("B", exit, eps),
				],
			},
		}, deps);
		const alignment = makeAlignment2DFromSparse({ startPose: document.startPose, sparse: document.sparse, ...deps }).alignment;
		const before = poseOf(alignment, eps);
		const after = poseOf(alignment, eps + length);
		const dx = after.x - before.x;
		const dy = after.y - before.y;
		const reference = {
			dx: dx * Math.cos(before.theta) + dy * Math.sin(before.theta),
			dy: -dx * Math.sin(before.theta) + dy * Math.cos(before.theta),
			dtheta: after.theta - before.theta,
		};
		const closed = momentsFor(family).element(length, entry, exit);
		for (const key of ["dx", "dy", "dtheta"]) {
			assert.ok(
				Math.abs(closed[key] - reference[key]) < 1e-8,
				`${family} ${key}: closed form ${closed[key]}, element ${reference[key]}`
			);
		}
	}
});

// ---------------------------------------------------------------- forward chain

test("the analytic chain reproduces the geometry kernel's poses", () => {
	const real = buildReal(LENGTHS, CURVATURES);
	const analytic = buildAnalytic(LENGTHS, CURVATURES);
	assert.ok(Math.abs(analytic.arcLength - real.arcLength) < 1e-9, "arc length");
	let worst = 0;
	for (let i = 1; i <= 20; i++) {
		const s = (real.arcLength * i) / 21;
		const a = analytic.poseAt(s);
		const b = poseOf(real, s);
		worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
	}
	assert.ok(worst < 1e-8, `worst pose deviation ${worst}`);
});

// ---------------------------------------------------------------- Jacobian

test("the end-pose Jacobian matches central differences of the geometry kernel", () => {
	const analytic = buildAnalytic(LENGTHS, CURVATURES);
	const parameters = [];
	for (let i = 1; i <= 7; i++) parameters.push({ elementIndex: i, kind: "length" });
	parameters.push({ elementIndex: 2, kind: "curvature" }, { elementIndex: 6, kind: "curvature" });

	const rows = analytic.endPoseJacobian(parameters);

	parameters.forEach((parameter, index) => {
		const step = parameter.kind === "length" ? 1e-4 : 1e-10;
		const bump = (sign) => {
			const lengths = [...LENGTHS];
			const curvatures = [...CURVATURES];
			if (parameter.kind === "length") lengths[parameter.elementIndex] += sign * step;
			else curvatures[parameter.elementIndex === 2 ? 0 : 1] += sign * step;
			const alignment = buildReal(lengths, curvatures);
			return poseOf(alignment, alignment.arcLength);
		};
		const plus = bump(1);
		const minus = bump(-1);
		const reference = {
			dx: (plus.x - minus.x) / (2 * step),
			dy: (plus.y - minus.y) / (2 * step),
			dtheta: (plus.theta - minus.theta) / (2 * step),
		};
		const scale = Math.max(Math.abs(reference.dx), Math.abs(reference.dy), Math.abs(reference.dtheta), 1e-9);
		for (const key of ["dx", "dy", "dtheta"]) {
			assert.ok(
				Math.abs(rows[index][key] - reference[key]) / scale < 1e-6,
				`${parameter.elementIndex}.${parameter.kind} ${key}: `
					+ `analytic ${rows[index][key]}, differenced ${reference[key]}`
			);
		}
	});
});

test("the lateral derivative matches central differences, and vanishes upstream", () => {
	const real = buildReal(LENGTHS, CURVATURES);
	const analytic = buildAnalytic(LENGTHS, CURVATURES);
	const parameters = [];
	for (let i = 1; i <= 7; i++) parameters.push({ elementIndex: i, kind: "length" });
	parameters.push({ elementIndex: 2, kind: "curvature" });

	for (const fraction of [0.28, 0.6, 0.93]) {
		const s = real.arcLength * fraction;
		const pose = real.poseAt(s);
		const normal = { x: -pose.t.y, y: pose.t.x };
		const point = { x: pose.p.x + 0.05 * normal.x, y: pose.p.y + 0.05 * normal.y };
		const foot = real.world2Track(point.x, point.y, { samples: 800, refineSteps: 80 });

		const rows = analytic.lateralDerivative(parameters, foot.s);
		const references = parameters.map((parameter) => {
			const step = parameter.kind === "length" ? 1e-3 : 1e-9;
			const bump = (sign) => {
				const lengths = [...LENGTHS];
				const curvatures = [...CURVATURES];
				if (parameter.kind === "length") lengths[parameter.elementIndex] += sign * step;
				else curvatures[0] += sign * step;
				return buildReal(lengths, curvatures)
					.world2Track(point.x, point.y, { samples: 800, refineSteps: 80 }).q;
			};
			return (bump(1) - bump(-1)) / (2 * step);
		});

		// scale by the largest entry: many entries are exactly zero because the
		// parameter lies downstream of the station, and a relative test on those
		// only measures the reference's own noise
		const scale = Math.max(...rows.map(Math.abs), ...references.map(Math.abs), 1e-30);
		const worst = Math.max(...rows.map((value, i) => Math.abs(value - references[i]))) / scale;
		assert.ok(worst < 1e-6, `station ${s}: scaled deviation ${worst}`);
	}
});

test("a parameter downstream of a station does not move it", () => {
	const analytic = buildAnalytic(LENGTHS, CURVATURES);
	// element 5 starts at 200 + 90 + 300 + 90 + 150 = 830 m
	const rows = analytic.lateralDerivative([{ elementIndex: 5, kind: "length" }], 640);
	// -0 is a legitimate result and strictEqual would reject it
	assert.ok(rows[0] === 0, "a change at 830 m cannot move the curve at 640 m");

	const downstream = analytic.lateralDerivative([{ elementIndex: 5, kind: "length" }], 1000);
	assert.ok(Math.abs(downstream[0]) > 0, "but it does move a station beyond it");
});

test("an arc curvature reaches the transitions on either side", () => {
	// the coupling that makes one declared parameter move three elements
	const analytic = buildAnalytic(LENGTHS, CURVATURES);
	const stationAfterE1 = analytic.stations[2];   // exit of the first transition
	const rows = analytic.lateralDerivative([{ elementIndex: 2, kind: "curvature" }], stationAfterE1);
	assert.ok(
		Math.abs(rows[0]) > 0,
		"the curvature of arc E2 already moves the exit of transition E1, which inherits it"
	);
});
