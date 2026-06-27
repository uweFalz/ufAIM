// src/lib/math/optim/sqp/solveEqualitySqp.js
//
// Experimental AXTRAN2 / AIM SQP loop.
//
// Boundary:
// - solver-internal only
// - proposal/candidate/diagnostics output only
// - no AlignmentData mutation
// - no SPOT mutation
// - no Workspace mutation
// - no canonical data mutation
//
// Equality SQP with backtracking line search + trust region control.

import { solveOneEqualitySqpStep } from "./solveOneEqualitySqpStep.js";

function norm2(xs = []) {
	return Math.hypot(...xs);
}

function finiteArray(xs) {
	return Array.isArray(xs) && xs.every(Number.isFinite);
}

function vecAdd(a = [], b = []) {
	return a.map((x, i) => x + b[i]);
}

function vecScale(a = [], s = 1) {
	return a.map((x) => x * s);
}

function maxInequalityViolation(H = []) {
	if (!Array.isArray(H) || H.length === 0) return 0;

	let m = 0;

	for (const h of H) {
		if (!Number.isFinite(h)) return Number.POSITIVE_INFINITY;
		if (h > m) m = h;
	}

	return m;
}

function meritOfSnapshot(snap, { inequalityWeight = 10.0 } = {}) {
	const gNorm = norm2(snap?.G ?? []);
	const hViolation = maxInequalityViolation(snap?.H ?? []);

	return {
		value: gNorm + inequalityWeight * hViolation,
		gNorm,
		hViolation,
		F: snap?.F,
	};
}

function estimateMatrixRank(A, { tolerance = 1e-10 } = {}) {
	if (!Array.isArray(A) || A.length === 0) return 0;

	const M = A.map((row) => Array.isArray(row) ? row.slice() : []);
	const rows = M.length;
	const cols = Math.max(...M.map((row) => row.length));

	let rank = 0;
	let r = 0;

	for (let c = 0; c < cols && r < rows; c++) {
		let pivot = r;
		let pivotAbs = Math.abs(M[r]?.[c] ?? 0);

		for (let i = r + 1; i < rows; i++) {
			const v = Math.abs(M[i]?.[c] ?? 0);
			if (v > pivotAbs) {
				pivot = i;
				pivotAbs = v;
			}
		}

		if (pivotAbs <= tolerance) continue;

		if (pivot !== r) {
			[M[r], M[pivot]] = [M[pivot], M[r]];
		}

		const div = M[r][c];

		for (let j = c; j < cols; j++) {
			M[r][j] /= div;
		}

		for (let i = 0; i < rows; i++) {
			if (i === r) continue;

			const factor = M[i]?.[c] ?? 0;
			if (Math.abs(factor) <= tolerance) continue;

			for (let j = c; j < cols; j++) {
				M[i][j] -= factor * M[r][j];
			}
		}

		rank++;
		r++;
	}

	return rank;
}

function makeCandidate({ v, snap } = {}) {
	return {
		type: "candidate",
		variables: Array.isArray(v) ? v.slice() : [],
		objective: snap?.F ?? null,
		constraints: {
			equality: Array.isArray(snap?.G) ? snap.G.slice() : [],
			inequality: Array.isArray(snap?.H) ? snap.H.slice() : [],
		},
	};
}

function makeProposal({
	status,
	v,
	snap,
	history,
	message = null,
	finalTrustRadius = null,
} = {}) {
	return {
		type: "proposal",
		status,
		candidate: makeCandidate({ v, snap }),
		delta: null,
		diagnostics: {
			type: "diagnostics",
			message,
			iterations: Array.isArray(history) ? history.length : 0,
			history: Array.isArray(history) ? history : [],
			gNorm: norm2(snap?.G ?? []),
			hViolation: maxInequalityViolation(snap?.H ?? []),
			objective: snap?.F ?? null,
			finalTrustRadius,
		},
	};
}

function makeResult({
	ok,
	status,
	reason = null,
	v,
	iterations,
	snap,
	merit,
	history,
	message = null,
	finalTrustRadius = null,
	extra = {},
} = {}) {
	const proposal = makeProposal({
		status,
		v,
		snap,
		history,
		message,
		finalTrustRadius,
	});

	return {
		ok,
		status,
		reason,
		v,
		iterations,
		F: snap?.F ?? null,
		G: snap?.G ?? [],
		H: snap?.H ?? [],
		gNorm: merit?.gNorm ?? norm2(snap?.G ?? []),
		hMax: Math.max(...(snap?.H ?? [0])),
		hViolation: merit?.hViolation ?? maxInequalityViolation(snap?.H ?? []),
		merit: merit?.value ?? null,
		history,
		finalTrustRadius,
		proposal,
		candidate: proposal.candidate,
		delta: null,
		diagnostics: proposal.diagnostics,
		...extra,
	};
}

function computeRawStep({ problem, v } = {}) {
	const step = solveOneEqualitySqpStep({
		problem,
		v,
		stepScale: 1.0,
	});

	if (!step.ok || !finiteArray(step.d)) {
		return {
			ok: false,
			reason: step.reason ?? step.status ?? "step_failed",
			step,
		};
	}

	return {
		ok: true,
		step,
		d: step.d.slice(),
		rawStepNorm: norm2(step.d),
	};
}

function clipStepToTrustRegion(d = [], trustRadius = Number.POSITIVE_INFINITY) {
	const rawStepNorm = norm2(d);

	if (!Number.isFinite(rawStepNorm)) {
		return {
			ok: false,
			reason: "raw_step_norm_not_finite",
			d: [],
			rawStepNorm,
			clippedStepNorm: null,
			trustScale: 0,
			stepClipped: false,
		};
	}

	if (!Number.isFinite(trustRadius) || trustRadius <= 0) {
		return {
			ok: false,
			reason: "invalid_trust_radius",
			d: [],
			rawStepNorm,
			clippedStepNorm: null,
			trustScale: 0,
			stepClipped: false,
		};
	}

	if (rawStepNorm === 0 || rawStepNorm <= trustRadius) {
		return {
			ok: true,
			d: d.slice(),
			rawStepNorm,
			clippedStepNorm: rawStepNorm,
			trustScale: 1,
			stepClipped: false,
		};
	}

	const trustScale = trustRadius / rawStepNorm;
	const clipped = vecScale(d, trustScale);

	return {
		ok: true,
		d: clipped,
		rawStepNorm,
		clippedStepNorm: norm2(clipped),
		trustScale,
		stepClipped: true,
	};
}

function makeIterationRecord({
	iteration,
	v,
	snap,
	merit,
	rankEstimate,
	trustRadius,
	status = "evaluated",
	rawStepNorm = null,
	clippedStepNorm = null,
	stepNorm = null,
	stepClipped = null,
	trustScale = null,
	radiusAction = "none",
	trustRegionRetries = 0,
	alpha = null,
	backtracks = null,
	nextMerit = null,
	nextGNorm = null,
	nextHViolation = null,
	reason = null,
} = {}) {
	return {
		iteration,
		v: Array.isArray(v) ? v.slice() : [],
		F: snap?.F ?? null,
		G: Array.isArray(snap?.G) ? snap.G.slice() : [],
		H: Array.isArray(snap?.H) ? snap.H.slice() : [],
		gNorm: merit?.gNorm ?? null,
		hViolation: merit?.hViolation ?? null,
		merit: merit?.value ?? null,
		rankEstimate,
		trustRadius,
		rawStepNorm,
		clippedStepNorm,
		stepNorm,
		stepClipped,
		trustScale,
		radiusAction,
		trustRegionRetries,
		alpha,
		backtracks,
		nextMerit,
		nextGNorm,
		nextHViolation,
		reason,
		status,
	};
}

function tryTrustLineSearch({
	problem,
	v,
	baseMerit,
	rawStep,
	trustRadius,
	maxBacktracks,
	minStepScale,
	acceptanceTolerance,
	inequalityWeight,
} = {}) {
	const clipped = clipStepToTrustRegion(rawStep?.d ?? [], trustRadius);

	if (!clipped.ok) {
		return {
			ok: false,
			status: "trust_region_failed",
			lastRejected: {
				alpha: null,
				reason: clipped.reason,
				rawStepNorm: clipped.rawStepNorm,
				clippedStepNorm: clipped.clippedStepNorm,
				stepNorm: null,
				stepClipped: clipped.stepClipped,
				trustScale: clipped.trustScale,
			},
		};
	}

	let lastRejected = null;

	for (let bt = 0; bt <= maxBacktracks; bt++) {
		const alpha = 1 / (2 ** bt);

		if (alpha < minStepScale) break;

		const dAlpha = vecScale(clipped.d, alpha);
		const vNext = vecAdd(v, dAlpha);
		const stepNorm = norm2(dAlpha);

		if (!finiteArray(vNext)) {
			lastRejected = {
				alpha,
				reason: "v_next_not_finite",
				rawStepNorm: clipped.rawStepNorm,
				clippedStepNorm: clipped.clippedStepNorm,
				stepNorm,
				stepClipped: clipped.stepClipped,
				trustScale: clipped.trustScale,
			};
			continue;
		}

		const snapNext = problem.snapshot(vNext);
		const nextMerit = meritOfSnapshot(snapNext, { inequalityWeight });

		if (!Number.isFinite(nextMerit.value)) {
			lastRejected = {
				alpha,
				reason: "next_merit_not_finite",
				vNext,
				nextMerit,
				rawStepNorm: clipped.rawStepNorm,
				clippedStepNorm: clipped.clippedStepNorm,
				stepNorm,
				stepClipped: clipped.stepClipped,
				trustScale: clipped.trustScale,
			};
			continue;
		}

		const improved = nextMerit.value < baseMerit.value - acceptanceTolerance;

		if (improved) {
			return {
				ok: true,
				alpha,
				backtracks: bt,
				vNext,
				d: dAlpha,
				snapNext,
				nextMerit,
				rawStepNorm: clipped.rawStepNorm,
				clippedStepNorm: clipped.clippedStepNorm,
				stepNorm,
				stepClipped: clipped.stepClipped,
				trustScale: clipped.trustScale,
			};
		}

		lastRejected = {
			alpha,
			reason: "merit_not_improved",
			vNext,
			nextMerit,
			rawStepNorm: clipped.rawStepNorm,
			clippedStepNorm: clipped.clippedStepNorm,
			stepNorm,
			stepClipped: clipped.stepClipped,
			trustScale: clipped.trustScale,
		};
	}

	return {
		ok: false,
		status: "line_search_failed",
		lastRejected,
	};
}

export function solveEqualitySqp({
	problem,
	v0,
	maxIterations = 20,
	tolerance = 1e-9,
	inequalityTolerance = 1e-9,
	stepTolerance = 1e-9,
	stationaryTolerance = 1e-8,

	initialTrustRadius = 1.0,
	minTrustRadius = 1e-8,
	maxTrustRadius = 100.0,
	trustShrink = 0.5,
	trustExpand = 1.5,

	maxBacktracks = 12,
	minStepScale = 1e-6,
	acceptanceTolerance = 1e-14,
	inequalityWeight = 10.0,
	rankTolerance = 1e-10,
} = {}) {
	if (!problem) {
		const snap = { F: null, G: [], H: [] };
		const history = [];

		return makeResult({
			ok: false,
			status: "invalid",
			reason: "missing problem",
			v: [],
			iterations: 0,
			snap,
			merit: meritOfSnapshot(snap, { inequalityWeight }),
			history,
			message: "missing problem",
			finalTrustRadius: null,
		});
	}

	if (!finiteArray(v0)) {
		const snap = { F: null, G: [], H: [] };
		const history = [];

		return makeResult({
			ok: false,
			status: "invalid",
			reason: "invalid v0",
			v: [],
			iterations: 0,
			snap,
			merit: meritOfSnapshot(snap, { inequalityWeight }),
			history,
			message: "invalid v0",
			finalTrustRadius: null,
		});
	}

	let v = v0.slice();
	let trustRadius = Math.min(
		Math.max(initialTrustRadius, minTrustRadius),
		maxTrustRadius
	);

	const history = [];

	for (let k = 0; k < maxIterations; k++) {
		const snap = problem.snapshot(v);
		const merit = meritOfSnapshot(snap, { inequalityWeight });
		const rankEstimate = estimateMatrixRank(snap?.JG, {
			tolerance: rankTolerance,
		});

		const record = makeIterationRecord({
			iteration: k,
			v,
			snap,
			merit,
			rankEstimate,
			trustRadius,
		});

		history.push(record);

		if (merit.gNorm <= tolerance && merit.hViolation <= inequalityTolerance) {
			record.status = "converged";

			return makeResult({
				ok: true,
				status: "converged",
				v,
				iterations: k,
				snap,
				merit,
				history,
				finalTrustRadius: trustRadius,
			});
		}

		const rawStep = computeRawStep({ problem, v });

		if (!rawStep.ok) {
			record.status = "step_failed";
			record.reason = rawStep.reason ?? "step failed";
			record.rawStepNorm = rawStep.rawStepNorm ?? null;

			return makeResult({
				ok: false,
				status: "step_failed",
				reason: rawStep.reason ?? "step failed",
				v,
				iterations: k,
				snap,
				merit,
				history,
				message: rawStep.reason ?? "step failed",
				finalTrustRadius: trustRadius,
				extra: { rawStep },
			});
		}

		let accepted = null;
		let rejected = null;
		let trustRegionRetries = 0;
		let radiusAction = "none";

		while (trustRadius >= minTrustRadius) {
			accepted = tryTrustLineSearch({
				problem,
				v,
				baseMerit: merit,
				rawStep,
				trustRadius,
				maxBacktracks,
				minStepScale,
				acceptanceTolerance,
				inequalityWeight,
			});

			if (accepted.ok) break;

			rejected = accepted;
			trustRegionRetries += 1;
			trustRadius = Math.max(minTrustRadius, trustRadius * trustShrink);
			radiusAction = "shrink";

			if (trustRadius <= minTrustRadius) break;
		}

		if (!accepted?.ok) {
			const lastRejected = rejected?.lastRejected ?? accepted?.lastRejected ?? null;
			const rejectedStepNorm = lastRejected?.stepNorm ?? rawStep.rawStepNorm ?? null;

			record.status = "trust_region_failed";
			record.reason = lastRejected?.reason ?? "trust region failed";
			record.rawStepNorm = lastRejected?.rawStepNorm ?? rawStep.rawStepNorm ?? null;
			record.clippedStepNorm = lastRejected?.clippedStepNorm ?? null;
			record.stepNorm = rejectedStepNorm;
			record.stepClipped = lastRejected?.stepClipped ?? null;
			record.trustScale = lastRejected?.trustScale ?? null;
			record.radiusAction = radiusAction;
			record.trustRegionRetries = trustRegionRetries;
			record.alpha = lastRejected?.alpha ?? null;
			record.nextMerit = lastRejected?.nextMerit?.value ?? null;
			record.nextGNorm = lastRejected?.nextMerit?.gNorm ?? null;
			record.nextHViolation = lastRejected?.nextMerit?.hViolation ?? null;

			if (
				Number.isFinite(rejectedStepNorm) &&
				rejectedStepNorm <= stepTolerance &&
				merit.gNorm <= stationaryTolerance &&
				merit.hViolation <= inequalityTolerance
			) {
				record.status = "stationary";
				record.reason = "tiny step and small residual";

				return makeResult({
					ok: true,
					status: "stationary",
					reason: "tiny step and small residual",
					v,
					iterations: k,
					snap,
					merit,
					history,
					message: "tiny step and small residual",
					finalTrustRadius: trustRadius,
					extra: { lastRejected },
				});
			}

			return makeResult({
				ok: false,
				status: "trust_region_failed",
				reason: lastRejected?.reason ?? "trust region failed",
				v,
				iterations: k,
				snap,
				merit,
				history,
				message: lastRejected?.reason ?? "trust region failed",
				finalTrustRadius: trustRadius,
				extra: { lastRejected },
			});
		}

		const acceptedFullStep =
			accepted.alpha === 1 &&
			accepted.stepClipped === false &&
			accepted.backtracks <= 1;

		if (acceptedFullStep) {
			trustRadius = Math.min(maxTrustRadius, trustRadius * trustExpand);
			radiusAction = "expand";
		} else {
			trustRadius = Math.max(minTrustRadius, trustRadius * trustShrink);
			radiusAction = "shrink";
		}

		record.alpha = accepted.alpha;
		record.backtracks = accepted.backtracks;
		record.status = "accepted";
		record.rawStepNorm = accepted.rawStepNorm;
		record.clippedStepNorm = accepted.clippedStepNorm;
		record.stepNorm = accepted.stepNorm;
		record.stepClipped = accepted.stepClipped;
		record.trustScale = accepted.trustScale;
		record.radiusAction = radiusAction;
		record.trustRegionRetries = trustRegionRetries;
		record.nextMerit = accepted.nextMerit.value;
		record.nextGNorm = accepted.nextMerit.gNorm;
		record.nextHViolation = accepted.nextMerit.hViolation;

		if (
			Number.isFinite(accepted.stepNorm) &&
			accepted.stepNorm <= stepTolerance &&
			accepted.nextMerit.gNorm <= stationaryTolerance &&
			accepted.nextMerit.hViolation <= inequalityTolerance
		) {
			v = accepted.vNext.slice();

			const snapNext = problem.snapshot(v);
			const meritNext = meritOfSnapshot(snapNext, { inequalityWeight });

			return makeResult({
				ok: true,
				status: "stationary",
				reason: "accepted tiny step and small residual",
				v,
				iterations: k + 1,
				snap: snapNext,
				merit: meritNext,
				history,
				message: "accepted tiny step and small residual",
				finalTrustRadius: trustRadius,
			});
		}

		v = accepted.vNext.slice();
	}

	const snap = problem.snapshot(v);
	const merit = meritOfSnapshot(snap, { inequalityWeight });

	return makeResult({
		ok: false,
		status: "max_iterations",
		v,
		iterations: maxIterations,
		snap,
		merit,
		history,
		message: "maximum iterations reached",
		finalTrustRadius: trustRadius,
	});
}
