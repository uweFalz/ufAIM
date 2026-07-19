// src/domain/optimization/alignment/buildChangeTransitionTypeProblem.js
//
// First explicit AIM/SQP problem builder:
// change transition type while preserving end pose.
//
// Example:
//   Fixed(k=0, Lg) -> Transition(type=Bloss, Lu, k0=0, k1=kB) -> Fixed(k=kB, Lb)
//
// NLP:
//   min F(v) = sum(Li)
//   G(v) = endPose(v) - poseE = 0
//   H(v) <= 0  length lower bounds
//
// SQP snapshot:
//   F, gradF, G, H, JG, JH, Q

import transitionLookup from "../../transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "../../transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "../../transition/build/KappaFcnBuilder.js";

const EPS_Q = 1e-9;

const DEFAULT_TRANSITION_TYPE = "bloss";
const defaultDescriptorResolver = new RegistryResolver(transitionLookup);

function clamp01(u) {
	const x = Number(u);
	if (!Number.isFinite(x)) return 0;
	return Math.max(0, Math.min(1, x));
}

function angleWrap(a) {
	while (a > Math.PI) a -= 2 * Math.PI;
	while (a < -Math.PI) a += 2 * Math.PI;
	return a;
}

function poseFromAngle(p, theta) {
	return {
		p: { x: p.x, y: p.y },
		theta,
		t: { x: Math.cos(theta), y: Math.sin(theta) },
		n: { x: -Math.sin(theta), y: Math.cos(theta) },
	};
}

function advanceLine(pose, L) {
	return poseFromAngle({
		x: pose.p.x + L * Math.cos(pose.theta),
		y: pose.p.y + L * Math.sin(pose.theta),
	}, pose.theta);
}

function advanceArc(pose, L, kappa) {
	if (Math.abs(kappa) < 1e-12) return advanceLine(pose, L);

	const th0 = pose.theta;
	const th1 = th0 + kappa * L;

	const x = pose.p.x + (Math.sin(th1) - Math.sin(th0)) / kappa;
	const y = pose.p.y - (Math.cos(th1) - Math.cos(th0)) / kappa;

	return poseFromAngle({ x, y }, th1);
}

// Simple numerical integration for arbitrary transition curvature.
// Good enough as first kernel; later replace with registry/kappaInt-aware evaluator.
function advanceTransition(pose, L, kappaAt01, steps = 32) {
	let x = pose.p.x;
	let y = pose.p.y;
	let theta = pose.theta;

	const ds = L / steps;

	for (let i = 0; i < steps; i++) {
		const uMid = (i + 0.5) / steps;
		const k = kappaAt01(uMid);

		theta += k * ds;
		x += Math.cos(theta) * ds;
		y += Math.sin(theta) * ds;
	}

	return poseFromAngle({ x, y }, theta);
}

function integrate01(fn, steps = 256) {
	const n = Math.max(16, Number(steps) || 256);
	let sum = 0;

	for (let i = 0; i < n; i++) {
		const u = (i + 0.5) / n;
		const value = Number(fn(u));
		if (!Number.isFinite(value)) {
			throw new Error("buildChangeTransitionTypeProblem: transition shape returned non-finite value");
		}
		sum += value;
	}

	return sum / n;
}

function resolveTransitionKappa01({
	transitionType = DEFAULT_TRANSITION_TYPE,
	transitionKappa01,
	transitionPreset,
	descriptorResolver = defaultDescriptorResolver,
	kappaBuilder = KappaFcnBuilder,
} = {}) {
	if (typeof transitionKappa01 === "function") {
		return {
			transitionType: "custom",
			kappa01: (u) => Number(transitionKappa01(clamp01(u))),
		};
	}

	if (transitionPreset?.kappa) {
		return {
			transitionType: String(transitionType ?? DEFAULT_TRANSITION_TYPE).toLowerCase(),
			kappa01: (u) => Number(transitionPreset.kappa(clamp01(u))),
		};
	}

	const resolvedType = String(transitionType ?? DEFAULT_TRANSITION_TYPE).toLowerCase();
	const descriptor = descriptorResolver.resolveTransitionDescriptor(resolvedType);
	const runtimePreset = kappaBuilder.buildPresetFromDescriptor(descriptor);

	if (!runtimePreset?.kappa) {
		throw new Error(`buildChangeTransitionTypeProblem: transition \"${resolvedType}\" has no runtime kappa`);
	}

	return {
		transitionType: resolvedType,
		kappa01: (u) => Number(runtimePreset.kappa(clamp01(u))),
	};
}

export function evaluateLineBlossArc({
	poseA,
	Lg,
	Lu,
	Lb,
	kB,
	transitionType = DEFAULT_TRANSITION_TYPE,
	transitionKappa01,
	transitionPreset,
	descriptorResolver = defaultDescriptorResolver,
	kappaBuilder = KappaFcnBuilder,
	transitionSteps = 32,
}) {
	const transition = resolveTransitionKappa01({
		transitionType,
		transitionKappa01,
		transitionPreset,
		descriptorResolver,
		kappaBuilder,
	});

	const p0 = typeof poseA.theta === "number"
		? poseA
		: poseFromAngle(poseA.p, poseA.dirAngle ?? 0);

	const afterG = advanceLine(p0, Lg);

	const afterU = advanceTransition(
		afterG,
		Lu,
		(u) => kB * transition.kappa01(u),
		transitionSteps
	);

	const end = advanceArc(afterU, Lb, kB);

	return {
		startPose: p0,
		afterG,
		afterU,
		endPose: end,
		transitionType: transition.transitionType,
	};
}

export function buildChangeTransitionTypeProblem({
	poseA,
	poseE,
	initial,
	kB,
	transitionType = DEFAULT_TRANSITION_TYPE,
	transitionKappa01,
	transitionPreset,
	descriptorResolver = defaultDescriptorResolver,
	kappaBuilder = KappaFcnBuilder,
	minLengths = {},
	transitionSteps = 32,
	regularization = 1e-9,
} = {}) {
	const transition = resolveTransitionKappa01({
		transitionType,
		transitionKappa01,
		transitionPreset,
		descriptorResolver,
		kappaBuilder,
	});

	const thetaIntegral = integrate01(
		transition.kappa01,
		Math.max(128, transitionSteps * 8)
	);

	const thetaPerLu = Number.isFinite(thetaIntegral)
		? kB * thetaIntegral
		: kB;

	const names = ["Lg", "Lu", "Lb"];

	const x0 = [
		Number(initial?.Lg ?? 0),
		Number(initial?.Lu ?? 0),
		Number(initial?.Lb ?? 0),
	];

	const Lmin = [
		Number(minLengths?.Lg ?? 0),
		Number(minLengths?.Lu ?? 0),
		Number(minLengths?.Lb ?? 0),
	];

	function unpack(v) {
		return { Lg: v[0], Lu: v[1], Lb: v[2] };
	}

	function evaluate(v) {
		const { Lg, Lu, Lb } = unpack(v);

		return evaluateLineBlossArc({
			poseA,
			Lg,
			Lu,
			Lb,
			kB,
			transitionType: transition.transitionType,
			transitionKappa01: transition.kappa01,
			transitionSteps,
		});
	}

	function F(v) {
		return v[0] + v[1] + v[2];
	}

	function gradF() {
		return [1, 1, 1];
	}

	function G(v) {
		const ev = evaluate(v);
		const end = ev.endPose;

		return [
			end.p.x - poseE.p.x,
			end.p.y - poseE.p.y,
			angleWrap(end.theta - poseE.theta),
		];
	}

	function H(v) {
		return [
			Lmin[0] - v[0],
			Lmin[1] - v[1],
			Lmin[2] - v[2],
		];
	}

	// Analytic first-order Jacobian:
	// Use central finite differences for x/y residual rows to stay consistent
	// with transition families and numerical transition integration. Keep the
	// theta row explicit from curvature accumulation.
	function JG(v) {
		const h = 1e-5;
		const base = [...v];
		const cols = [0, 1, 2].map((j) => {
			const vp = [...base];
			const vm = [...base];
			vp[j] += h;
			vm[j] -= h;

			const gp = G(vp);
			const gm = G(vm);

			return [
				(gp[0] - gm[0]) / (2 * h),
				(gp[1] - gm[1]) / (2 * h),
			];
		});

		return [
			[cols[0][0], cols[1][0], cols[2][0]],
			[cols[0][1], cols[1][1], cols[2][1]],
			[0,    thetaPerLu,   kB],
		];
	}

	function JH() {
		return [
			[-1, 0, 0],
			[0, -1, 0],
			[0, 0, -1],
		];
	}

	function Q(v) {
		const J = JG(v);
		const q = [
			[0, 0, 0],
			[0, 0, 0],
			[0, 0, 0],
		];

		// Q = JG^T JG + eps I
		for (let r = 0; r < 3; r++) {
			for (let i = 0; i < 3; i++) {
				for (let j = 0; j < 3; j++) {
					q[i][j] += J[r][i] * J[r][j];
				}
			}
		}

		for (let i = 0; i < 3; i++) {
			q[i][i] += regularization ?? EPS_Q;
		}

		return q;
	}

	function snapshot(v = x0) {
		return {
			names,
			v: [...v],
			F: F(v),
			gradF: gradF(v),
			G: G(v),
			H: H(v),
			JG: JG(v),
			JH: JH(v),
			Q: Q(v),
			evaluation: evaluate(v),
		};
	}

	return {
		type: "alignment.changeTransitionType.lineBlossArc",
		transitionType: transition.transitionType,
		names,
		x0,
		F,
		gradF,
		G,
		H,
		JG,
		JH,
		Q,
		evaluate,
		snapshot,
	};
}
