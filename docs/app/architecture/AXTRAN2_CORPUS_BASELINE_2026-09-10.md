# AXTRAN2 corpus baseline, 2026-09-10

The whole TRA corpus through the solver in one run, after the scaling work
(#23–#36) and with ÜB S-Form read as Helmert. Solver defaults as on `main`:
filter acceptance (ceiling 1e2), BFGS, restoration on the verdict, no start
restoration, no length prior, budget 1000. The app's decided settings
(keep-plan prior σ 5 %, Gauss-Newton, eager start) are measured separately
below.

`node test/axtran2/corpus/runCorpus.mjs --from 0 --to 300 --json …`

## Corpus

292 files, 212 trusted (the file's own chain closes on its recorded end
point to under a millimetre), 80 excluded: 52 with kink records (not yet
read), 14 with fewer than three elements, 14 whose chain misses the recorded
end (inconsistent as-built). Since 2026-09-11 the kink records are read
(section "Kinks" below): 248 trusted, 44 excluded (30 whose chain misses
the recorded end, 14 with fewer than three elements). The tables below are
the 212-file baseline and stay as measured.

## Result, solver defaults

| objective | verdicts | converged / stationary | no verdict | mean iterations | time |
|---|---|---|---|---|---|
| length | 196 / 212 (92.5 %) | 102 / 94 | 9 inadmissible_points, 4 max_iterations, 2 infeasible_subproblem, 1 qp_failed | 57 | 133 s |
| points | 177 / 212 (83.5 %) | 85 / 92 | 34 max_iterations, 1 qp_failed | 75 | 913 s |

Points objective, mean rms 0.125 tolerance units (noise floor 0.154).

Of the 34 files with 40 elements and more, 6 reach a verdict under the
defaults; the rest end `max_iterations` on the points objective - the flat
valley of `AXTRAN2_FLAT_VALLEY_FINDING.md` - and `inadmissible_points` on the
length objective (the shortest alignment walks off its sample points, which
the length objective does not carry as constraints).

## Result, the app's settings

On the range 0–161 with `--hessian gauss-newton --restoration eager
--lengthPrior 0.05` (PR #26): points 159 of 161 verdicts at 5.4 mean
iterations; every giant reaches a verdict (64 elements converged at 13, 119
stationary at 18). The prior is the app's answer to the valley; the solver
does not assume it.

## What the no-verdict rows are

- Points, 40+ elements: transition lengths and their arc neighbours are not
  determined by lateral offsets; `diagnostics.determinacy` names them.
- Length, `inadmissible_points`: the objective has no points; the samples
  lose their foot when the alignment shortens by hundreds of metres. The
  lexicographic layer (points before length) is where the length objective
  belongs for such files.
- The two small ones (ABG_Abzw_W_722 qp_failed at 4 elements, AHBI_Gl_029
  max_iterations at 5) are unexamined.

## Kinks (2026-09-11)

A `Kink` record in a Verm.esn TRA file is a Knick: a heading jump of zero
length between two elements, which station tracks have where the rule book
allows a bend without a transition. The corpus has 95 of them in 52 files,
all mid-chain, 83 between two straights and 12 between a straight and an
arc, median 0.015 gon, largest 0.063 gon. The record carries the interior
angle around 200 gon; the loader reads the turn off the neighbours'
directions, which the parser has in radians, and changes its sign (the file's
directions grow clockwise, the kernel's heading to the left).

**Representation.** A kernel element `{ type: "kink", length: 0, deltaDir,
held: true }`. The chain (`AlignmentPoseJacobian`) turns the heading by
`deltaDir` and moves nothing, every derivative zero; the production geometry
has had `KinkElement` all along and the loader writes its sparse stub with
`deltaDir` as the number the factory reads. `"kink"` is an element kind of
the constraint builder and the design profile (no quantity, no floor).
Chain against kernel on a straight-kink-straight-arc chain: poses to 1e-8,
end-pose derivatives to 1e-6 (`analytic-jacobian.test.mjs`).

**Closure.** 36 of the 52 files close on their recorded end to under a
millimetre (median 4e-6 m); with the turn mirrored none of them does, so the
sign is the file's. The other 16 miss regardless of the kink - 2 to 5 cm on
nine turnout files, 0.8 m on one, 100 to 190 m on three chains of 150 to
237 elements - and go to "chain misses the recorded end" like any other
inconsistent as-built.

**The kink's station is held.** Left free, the two straights a kink joins
are all but one element: on `Landshut/5634S000-007` (16 elements, 0.03 gon)
the kink moved 21 m along them for a centimetre of lateral effect, and the
points fit walked that valley for the whole budget (rms 2.5 cm, f falling
in the fifth digit, relative KKT 8e-6). The record sits where it sits, so
the element before a kink keeps its length in the scenario
(`kinkStation: "held"`, runner `--kinkStation`); that file converges at 510.

| new files (36), solver defaults | kink station free | **held** |
|---|---|---|
| points ok | 9 | **11** |
| accumulated-length ok | 24 | **27** |
| strict lexicographic ok | 2 | **2** |

The 212 files of the baseline are unchanged by any of this (322 of 322
single rows and 161 of 161 strict rows identical on the first 161). The
whole corpus of 248 now stands at points 190, length 225, strict 129.

**What the kink files are.** Twenty-four of the 36 run out on the points
objective, thirteen of them with 40 elements or fewer, and the reason is
not a bad fit: `AHRO_Gl_110` (20 elements) ends at f = 0.165 in tolerance
units, the same value the smooth variant (kink turned to zero) reaches as
`stationary` at 106 iterations, with the relative KKT residual at 4.9e-4
and steps of 5e-10 accepted at alpha 5e-7 for a thousand iterations. At that
point the foot of point M6 sits exactly on the kink (u = 0.000): a polyline
with a bend captures a point, the optimum of the lateral fit is at the bend,
and there the residual is continuous but not differentiable. The solver
cannot certify such a point - no KKT residual goes to zero at a corner -
and runs out instead of saying so. That is the open question of the kink
files, and it is a modelling one: what the fit should do at a bend
(a subgradient stationarity test, or points within a few metres of a kink
assigned to one side of it, or bends below some angle treated as the
measurement noise they are at 4 cm) is a decision, not a measurement.

**A production finding, fixed on 2026-09-11 (PR #43).** The sparse model carries
a kink's turn as its unit vector (`validateSparseAlignment` demands an
object, `buildSparseFromLandFAT.deltaDirVec` writes `{cos, sin}` of the
angle), and `AlignmentFactory.readDeltaDir` reads `Number(stub.deltaDir)`,
which is NaN for an object and becomes 0: every kink the LandFAT bridge
imports goes straight through in the app. The factory's header documents
`deltaDir` as the angle. A reader that accepts both (`atan2(y, x)` for the
vector) is what the factory does now; the adopted-baseline hash in
`alignment-aggregate-factory-core-module-boundary.test.mjs` follows the
body, and the corpus loader writes its kinks through the writer's vector
like the bridge, so there is one contract.

