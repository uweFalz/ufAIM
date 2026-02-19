// src/alignment/transitionRegistry/normalize/normalizeRange.js

const EPS = 1e-12;

export function normalizeRangeEndpoint(kFn, k1Fn, k2Fn = null) {
	const k0 = kFn(0);
	const k1 = kFn(1);
	const denom = (k1 - k0);

	if (!Number.isFinite(denom) || Math.abs(denom) < 1e-9) {
		return {
			ok: false,
			warning: "range denom ~0; fallback to identity range",
			info: { k0, k1, denom: 1 },
			kFn: (u) => kFn(u),
			k1Fn: (u) => k1Fn(u),
			k2Fn: (u) => (k2Fn ? k2Fn(u) : 0)
		};
	}

	return {
		ok: true,
		info: { k0, k1, denom },
		kFn: (u) => (kFn(u) - k0) / denom,
		k1Fn: (u) => k1Fn(u) / denom,
		k2Fn: (u) => (k2Fn ? k2Fn(u) / denom : 0)
	};
}
