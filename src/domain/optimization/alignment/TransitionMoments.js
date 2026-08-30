// src/domain/optimization/alignment/TransitionMoments.js
//
// AXTRAN2 Calculation Kernel - closed-form transition offsets from family moments.
//
// A transition of length L running from entry curvature kA to exit curvature kB
// has, with u = s / L and KHat(u) = integral of the normalised curvature law,
//
//     theta(u) = theta_A + a * u + b * KHat(u),   a = kA * L,  b = (kB - kA) * L
//
// so its offset in the entry frame is exactly
//
//     (dx, dy) = L * (C(a, b), S(a, b))
//     C(a, b) = integral_0^1 cos(a u + b KHat(u)) du
//     S(a, b) = integral_0^1 sin(a u + b KHat(u)) du
//
// Expanding cosine and sine and integrating term by term leaves only the mixed
// moments of the family,
//
//     M[k][j] = integral_0^1 u^k KHat(u)^j du,
//
// which are constants of the transition family and are computed once. C and S
// are then polynomials in (a, b) whose coefficients are those constants, so
// their partial derivatives come from the very same table - no quadrature, no
// finite differences, and an exact Jacobian instead of a differenced one.
//
// Range. In track use a = kA L and b = dk L stay small: at L = 90 m and
// R = 700 m both are below 0.13. Measured against Gauss-Legendre quadrature the
// series is exact to machine precision for |a|, |b| <= 1 and still holds 1e-8
// at 1.5. Beyond that it degrades and the caller should integrate directly.
//
// The curvature law is injected, so this module carries no registry dependency.

export const TRANSITION_MOMENTS_VERSION = "axtran2/transition-moments/0.1";

export const DEFAULT_MOMENT_ORDER = 11;

export class TransitionMomentsError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "TransitionMomentsError";
		this.code = code;
	}
}

/** Gauss-Legendre nodes and weights on [0, 1], built once per node count. */
const quadratureCache = new Map();

function gaussLegendre(count) {
	if (quadratureCache.has(count)) return quadratureCache.get(count);
	const nodes = [];
	const weights = [];
	for (let i = 1; i <= count; i++) {
		let x = Math.cos((Math.PI * (i - 0.25)) / (count + 0.5));
		for (let iteration = 0; iteration < 100; iteration++) {
			let p0 = 1;
			let p1 = 0;
			for (let j = 1; j <= count; j++) {
				const p2 = p1;
				p1 = p0;
				p0 = ((2 * j - 1) * x * p1 - (j - 1) * p2) / j;
			}
			const derivative = (count * (x * p0 - p1)) / (x * x - 1);
			const delta = -p0 / derivative;
			x += delta;
			if (Math.abs(delta) < 1e-16) break;
		}
		let p0 = 1;
		let p1 = 0;
		for (let j = 1; j <= count; j++) {
			const p2 = p1;
			p1 = p0;
			p0 = ((2 * j - 1) * x * p1 - (j - 1) * p2) / j;
		}
		const derivative = (count * (x * p0 - p1)) / (x * x - 1);
		nodes.push(0.5 * (x + 1));
		weights.push(0.5 * (2 / ((1 - x * x) * derivative * derivative)));
	}
	const table = { nodes, weights };
	quadratureCache.set(count, table);
	return table;
}

function integrate01(f, count = 80) {
	const { nodes, weights } = gaussLegendre(count);
	let sum = 0;
	for (let i = 0; i < nodes.length; i++) sum += weights[i] * f(nodes[i]);
	return sum;
}

const FACTORIAL = [1];
for (let i = 1; i <= 40; i++) FACTORIAL[i] = FACTORIAL[i - 1] * i;

function binomial(n, k) {
	return FACTORIAL[n] / (FACTORIAL[k] * FACTORIAL[n - k]);
}

/**
 * Build the moment table of one transition family.
 *
 * @param {object} input
 * @param {(u: number) => number} input.curvatureIntegral  KHat(u), normalised
 * @param {number} [input.order]
 */
export function createTransitionMoments({
	curvatureIntegral,
	order = DEFAULT_MOMENT_ORDER,
	id = "transition-family",
} = {}) {
	if (typeof curvatureIntegral !== "function") {
		throw new TransitionMomentsError(
			"MISSING_CURVATURE_INTEGRAL",
			"curvatureIntegral (KHat) is required"
		);
	}

	const M = [];
	for (let k = 0; k <= order + 1; k++) {
		M[k] = [];
		for (let j = 0; j <= order + 1; j++) {
			M[k][j] = integrate01((u) => u ** k * curvatureIntegral(u) ** j);
		}
	}
	const totalTurn = curvatureIntegral(1);

	/** integral of (a u + b KHat)^n du */
	const rawMoment = (a, b, n) => {
		let sum = 0;
		for (let k = 0; k <= n; k++) sum += binomial(n, k) * a ** k * b ** (n - k) * M[k][n - k];
		return sum;
	};
	const rawMomentDa = (a, b, n) => {
		let sum = 0;
		for (let k = 1; k <= n; k++) sum += binomial(n, k) * k * a ** (k - 1) * b ** (n - k) * M[k][n - k];
		return sum;
	};
	const rawMomentDb = (a, b, n) => {
		let sum = 0;
		for (let k = 0; k < n; k++) sum += binomial(n, k) * a ** k * (n - k) * b ** (n - k - 1) * M[k][n - k];
		return sum;
	};

	function evaluate(a, b) {
		let C = 0;
		let S = 0;
		let Ca = 0;
		let Cb = 0;
		let Sa = 0;
		let Sb = 0;
		for (let n = 0; n <= order; n++) {
			const term = rawMoment(a, b, n) / FACTORIAL[n];
			if (n % 2 === 0) C += ((n / 2) % 2 ? -1 : 1) * term;
			else S += (((n - 1) / 2) % 2 ? -1 : 1) * term;
			if (n === 0) continue;
			const da = rawMomentDa(a, b, n) / FACTORIAL[n];
			const db = rawMomentDb(a, b, n) / FACTORIAL[n];
			if (n % 2 === 0) {
				const sign = (n / 2) % 2 ? -1 : 1;
				Ca += sign * da;
				Cb += sign * db;
			} else {
				const sign = ((n - 1) / 2) % 2 ? -1 : 1;
				Sa += sign * da;
				Sb += sign * db;
			}
		}
		return { C, S, Ca, Cb, Sa, Sb };
	}

	return Object.freeze({
		version: TRANSITION_MOMENTS_VERSION,
		id,
		order,
		totalTurn,
		moments: Object.freeze(M.map((row) => Object.freeze(row.slice()))),
		evaluate,

		/**
		 * Offset and turn of one transition element in its entry frame, together
		 * with the derivatives with respect to length and to both end curvatures.
		 */
		element(length, entryCurvature, exitCurvature) {
			const L = length;
			const dk = exitCurvature - entryCurvature;
			const a = entryCurvature * L;
			const b = dk * L;
			const { C, S, Ca, Cb, Sa, Sb } = evaluate(a, b);

			return {
				dx: L * C,
				dy: L * S,
				dtheta: a + b * totalTurn,

				// d/dL : both a and b scale with L
				dxdL: C + L * (Ca * entryCurvature + Cb * dk),
				dydL: S + L * (Sa * entryCurvature + Sb * dk),
				dthetadL: entryCurvature + dk * totalTurn,

				// d/dkA : a grows with L, b shrinks with L
				dxdkA: L * L * (Ca - Cb),
				dydkA: L * L * (Sa - Sb),
				dthetadkA: L * (1 - totalTurn),

				// d/dkB : only b moves
				dxdkB: L * L * Cb,
				dydkB: L * L * Sb,
				dthetadkB: L * totalTurn,
			};
		},
	});
}

/**
 * Build KHat for a family from its normalised curvature law kappaHat, by
 * quadrature. Used when only kappaHat is available, as from the registry.
 */
export function curvatureIntegralFrom(kappaHat, nodes = 80) {
	return (u) => (u === 0 ? 0 : u * integrate01((t) => kappaHat(t * u), nodes));
}
