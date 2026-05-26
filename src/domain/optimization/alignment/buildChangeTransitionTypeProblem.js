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

const EPS_Q = 1e-9;

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

// Bloss normalized curvature shape 0 -> 1.
// Common quintic smoothstep: 10u^3 - 15u^4 + 6u^5.
// If your Bloss definition differs, replace only this function.
function bloss01(u) {
	return 10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5;
}

export function evaluateLineBlossArc({
	poseA,
	Lg,
	Lu,
	Lb,
	kB,
	transitionSteps = 32,
}) {
	const p0 = typeof poseA.theta === "number"
		? poseA
		: poseFromAngle(poseA.p, poseA.dirAngle ?? 0);

	const afterG = advanceLine(p0, Lg);

	const afterU = advanceTransition(
		afterG,
		Lu,
		(u) => kB * bloss01(u),
		transitionSteps
	);

	const end = advanceArc(afterU, Lb, kB);

	return {
		startPose: p0,
		afterG,
		afterU,
		endPose: end,
	};
}

export function buildChangeTransitionTypeProblem({
	poseA,
	poseE,
	initial,
	kB,
	minLengths = {},
	transitionSteps = 32,
	regularization = 1e-9,
} = {}) {
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
	// δL_g -> tangent at end of line, no direct rotation
	// δL_u -> tangent at end of transition, rotation kB
	// δL_b -> tangent at end of arc, rotation kB
	function JG(v) {
		const ev = evaluate(v);

		const tg = ev.afterG.t;
		const tu = ev.afterU.t;
		const tb = ev.endPose.t;

		return [
			[tg.x, tu.x, tb.x],
			[tg.y, tu.y, tb.y],
			[0,    kB,   kB],
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
