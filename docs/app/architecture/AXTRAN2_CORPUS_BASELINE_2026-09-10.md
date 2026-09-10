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
end (inconsistent as-built).

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
