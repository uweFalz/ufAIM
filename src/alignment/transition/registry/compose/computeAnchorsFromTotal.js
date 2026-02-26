// computeAnchorsFromTotal.js (copied from patched repo)
function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function slopeAt(fn, u, fallback = 1) {
	const s = Number(fn?.(u));
	return Number.isFinite(s) ? s : fallback;
}

export function computeAnchorsFromTotal(kappaFamilies, normLengthPartition) {
	const fams = Array.isArray(kappaFamilies) ? kappaFamilies : [];
	const lmb  = Array.isArray(normLengthPartition) ? normLengthPartition : [];

	const l1 = Math.max(0, Number(lmb[0] ?? 0));
	const lc = Math.max(0, Number(lmb[1] ?? 0));
	const l2 = Math.max(0, Number(lmb[2] ?? 0));

	const sum = l1 + lc + l2;
	if (!Number.isFinite(sum) || sum < 1e-15) return [0, 0, 0, 1];

	// normalize λ to sum=1
	const n1 = l1 / sum;
	const nc = lc / sum;
	const n2 = l2 / sum;

	// join-slopes:
	const s1 = slopeAt(fams[0]?.kappa1, 1 , 1); // hw1 at join-to-core
	const sc = slopeAt(fams[1]?.kappa1, .5, 1); // core slope by definition
	const s2 = slopeAt(fams[2]?.kappa1, 0 , 1); // hw2 at join-to-core (asym-reversed)

	const d1 = Math.max(1e-12, Math.abs(s1));
	const dc = Math.max(1e-12, Math.abs(sc));
	const d2 = Math.max(1e-12, Math.abs(s2));

	const m1 = (n1 > 1e-15) ? (n1 / d1) : 0;
	const mc = (nc > 1e-15) ? (nc / dc) : 0;
	const m2 = (n2 > 1e-15) ? (n2 / d2) : 0;

	const A = m1 + mc + m2;
	
	if (!Number.isFinite(A) || A < 1e-15) {
		const a1 = clamp01(n1);
		const a2 = clamp01(n1 + nc);
		return [0, a1, Math.max(a1, a2), 1];
	}

	let a1 = clamp01(m1 / A);
	let a2 = clamp01(1 - (m2 / A));
	
	if (a2 < a1) { const t = a1; a1 = a2; a2 = t; }

	return [0, a1, a2, 1];
}
