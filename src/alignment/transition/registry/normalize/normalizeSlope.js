// src/alignment/transitionRegistry/normalize/normalizeSlope.js

export function normalizeSlope(kFn, k1Fn, uAt = 1, eps = 1e-9) {
	const d = k1Fn(uAt);
	if (!Number.isFinite(d) || Math.abs(d) < eps) {
		return { ok: false, error: "degenerate slope" };
	}
	return {
		ok: true,
		scale: 1 / d,
		kFn: (u) => kFn(u) / d,
		k1Fn: (u) => k1Fn(u) / d
	};
}
