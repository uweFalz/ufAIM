// Coupling between a normalised curvature function k(x) and a normalised cant
// function f(x) of one transition, x = s/L in [0, 1].
//
// Declared model (a reduced reference-point relation, not a vehicle model):
//   - cant angle            psi(x)   = psiE * f(x)
//   - the reference point sits at height h above the track axis and is
//     displaced by h * psi towards the inside of the curve (small angles);
//   - its path keeps the shape of the cant: kappaRef(x) = kappaE * f(x).
// The track curvature then is kappa = kappaRef - h * psi'', normalised:
//
//       k(x) = f(x) - eps^2 * f''(x),      eps^2 = h * psiE * R / L^2
//
// Forward (cant given):  k follows by differentiation.
// Reverse (curvature given, ramp and transition share their stations):
//   f - eps^2 f'' = k,  f(0) = 0,  f(1) = 1.  Both conditions are used up by
//   the stations, so the end slopes of f are a result. Zero end slopes mean
//   the ramp runs in tangentially: the curvature suits this eps.
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

function finitePositive(value, name) {
	const number = Number(value);
	if (!Number.isFinite(number) || number <= 0) throw new Error(`cantCurvatureCoupling: ${name} must be a positive number`);
	return number;
}

export function couplingEpsilon(assumption = {}) {
	const merged = { ...DEFAULT_COUPLING_ASSUMPTION, ...assumption };
	const h = finitePositive(merged.referenceHeight, "referenceHeight");
	const cant = finitePositive(merged.endCant, "endCant");
	const base = finitePositive(merged.railBase, "railBase");
	const radius = finitePositive(merged.radius, "radius");
	const length = finitePositive(merged.length, "length");
	return Math.sqrt(h * (cant / base) * radius) / length;
}

function sampleCount(count) {
	return Math.max(3, Math.min(4001, Math.trunc(Number(count) || 201)));
}

function checkEpsilon(epsilon) {
	const eps = Number(epsilon);
	if (!Number.isFinite(eps) || eps < 0) throw new Error("cantCurvatureCoupling: epsilon must be a finite number >= 0");
	return eps;
}

/** Cant given: k = f - eps^2 f''. `cant2` is f'' with respect to x. */
export function curvatureFromCant({ cant, cant1 = null, cant2 }, epsilon, { count } = {}) {
	if (typeof cant !== "function" || typeof cant2 !== "function") throw new Error("cantCurvatureCoupling: cant and cant2 must be functions");
	const eps = checkEpsilon(epsilon);
	const n = sampleCount(count);
	const samples = Array.from({ length: n }, (_, index) => {
		const u = index / (n - 1);
		const f = Number(cant(u));
		return { u, cant: f, curvature: f - eps * eps * Number(cant2(u)) };
	});
	const endSlopes = typeof cant1 === "function"
		? { start: Number(cant1(0)), end: Number(cant1(1)) }
		: endSlopesFromSamples(samples.map((sample) => sample.cant));
	return { epsilon: eps, samples, endSlopes };
}

/** Curvature given: solve f - eps^2 f'' = k with f(0) = 0, f(1) = 1. */
export function cantFromCurvature(curvature, epsilon, { count } = {}) {
	if (typeof curvature !== "function") throw new Error("cantCurvatureCoupling: curvature must be a function");
	const eps = checkEpsilon(epsilon);
	const n = sampleCount(count);
	const intervals = n - 1;
	const h = 1 / intervals;
	const k = Array.from({ length: n }, (_, index) => Number(curvature(index / intervals)));
	let f;
	if (eps * eps < 1e-14) {
		f = k.slice();
		f[0] = 0;
		f[intervals] = 1;
	} else {
		// Second-order finite differences, tridiagonal system (Thomas algorithm).
		const off = -(eps * eps) / (h * h);
		const diag = 1 + (2 * eps * eps) / (h * h);
		const m = intervals - 1;
		const rhs = k.slice(1, intervals);
		rhs[m - 1] -= off; // f(1) = 1
		const c = new Array(m);
		const d = new Array(m);
		c[0] = off / diag;
		d[0] = rhs[0] / diag;
		for (let i = 1; i < m; i += 1) {
			const den = diag - off * c[i - 1];
			c[i] = off / den;
			d[i] = (rhs[i] - off * d[i - 1]) / den;
		}
		f = new Array(n).fill(0);
		f[intervals] = 1;
		f[m] = d[m - 1];
		for (let i = m - 1; i >= 1; i -= 1) f[i] = d[i - 1] - c[i - 1] * f[i + 1];
	}
	const samples = k.map((value, index) => ({ u: index / intervals, curvature: value, cant: f[index] }));
	return { epsilon: eps, samples, endSlopes: endSlopesFromSamples(f) };
}

function endSlopesFromSamples(values) {
	const n = values.length - 1;
	const h = 1 / n;
	return {
		start: (-3 * values[0] + 4 * values[1] - values[2]) / (2 * h),
		end: (3 * values[n] - 4 * values[n - 1] + values[n - 2]) / (2 * h),
	};
}

/** The ramp suits when it leaves and reaches its end values tangentially. */
export function assessCouplingSuitability(endSlopes, { tolerance = DEFAULT_END_SLOPE_TOLERANCE } = {}) {
	const start = Number(endSlopes?.start);
	const end = Number(endSlopes?.end);
	const maxEndSlope = Math.max(Math.abs(start), Math.abs(end));
	return {
		suitable: Number.isFinite(maxEndSlope) && maxEndSlope <= tolerance,
		maxEndSlope,
		tolerance,
	};
}
