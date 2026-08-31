// A nine-element alignment with a measured point cloud, used by the solver
// tests and by the lexicographic driver test. The point cloud is sampled from
// a known truth and disturbed deterministically, so a run is reproducible and
// the recovered curvature can be compared against the value it came from.

const ROOT = new URL("../../../", import.meta.url);
const load = (path) => import(new URL(path, ROOT));

const { buildSparseFromEditModel } = await load("src/aim-core/alignment/aggregate/SparseAlignmentBuilder.js");
const { makeAlignment2DFromSparse } = await load("src/aim-core/alignment/aggregate/AlignmentFactory.js");
const { RegistryResolver } = await load("src/domain/transition/registry/RegistryResolver.js");
const { KappaFcnBuilder } = await load("src/domain/transition/build/KappaFcnBuilder.js");
const { createTransitionMoments, curvatureIntegralFrom } =
	await load("src/domain/optimization/alignment/TransitionMoments.js");
const { createAlignmentPoseJacobian } =
	await load("src/domain/optimization/alignment/AlignmentPoseJacobian.js");
const { createAlignmentVariableCodec } = await load("src/domain/optimization/alignment/AlignmentVariableCodec.js");
const { createAlignmentConstraintBuilder } = await load("src/domain/optimization/alignment/AlignmentConstraintBuilder.js");
const { createAlignmentResidualBuilder } = await load("src/domain/optimization/alignment/AlignmentResidualBuilder.js");
const { createAlignmentOptimizationProblem } = await load("src/domain/optimization/alignment/AlignmentOptimizationProblem.js");
const { createIntrinsicMetricContext } = await load("src/domain/optimization/alignment/MetricContext.js");

const lookup = (await import(new URL("src/domain/transition/transitionLookup.json", ROOT), { with: { type: "json" } })).default;
const deps = { descriptorResolver: new RegistryResolver(lookup), kappaBuilder: KappaFcnBuilder };

export const TYPES = ["straight", "transition", "arc", "transition", "straight", "transition", "arc", "transition", "straight"];
export const TRUE_LENGTHS = [200, 90, 300, 90, 150, 80, 260, 80, 180];
export const TRUE_CURVATURES = [1 / 700, -1 / 900];
const ARC_INDEX = [2, 6];

const momentCache = new Map();
function momentsFor(family = "bloss") {
	const key = family ?? "bloss";
	if (!momentCache.has(key)) {
		const preset = KappaFcnBuilder.buildPresetFromDescriptor(
			deps.descriptorResolver.resolveTransitionDescriptor(key)
		);
		const khat = curvatureIntegralFrom((u) => preset.kappa(Math.max(0, Math.min(1, u))));
		// the pose chain needs KHat itself, not only its moments
		momentCache.set(key, Object.freeze({
			...createTransitionMoments({ id: key, curvatureIntegral: khat }),
			khat,
		}));
	}
	return momentCache.get(key);
}

export function build(lengths, curvatures) {
	const document = buildSparseFromEditModel({
		type: "AlignmentData", id: "s", name: "s", source: { kind: "editor", native: true },
		editModel: {
			startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
			elements: TYPES.map((type, i) => {
				const extra = type === "transition"
					? { transitionType: "bloss" }
					: type === "arc"
						? { curvature: curvatures[ARC_INDEX.indexOf(i)] }
						: {};
				return { id: `E${i}`, type, parameters: { length: lengths[i], ...extra }, length: lengths[i], ...extra };
			}),
		},
	}, deps);
	return makeAlignment2DFromSparse({ startPose: document.startPose, sparse: document.sparse, ...deps }).alignment;
}

const poseOf = (alignment, s) => {
	const pose = alignment.poseAt(s);
	return { x: pose.p.x, y: pose.p.y, theta: Math.atan2(pose.t.y, pose.t.x) };
};

/** A fixed-seed generator, so a run is reproducible without a random source. */
function noise(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return (state / 0x100000000) * 2 - 1;
	};
}

/**
 * @param {object} [input]
 * @param {number} [input.pointCount]
 * @param {number} [input.spread]       lateral disturbance amplitude in metres
 * @param {number} [input.tolerance]    per-point tolerance in metres
 * @param {number[]} [input.startLengths]
 * @param {number[]} [input.startCurvatures]
 */
export function createNineElementScenario({
	pointCount = 40,
	spread = 0.04,
	tolerance = 0.15,
	startLengths = [200, 95, 292, 86, 156, 84, 268, 76, 180],
	startCurvatures = [1 / 660, -1 / 950],
	hardPointNames = [],
	// Tier 3. The truth runs R1 = 700 and R2 = 900 with 80 to 90 m transitions,
	// so these limits admit it comfortably and still forbid the collapse.
	design = { minimumRadius: 600, minimumLength: { straight: 40, arc: 60, transition: 60 } },
} = {}) {
	const truth = build(TRUE_LENGTHS, TRUE_CURVATURES);
	const endPose = poseOf(truth, truth.arcLength);

	const jitter = noise(20250830);
	const points = [];
	for (let i = 0; i < pointCount; i++) {
		const s = (truth.arcLength * (i + 0.5)) / pointCount;
		const pose = truth.poseAt(s);
		const offset = spread * jitter();
		points.push({
			name: `M${i}`,
			x: pose.p.x - offset * pose.t.y,
			y: pose.p.y + offset * pose.t.x,
			tolerance,
			...(hardPointNames.includes(`M${i}`)
				? { kind: "zwangspunkt", enforcement: "hard", target: 0 }
				: {}),
		});
	}

	// E0 and E8 are held: the first anchors poseA, the last is what poseE moves
	// against, and freeing both would make the sequence slide as a whole.
	const codec = createAlignmentVariableCodec({
		elements: TYPES.map((type, i) => ({
			id: `E${i}`,
			quantities: {
				length: i === 0 || i === 8 ? "held" : "free",
				...(type === "arc" ? { curvature: "free" } : {}),
			},
			values: {
				length: startLengths[i],
				...(type === "arc" ? { curvature: startCurvatures[ARC_INDEX.indexOf(i)] } : {}),
			},
		})),
	});

	const problem = createAlignmentOptimizationProblem({
		codec,
		constraints: createAlignmentConstraintBuilder({
			endPose,
			elementSequence: codec.elementSequence,
			minimumElementLength: 20,
			hardPoints: hardPointNames.map((name) => ({ name })),
			elementKinds: Object.fromEntries(TYPES.map((type, i) => [`E${i}`, type])),
			design,
		}),
		residuals: createAlignmentResidualBuilder({
			metricContext: createIntrinsicMetricContext(),
			points,
		}),
	});

	/** Lengths and curvatures for one overlay, in the order the builder wants. */
	const materialise = (overlay) => {
		const lengths = [...startLengths];
		const curvatures = [...startCurvatures];
		TYPES.forEach((_, i) => {
			const patch = overlay[`E${i}`];
			if (!patch) return;
			if (Number.isFinite(patch.length)) lengths[i] = patch.length;
			if (Number.isFinite(patch.curvature)) curvatures[ARC_INDEX.indexOf(i)] = patch.curvature;
		});
		return { lengths, curvatures };
	};

	const buildAlignment = (overlay) => {
		const { lengths, curvatures } = materialise(overlay);
		const alignment = build(lengths, curvatures);
		return {
			lengths,
			curvatures,
			endPose: poseOf(alignment, alignment.arcLength),
			worldToTrack: (x, y) => alignment.world2Track(x, y, { samples: 400, refineSteps: 40 }),
		};
	};

	const analyticJacobian = (overlay) => {
		const { lengths, curvatures } = materialise(overlay);
		return createAlignmentPoseJacobian({
			elements: TYPES.map((type, i) => ({
				id: `E${i}`,
				type,
				length: lengths[i],
				curvature: type === "arc" ? curvatures[ARC_INDEX.indexOf(i)] : undefined,
				family: type === "transition" ? "bloss" : undefined,
			})),
			startPose: { x: 0, y: 0, theta: 0 },
			momentsFor,
		});
	};

	return {
		problem, codec, points, endPose, truth,
		buildAlignment, analyticJacobian, materialise,
		trueTotalLength: TRUE_LENGTHS.reduce((a, b) => a + b, 0),
	};
}
