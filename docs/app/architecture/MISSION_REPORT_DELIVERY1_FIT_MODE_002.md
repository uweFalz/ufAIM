# MISSION REPORT

## 1. Mission

Mission `APP-DELIVERY1-FIT-MODE-002`, stream `app`: give the AXTRAN consequence evidence the budget and the machinery to converge, so the sentence of FIT-MODE-001 speaks about a finished fit.

## 2. Status

`review-required`

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM-eb`, branch `feat/app-evidence-budget`, baseline `origin/main` at `6a591b57c05e7650a987a6795ae22e8ab237d56d` (includes Uwe's bound for large imports, 076d151)
- Scope: evidence service defaults and derivatives, two production helpers moved out of the corpus scenario, tests
- Excluded: shared checkout, canonical mutation, the interactive bound (kept as decided in 076d151), Viewer, Thesis

## 4. Work Performed

- Found on the way, in the browser: the editor stores an arc's radius beside its curvature and the sparse builder reads the radius first, so the evidence overlay's curvature patch moved nothing in the geometry - every browser edit's evidence had ended in a failed line search with the end pose metres off (max_iterations at 12 in FIT-MODE-001, restoration_failed at 21 with the budget). The overlay keeps both consistent now.

- Evidence service: `maxIterations` 12 → 200, `hessian` "gauss-newton", derivatives from the moment chain (`createAlignmentPoseJacobian`) instead of finite differences, sample feet remembered between evaluations. Version 0.3. The observation-only bound above 96 free variables stands.
- Helpers: `AlignmentPointProjection` and `TransitionMomentsCatalogue` under `src/domain/optimization/alignment/`, used by the service and the corpus scenario.

## 5. Changed Files

Added: `src/domain/optimization/alignment/AlignmentPointProjection.js`, `src/domain/optimization/alignment/TransitionMomentsCatalogue.js`, `docs/app/architecture/MISSION_REPORT_DELIVERY1_FIT_MODE_002.md`.
Modified: `src/services/alignment/AlignmentAxtranEvidenceService.js`, `test/services/alignment/alignment-axtran-evidence-service.test.mjs`, `test/axtran2/corpus/createTraScenario.mjs`.

## 6. Verification

| case | before (12, BFGS, finite differences) | after (200, Gauss-Newton, chain) |
|---|---|---|
| service fixture, 3 elements | max_iterations @12, 1.0 s | stationary @4, 0.01 s |
| 9 elements, 11 free | max_iterations, end pose 0.22 m, rms 70, 2.2 s | stationary @9, end pose 0, rms 0.000, 0.0 s |
| 21 elements, 26 free | max_iterations, end pose 1.4 m, rms 567, 5.0 s | max_iterations @200, end pose 2e-6, rms 0.002, 0.4 s |

Browser, worktree served on 8083: straight 120 m, Bloss 60 m, arc R 300, radius edited to 320 and applied - the receipt shows producer 0.3, proposal `converged`, 4 iterations, end-pose residual 4e-14 m, derived-point rms 6e-10, the sentence "Fit hielt den bearbeiteten Plan (σ 5 %) …", under a second from click to receipt. Before the radius fix the same edit ended `restoration_failed` at 21 with 2.96 m.

Tests: service 7/7 (two new), axtran2 and corpus 151/151, app, services, axtran2 and corpus together 842/847 (the five are the environment and two pre-existing on main). Corpus 0–161: 322 of 322 rows identical after the scenario's switch to the helpers.

## 7. Risks and Open Points

- The chain's families are the registry ids the edit model carries; an unknown family throws inside the evidence and the bridge swallows it (evidence becomes null), as before.
- Sample tolerance is 1 cm, so the 5 % prior weighs less here than on the corpus; the sentence still reports what the samples did not determine.

## 8. Next Step

Review and integrate.

## 9. Effort

Four commits, one session, one browser run.
