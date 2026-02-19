// src/alignment/transitionRegistry/compose/composeKappaTotal.js

const EPS = 1e-12;

export function composeKappaTotal({ lambdas, shapes, globalEndNormalize = true }) {
	const [l1, lc, l2] = lambdas.map(Number);
	const s1 = l1;
	const s2 = l1 + lc;

	function kappaPiece(s) {
		if (s <= s1 && l1 > EPS) return shapes[0].kappa(s / l1);
		if (s <= s2 && lc > EPS) return shapes[1].kappa((s - s1) / lc);
		if (l2 > EPS) return shapes[2].kappa((s - s2) / l2);
		return shapes[1].kappa(0);
	}

	const K = kappaPiece(1);
	const scale = (globalEndNormalize && Number.isFinite(K) && Math.abs(K) > 1e-9) ? 1 / K : 1;

	return {
		kappa: (s) => scale * kappaPiece(s),
		meta: { s1, s2, endK: K, endScale: scale }
	};
}
