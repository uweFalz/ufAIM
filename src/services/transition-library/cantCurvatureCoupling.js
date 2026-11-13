// Coupling between a normalised curvature function k(x) and a normalised cant
// function f(x) of one transition, x = s/L in [0, 1].
//
// Model (a reference-point relation, not a vehicle model; confirmed by Uwe
// 2026-11-13, matches AT 412 975 B in its small-angle form):
//   - cant angle            psi(x) = psiE * f(x),  sin(psiE) = cant / rail base
//   - the reference point sits at height h above the track axis and is
//     displaced by d = h * sin(psi) towards the inside of the curve;
//   - its path keeps the shape of the cant: kappaRef(x) = kappaRefE * f(x).
// The curvature of the displaced line is kappaRef = (kappa + d'') / (1 - kappa d),
// so the track curvature is kappa = (kappaRef - d'') / (1 + kappaRef d).
// Normalised with k = kappa * R, a = psiE, rho = h / R, c = 1 / (1 - rho sin a):
//
//       k = (c f - eps^2 (f'' cos(a f) - a f'^2 sin(a f))) / (1 + c f rho sin(a f)),
//       eps^2 = h * psiE * R / L^2
//
// This is the exact expression Uwe chose (2026-11-13). What it still leaves
// out is the square of d' (the slope of the offset), about 1e-5.
// With a = 0 and rho = 0 it is the small-angle form k = f - eps^2 f''. The
// functions below take both as options (`endAngle`, `offsetRatio`, default 0),
// so an epsilon alone still means the small-angle form.
//
// Forward (cant given):  k follows by differentiation.
// Reverse (curvature given, ramp and transition share their stations):
//   the equation above with f(0) = 0, f(1) = 1. Both conditions are used up by
//   the stations, so the end slopes of f are a result. Zero end slopes mean
//   the ramp runs in tangentially: the curvature suits this eps.
//
// Smoothness of the ramp at its ends (AT 412 975 B asks for at least three,
// for the bending theory of the rail four derivatives of f with finite
// values): the ramp joins constant cant on both sides, so
//   order 1: f'   = 0 at both ends, no kink;
//   order 2: f''  = 0 as well, three finite derivatives (the patent's minimum);
//   order 3: f''' = 0 as well, four finite derivatives (bending theory).
// Required is order 2 (Uwe, 2026-11-13: f'' = 0 is enough, f''' = 0 passes
// reality by; most transitions in service are clothoids with kinked ramps).
// With curvature given, f'' follows pointwise from the equation.
//
// The outputs are candidates of this model. Speed does not occur.

export const DEFAULT_COUPLING_ASSUMPTION = Object.freeze({
	referenceHeight: 1.8, // m above the track axis
	endCant: 0.15, // m
	railBase: 1.5, // m, distance of the rail contact points
	radius: 1000, // m at the curved end
	length: 100, // m of the transition
});

export const DEFAULT_END_SLOPE_TOLERANCE = 0.02;
// The patent's minimum: f' and f'' vanish at the ends.
export const DEFAULT_REQUIRED_SMOOTHNESS_ORDER = 2;
export const SMOOTHNESS_ORDER_MAX = 3;

function finitePositive(value, name) {
	const number = Number(value);
	if (!Number.isFinite(number) || number <= 0) throw new Error(`cantCurvatureCoupling: ${name} must be a positive number`);
	return number;
}

/**
 * The three numbers of the model: epsilon, the end cant angle a = psiE
 * (sin a = cant / rail base) and rho = h / R.
 */
export function couplingGeometry(assumption = {}) {
	const merged = { ...DEFAULT_COUPLING_ASSUMPTION, ...assumption };
	const h = finitePositive(merged.referenceHeight, "referenceHeight");
	const cant = finitePositive(merged.endCant, "endCant");
	const base = finitePositive(merged.railBase, "railBase");
	const radius = finitePositive(merged.radius, "radius");
	const length = finitePositive(merged.length, "length");
	if (cant >= base) throw new Error("cantCurvatureCoupling: endCant must be smaller than railBase");
	const endAngle = Math.asin(cant / base);
	return { epsilon: Math.sqrt(h * endAngle * radius) / length, endAngle, offsetRatio: h / radius };
}

export function couplingEpsilon(assumption = {}) {
	return couplingGeometry(assumption).epsilon;
}

function shapeOf({ endAngle = 0, offsetRatio = 0 } = {}) {
	const a = Number(endAngle) || 0;
	const rho = Number(offsetRatio) || 0;
	if (!Number.isFinite(a) || a < 0 || a >= Math.PI / 2) throw new Error("cantCurvatureCoupling: endAngle must be in [0, pi/2)");
	if (!Number.isFinite(rho) || rho < 0 || rho * Math.sin(a) >= 1) throw new Error("cantCurvatureCoupling: offsetRatio out of range");
	return { a, rho, c: 1 / (1 - rho * Math.sin(a)), exact: a !== 0 || rho !== 0 };
}

// k from f, f', f'' at one station.
function curvatureAt(f, f1, f2, eps2, { a, rho, c, exact }) {
	if (!exact) return f - eps2 * f2;
	const sin = Math.sin(a * f);
	return (c * f - eps2 * (f2 * Math.cos(a * f) - a * f1 * f1 * sin)) / (1 + c * f * rho * sin);
}

// f'' from f, f', k at one station: the same equation, solved for f''.
function cant2At(f, f1, k, eps2, { a, rho, c, exact }) {
	if (!exact) return (f - k) / eps2;
	const sin = Math.sin(a * f);
	const cos = Math.cos(a * f);
	return (c * f - k * (1 + c * f * rho * sin)) / (eps2 * cos) + (a * f1 * f1 * sin) / cos;
}

// Solves y - eps2 y'' = rhs on the inner stations, y(0) = left, y(1) = right
// (second-order finite differences, Thomas algorithm). rhs has n entries; its
// first and last are not used.
function solveLinear(rhs, eps2, left, right) {
	const n = rhs.length;
	const intervals = n - 1;
	const y = rhs.slice();
	y[0] = left;
	y[intervals] = right;
	if (eps2 < 1e-14) return y;
	const h = 1 / intervals;
	const off = -eps2 / (h * h);
	const diag = 1 + (2 * eps2) / (h * h);
	const m = intervals - 1;
	const r = rhs.slice(1, intervals);
	r[0] -= off * left;
	r[m - 1] -= off * right;
	const c = new Array(m);
	const d = new Array(m);
	c[0] = off / diag;
	d[0] = r[0] / diag;
	for (let i = 1; i < m; i += 1) {
		const den = diag - off * c[i - 1];
		c[i] = off / den;
		d[i] = (r[i] - off * d[i - 1]) / den;
	}
	y[m] = d[m - 1];
	for (let i = m - 1; i >= 1; i -= 1) y[i] = d[i - 1] - c[i - 1] * y[i + 1];
	return y;
}

function sampleCount(count) {
	return Math.max(3, Math.min(4001, Math.trunc(Number(count) || 201)));
}

function checkEpsilon(epsilon) {
	const eps = Number(epsilon);
	if (!Number.isFinite(eps) || eps < 0) throw new Error("cantCurvatureCoupling: epsilon must be a finite number >= 0");
	return eps;
}

/** Cant given: k from f, f', f''. `cant2` is f'' with respect to x. */
export function curvatureFromCant({ cant, cant1 = null, cant2 }, epsilon, { count, endAngle = 0, offsetRatio = 0 } = {}) {
	if (typeof cant !== "function" || typeof cant2 !== "function") throw new Error("cantCurvatureCoupling: cant and cant2 must be functions");
	const eps = checkEpsilon(epsilon);
	const shape = shapeOf({ endAngle, offsetRatio });
	const n = sampleCount(count);
	const us = Array.from({ length: n }, (_, index) => index / (n - 1));
	const f = us.map((u) => Number(cant(u)));
	const f1 = typeof cant1 === "function" ? us.map((u) => Number(cant1(u))) : derivativeOfSamples(f);
	const f2 = us.map((u) => Number(cant2(u)));
	const samples = us.map((u, i) => ({ u, cant: f[i], curvature: curvatureAt(f[i], f1[i], f2[i], eps * eps, shape) }));
	const f3 = derivativeOfSamples(f2);
	const endSlopes = typeof cant1 === "function" ? endsOf(f1) : endSlopesFromSamples(f);
	return { epsilon: eps, exact: shape.exact, samples, endSlopes, ...smoothnessOf(endSlopes, f1, f2, f3) };
}

const REVERSE_ITERATIONS_MAX = 60;
const REVERSE_STEP_TOLERANCE = 1e-12;

/**
 * Curvature given: solve the coupling for f with f(0) = 0, f(1) = 1.
 * Small-angle form: one linear solve. Exact form: the linear solve is the
 * start, the rest is corrected by iteration with the same linear operator
 * (the two differ by terms of the size a^2 and rho).
 */
export function cantFromCurvature(curvature, epsilon, { count, endAngle = 0, offsetRatio = 0 } = {}) {
	if (typeof curvature !== "function") throw new Error("cantCurvatureCoupling: curvature must be a function");
	const eps = checkEpsilon(epsilon);
	const eps2 = eps * eps;
	const shape = shapeOf({ endAngle, offsetRatio });
	const n = sampleCount(count);
	const intervals = n - 1;
	const h = 1 / intervals;
	const k = Array.from({ length: n }, (_, index) => Number(curvature(index / intervals)));
	const f = solveLinear(k, eps2, 0, 1);
	let iterations = 0;
	let converged = true;
	if (shape.exact) {
		converged = false;
		while (iterations < REVERSE_ITERATIONS_MAX && !converged) {
			iterations += 1;
			const residual = new Array(n).fill(0);
			for (let i = 1; i < intervals; i += 1) {
				const d1 = (f[i + 1] - f[i - 1]) / (2 * h);
				const d2 = (f[i + 1] - 2 * f[i] + f[i - 1]) / (h * h);
				residual[i] = k[i] - curvatureAt(f[i], d1, d2, eps2, shape);
			}
			const step = solveLinear(residual, eps2, 0, 0);
			let largest = 0;
			for (let i = 1; i < intervals; i += 1) {
				f[i] += step[i];
				largest = Math.max(largest, Math.abs(step[i]));
			}
			if (!Number.isFinite(largest)) break;
			converged = largest < REVERSE_STEP_TOLERANCE;
		}
	}
	const samples = k.map((value, index) => ({ u: index / intervals, curvature: value, cant: f[index] }));
	const f1 = derivativeOfSamples(f);
	// The equation itself gives f'' without differentiating twice.
	const f2 = eps2 < 1e-14 ? derivativeOfSamples(f1) : f.map((value, index) => cant2At(value, f1[index], k[index], eps2, shape));
	const endSlopes = endSlopesFromSamples(f);
	return { epsilon: eps, exact: shape.exact, iterations, converged, samples, endSlopes, ...smoothnessOf(endSlopes, f1, f2, derivativeOfSamples(f2)) };
}

// Derivative of equally spaced samples on [0, 1]; second order, one-sided at the ends.
function derivativeOfSamples(values) {
	const n = values.length - 1;
	const h = 1 / n;
	return values.map((_, i) => {
		if (i === 0) return (-3 * values[0] + 4 * values[1] - values[2]) / (2 * h);
		if (i === n) return (3 * values[n] - 4 * values[n - 1] + values[n - 2]) / (2 * h);
		return (values[i + 1] - values[i - 1]) / (2 * h);
	});
}

function endsOf(values) {
	return { start: values[0], end: values[values.length - 1] };
}

function peakOf(values) {
	return values.reduce((peak, value) => (Number.isFinite(value) ? Math.max(peak, Math.abs(value)) : peak), 0);
}

function smoothnessOf(endSlopes, f1, f2, f3) {
	return {
		endDerivatives: { first: endSlopes, second: endsOf(f2), third: endsOf(f3) },
		peaks: { first: peakOf(f1), second: peakOf(f2), third: peakOf(f3) },
	};
}

function endSlopesFromSamples(values) {
	const n = values.length - 1;
	const h = 1 / n;
	return {
		start: (-3 * values[0] + 4 * values[1] - values[2]) / (2 * h),
		end: (3 * values[n] - 4 * values[n - 1] + values[n - 2]) / (2 * h),
	};
}

/**
 * The ramp suits when it leaves and reaches its end values smoothly up to the
 * required order. Order 1 is the end slope against `tolerance`, as before.
 * Orders 2 and 3 compare f'' and f''' at the ends with `tolerance` times their
 * largest value on the ramp (at least 1), because their size grows with 1/eps^2.
 * Without `endDerivatives` only order 1 can be judged.
 */
export function assessCouplingSuitability(endSlopes, { tolerance = DEFAULT_END_SLOPE_TOLERANCE, endDerivatives = null, peaks = null, requiredOrder = DEFAULT_REQUIRED_SMOOTHNESS_ORDER } = {}) {
	const start = Number(endSlopes?.start);
	const end = Number(endSlopes?.end);
	const maxEndSlope = Math.max(Math.abs(start), Math.abs(end));
	const checks = [{ order: 1, start, end, limit: tolerance }];
	for (const [order, key] of [[2, "second"], [3, "third"]]) {
		const ends = endDerivatives?.[key];
		if (!ends) break;
		checks.push({ order, start: Number(ends.start), end: Number(ends.end), limit: tolerance * Math.max(1, Number(peaks?.[key]) || 0) });
	}
	for (const check of checks) {
		const worst = Math.max(Math.abs(check.start), Math.abs(check.end));
		check.ok = Number.isFinite(worst) && worst <= check.limit;
	}
	let order = 0;
	while (order < checks.length && checks[order].ok) order += 1;
	const wanted = Math.trunc(Number(requiredOrder));
	const required = Math.min(checks.length, Math.max(1, Math.min(SMOOTHNESS_ORDER_MAX, Number.isFinite(wanted) ? wanted : DEFAULT_REQUIRED_SMOOTHNESS_ORDER)));
	return {
		suitable: order >= required,
		maxEndSlope,
		tolerance,
		order,
		requiredOrder: required,
		checks,
	};
}
