// src/lib/math/optim/sqp/solveOneEqualitySqpStep.js

import { solveEqualityQP } from "../qp/solveEqualityQP.js";

function addVectors(a, b) {
	return a.map((x, i) => x + b[i]);
}

export function solveOneEqualitySqpStep({
	problem,
	v,
	stepScale = 1.0,
} = {}) {

	if (!problem) {
		return {
			ok: false,
			status: "invalid",
			reason: "missing problem",
		};
	}

	const snap = problem.snapshot(v);

	const qp = solveEqualityQP({
		Q: snap.Q,
		c: snap.gradF,
		A: snap.JG,
		b: snap.G,
	});

	if (!qp.ok) {
		return qp;
	}

	const d = qp.d.map((x) => stepScale * x);

	const vNext = addVectors(v, d);

	const snapNext = problem.snapshot(vNext);

	return {
		ok: true,
		status: "step",

		v,
		d,
		vNext,

		before: {
			F: snap.F,
			G: snap.G,
			H: snap.H,
		},

		after: {
			F: snapNext.F,
			G: snapNext.G,
			H: snapNext.H,
		},

		qp,
	};
}
