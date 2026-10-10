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

## The distance at a kink, defined (2026-09-26)

The open item of the kink section - a fit whose optimum sits on a bend
and cannot be certified - had two parts, and both are closed.

**The definition** (Uwe Falz): the residual of a point is its distance to
the polyline; where the point has no perpendicular on either line - in
the wedge outside a bend - that is the distance to the vertex itself,
signed by the side. The foot memory now returns such a foot with
`vertex: true`, `q` the signed distance to the vertex and `direction` the
unit vector the derivative runs along, and the analytic Jacobian takes
that direction in place of the normal (`lateralDerivative(parameters, s,
direction)`), so that dq = -direction · dV. Tested on a bend of 0.3 rad
(`point-projection.test.mjs`). On the corpus's kinks of 0.03 gon the
wedge is a tenth of a millimetre wide and the rule never fires; it is
there for the angles a turnout or a profile has.

**The certification** was settled on the way, by the verdict of #47: a
points fit ends within tolerance with its undetermined directions named,
and `AHRO_Gl_110` - the file whose foot sat on the kink at u = 0.000 for
a thousand iterations - ends at 46 with rms 0.140. The inner corner of a
bend, where both lines have a foot and the nearer is taken, stays a
corner of the residual and no longer needs a verdict of its own.

Found on the way: the foot memory's stale distance stood at 50 m in the
code since #48, which documented and measured 200 m - the edit that set
the default had failed silently. Set now; the points runs take 178 s
against 209 with the 50, the strict order is unchanged at 225 of 235.
## Held poses: the turnout's tangent (2026-09-26)

The one building block the turnout case lacked: a pose held at an element
joint. `heldPoses: [{ afterElement, x?, y?, theta? }]` on the constraint
builder declares each named component as an equality on the pose at the
exit of that element - the turnout's tangent at its start or end, or its
whole pose - held while the elements on either side are fitted, under any
objective. The chain reads the pose at the joint's station and gives its
Jacobian there (`stationAfter`, `poseJacobianAt`); the rows sit with the
end pose's, a heading row weighed by the length it accumulates on. The
finite-difference path refuses them: a joint's pose is the chain's.

Measured on the nine-element scenario (`held-pose.test.mjs`): the joint
after the middle straight held at the truth's pose, the fit meets it to
1e-6 m and 1e-8 rad and the answer is the truth's; the tangent alone held
2 mrad off the truth bends the chain, the heading is met exactly, the end
pose still, and the points pay 40 % in rms - under the length objective as
well. Not yet in the app's evidence path, which declares no held poses.

## Turnouts: the catalogue as held elements (2026-09-27)

A turnout designation is its own catalogue: "EW 60-500-1:12" names the
rail, the radius and the crossing ratio, and what the kernel needs follows
by geometry - the crossing angle atan(1/n), the branch as an arc of R from
the toe to that angle (R · atan(1/n)), the main as the straight of the
same extent (R · sin). `TurnoutCatalogue.js` parses the designation,
builds the spec (`turnout({ designation, side })`) and its two held
elements (`turnoutElements`), a left-hand branch with positive curvature
in the kernel's frame. The lengths a catalogue prints between
Weichenanfang and Weichenende include the straight through the crossing;
Ril 800.0120 was not read for this, every spec says so and carries the
status "candidate".

The Weicheneinrechnung, as the original AXTRAN was used for it and as
`turnout.test.mjs` runs it: the main track's approach through a curve
onto the toe's straight, the toe's pose held there (`heldPoses`), the
branch of an EW 60-500-1:12 held from the catalogue, then a transition,
an arc and a straight fitted to a survey every 10 m and the end pose.
The fit meets the toe to 1e-6 m and 1e-8 rad, the branch turns by the
crossing angle to 1e-9, the end pose to 1e-6; a toe held half a metre off
the survey bends the connection, is met exactly, and the points pay. A
toe held in x, y and theta needs three free quantities before it, which
the curve supplies; on a start pose sitting on the toe's own straight the
pose would be redundant, and the declaration refuses six equalities
against four unknowns - which is the right answer to that declaration.

## Bent turnouts (2026-09-28)

A turnout bent onto a curve is the same turnout in the line's curvature:
the main an arc of the line's curvature, the branch the arc whose
curvature is the turnout's plus the line's - an Innenbogenweiche where
both turn the same way, an Außenbogenweiche where they turn against each
other, the branch then straighter than the line or straight or curving
the other way. The crossing angle between the two is the turnout's;
bending keeps it. `bentOnto(spec, mainCurvature)` gives the bent spec, the
two held elements follow. The branch's arc length is taken as the straight
turnout's, the bending being small; the difference is second order in
the line's curvature and is stated in the file.

`turnout.test.mjs`: an EW 60-500-1:12 bent onto R 1000 the same way
carries 1/500 + 1/1000 on the branch and 1/1000 on the main and turns
against the main by the crossing angle to 1e-12; bent against a line as
tight as itself the branch comes out straight. The Weicheneinrechnung of
an Innenbogenweiche on R 900 - the toe held on the curve, the bent branch
held, the connection fitted - meets the toe to 1e-6 m and the end pose to
1e-6.


## Crossing turnouts (2026-10-03)

A Kreuzungsweiche is two straight tracks crossing at the crossing angle
α = atan(1/n), with connecting arcs of radius R inside the crossing,
tangent to both tracks and so turning through α themselves. The geometry
is symmetric about the crossing centre, which fixes everything from R
and n: the centre lies R · tan(α/2) beyond the arc's tangent point on the
entering track, the straight between the two tangent points is twice
that, the connecting arc is R · α. From one entry there are two routes,
straight along the entering track or curved onto the crossing track;
`crossing({ designation | kind, radius, ratio, side })` gives the spec
and `crossingElement(spec, { route })` one route as a held element. An
EKW has a curve on one diagonal, a DKW on both; which diagonal that is
in an EKW is the declarer's knowledge of the layout, and the route from
one entry reads the same for both. Status "candidate" as for `turnout()`:
Ril 800.0120 was not read, the catalogue's lengths are not derived.

`turnout.test.mjs`: a DKW 60-190-1:9 walked both ways from one entry
pose - the arc's end lies on the crossing track through the centre to
1e-9 m, at the same distance beyond the centre as the tangent point lies
before it. The Einrechnung of its straight route between two fitted
connections, the crossing's entry held, meets entry and centre to 1e-6 m
and the end pose to 1e-6.

## The AXTRAN mark: 22 km, 5 011 points (2026-10-10)

The original AXTRAN's user remembers 20 km with 5 000 survey points as
the size it handled. The scenario for that mark is 1280_043-049_KM:
22 km, 164 elements, 228 free quantities, points every 4.4 m giving
5 011 points, the points fit alone with the end pose held (the
scenario's point cap lifted for the run; the cap stays in the file).
A profile of the first run (2026-09-25, 36 min on the code of that day)
put two thirds of the time into `Alignment2D.poseAt`, which walked every
element from the start for every query, and `_findSegment`, which walked
them from the end.

PR #67 replaces both walks with a binary search over the element
offsets and ends. The boundary rules are unchanged - the curvature at a
shared station belongs to the last element starting there, the pose to
the first ending there, zero-length elements included - and a test pins
the search to the walks it replaced. Measured:

| | old walk | binary search |
|---|---|---|
| `poseAt` per call, 231-element production alignment | 1.67 µs | 0.21 µs |
| `curvatureAt` per call | 0.11 µs | 0.06 µs |
| corpus 0–235, both objectives, 470 rows | identical | identical |
| corpus points run, parallel load | 140 s | 101 s |
| AXTRAN mark, same day, same scenario | 1 429 s | 775 s |

The mark's two runs agree in every digit: `within_tolerance` at
iteration 321, rms 0.193 m, end pose 8.8e-7 m. The search changes the
time and nothing else. What remains of the 775 s is the fit's own work:
5 011 feet per iteration on the production geometry and the Jacobian
chain over 228 quantities.

## The adapter: TRA and lists in, TRA and residuals out (2026-10-11)

What the original AXTRAN's user did by hand - sort the survey points,
prepare the start alignment, fit, compare in a spreadsheet - is one call:
`tools/axtran2/fitTra.mjs` takes a Verm.esn TRA, a survey list and a
Zwangspunkt list and writes the fitted TRA, a JSON report and a residual
list (tools/axtran2/README.md). The TRA is the start and the end pose,
the points are soft residuals in tolerance units, a Zwangspunkt is an
equality on the lateral offset; the problem is the corpus scenario's with
real points, in a local frame at the file's start.

The writer (`traWriter.mjs`) is the loader's inverse: 78-byte records,
R = -1/κ, direction clockwise from north, a Kz 5 record a straight with
the kink at its end and R1 = 200 gon plus the clockwise turn (measured
on every kink of the corpus), a transition's R1/R2 the neighbours' radii
as the chain realises them - which repairs a record that disagreed with
its own neighbour (6100_247-289 E212: R1 2468 m beside an arc of 275 m).
Cants travel with their source records; station equations are not
carried and the report counts them. The pose chain gained `entryPose(i)`
because at a shared station `poseAt` answers for the element that ends
there, which after a kink is the pose before the turn.

`adapter.test.mjs`: the lists as the field writes them (decimal comma,
`Nr;Y;X`, per-point tolerance, Zwangspunkt distance); the round trip
over eight trusted corpus files including kinks and junction arcs
(lengths, curvatures, families, kink turns and the end record to 1e-6);
a perturbed file (±2 % lengths, ±3 % curvatures) fitted back onto points
from the original with a Zwangspunkt 3 m off the axis, met to 1e-6. On
the command line, 2631R142 with 131 synthetic points: 42 elements, 60
free, `within_tolerance` @37 in 1.0 s, Zwangspunkt residual 8e-8.
