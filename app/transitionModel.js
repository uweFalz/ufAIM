// transitionModel.js
// Domain: u in [0,1]
// Image:  kappa in [0,1] (normalized curvature progress)
//
// v0.1 Berlin-ish composition:
//   halfWave1  (ease-in)  on [0,w]
//   middle     (linear)   on [w,1-w]
//   halfWave2  (ease-out) on [1-w,1]
//
// This keeps the model in the norm-space; embedding happens elsewhere.

export function clamp01(x) {
	return Math.max(0, Math.min(1, x));
}

// Smoothstep (C1). We'll use a quintic smootherstep (C2).
function smootherstep(t) {
	// 6t^5 - 15t^4 + 10t^3
	return t*t*t*(t*(t*6 - 15) + 10);
}
function smootherstep1(t) {
	// derivative: 30 t^4 - 60 t^3 + 30 t^2
	return 30*t*t*(t-1)*(t-1);
}
function smootherstep2(t) {
	// second derivative: 120 t^3 - 180 t^2 + 60 t
	return 60*t*(2*t*t - 3*t + 1);
}

// Parameters for Berlin-ish composition (v0.1)
export function defaultBerlinParams() {
	return { w: 0.18 }; // halfWave share per side
}

function clampParams(p) {
	const w = Math.max(0.02, Math.min(0.45, p?.w ?? 0.18));
	return { w };
}

// Piecewise kappa(u)
export function kappa(u, params = defaultBerlinParams()) {
	u = clamp01(u);
	const { w } = clampParams(params);

	if (u <= w) {
		const t = u / w;
		// map 0..w -> 0..w (same amplitude), eased
		return w * smootherstep(t);
	}
	if (u >= 1 - w) {
		const t = (u - (1 - w)) / w; // 0..1
		// map (1-w)..1 -> (1-w)..1, eased
		return (1 - w) + w * smootherstep(t);
	}

	// middle: linear mapping w..(1-w)
	return u;
}

// First derivative dκ/du
export function kappa1(u, params = defaultBerlinParams()) {
	u = clamp01(u);
	const { w } = clampParams(params);

	if (u <= w) {
		const t = u / w;
		return smootherstep1(t); // because d/du [w * s(t)] = s'(t)
	}
	if (u >= 1 - w) {
		const t = (u - (1 - w)) / w;
		return smootherstep1(t);
	}
	return 1;
}

// Second derivative d²κ/du²
export function kappa2(u, params = defaultBerlinParams()) {
	u = clamp01(u);
	const { w } = clampParams(params);

	if (u <= w) {
		const t = u / w;
		return smootherstep2(t) / w; // chain rule: d²/du² includes 1/w
	}
	if (u >= 1 - w) {
		const t = (u - (1 - w)) / w;
		return smootherstep2(t) / w;
	}
	return 0;
}

// Map normalized image -> physical curvature
// k(u) = k0 + (k1 - k0) * kappa(u)
export function curvature(u, { k0, k1, params }) {
	return k0 + (k1 - k0) * kappa(u, params);
}
export function curvature_du(u, { k0, k1, params }) {
	return (k1 - k0) * kappa1(u, params);
}
export function curvature_du2(u, { k0, k1, params }) {
	return (k1 - k0) * kappa2(u, params);
}


// --- numerical derivatives for κ (v0) ---
// later we can switch to analytic derivatives per family

export function dkappa(u, opts = {}) {
	const eps = opts.eps ?? 1e-4;
	const u1 = Math.max(0, Math.min(1, u - eps));
	const u2 = Math.max(0, Math.min(1, u + eps));
	const f1 = kappa(u1, opts);
	const f2 = kappa(u2, opts);
	
	return (f2 - f1) / (u2 - u1 || 1e-9);
}

export function d2kappa(u, opts = {}) {
	const eps = opts.eps ?? 2e-4;
	const u0 = Math.max(0, Math.min(1, u));
	const u1 = Math.max(0, Math.min(1, u0 - eps));
	const u2 = Math.max(0, Math.min(1, u0 + eps));
	const f0 = kappa(u0, opts);
	const f1 = kappa(u1, opts);
	const f2 = kappa(u2, opts);
	const h = (u2 - u0) || 1e-9;
	
	return (f2 - 2 * f0 + f1) / (h * h);
}
