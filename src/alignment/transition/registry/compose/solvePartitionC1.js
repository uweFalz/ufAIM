// src/alignment/transitionRegistry/compose/solvePartitionC1.js

const EPS = 1e-9;

export function solvePartitionC1({ hw1, clo, hw2 }) {
  // all shapes are assumed slope-normalized (kappa1(1)=1) already
  const a = clo.kappa1(0); // slope at start of clo in u
  const b = clo.kappa1(1); // slope at end of clo in u
  const c = hw2.kappa1(0); // slope at start of hw2 in u (after reverse if any)

  if (![a,b,c].every(Number.isFinite)) {
    return { ok:false, error:"non-finite slopes for C1 solve" };
  }
  if (Math.abs(b) < EPS) return { ok:false, error:"clo kappa1(1) ~ 0" };

  // express lc and l2 in terms of l1:
  // lc = l1 * a
  // l2 = lc * (c/b) = l1 * a * (c/b)
  const r = a * (c / b);

  // l1 + lc + l2 = l1 + l1*a + l1*r = 1
  const denom = 1 + a + r;
  if (Math.abs(denom) < EPS) return { ok:false, error:"bad denom in partition solve" };

  const l1 = 1 / denom;
  const lc = l1 * a;
  const l2 = l1 * r;

  // clamp tiny negatives due to numeric noise
  const L = [l1, lc, l2].map(x => (x < 0 && x > -1e-12) ? 0 : x);
  const sum = L[0]+L[1]+L[2];
  if (sum <= EPS) return { ok:false, error:"partition sum ~ 0" };

  // normalize exactly to sum=1
  return { ok:true, lambdas: L.map(x => x/sum) };
}
