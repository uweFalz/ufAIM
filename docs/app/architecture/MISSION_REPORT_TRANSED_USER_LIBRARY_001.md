# MISSION REPORT

## 1. Mission

- Name: TransEd user library, slice 1 (service without UI); stream `app`; package `TRANSED_USER_LIBRARY_001`.
- Objective: let a user create, change, remove, export and import own transitionDB records on top of the immutable built-in DB, declare a creation as normalised curvature or normalised cant, and evaluate the coupling between the two; no UI in this slice.

## 2. Status

`partial` — the service is implemented and tested, committed on branch `claude/transed-user-layer` with a PR against `main`; not yet merged, and not yet reachable from the app (no messaging commands, no TransEd mode) (OD-2).

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM`; worktree `/Users/uwefalz/Developer/ufAIM-transed-user-layer`, branch `claude/transed-user-layer`, baseline `origin/main` `41d821d`.
- Pre-existing changes: none in the touched paths; the shared checkout's uncommitted edits by other streams are not touched and not included.
- Authorized: new service modules, their tests, this report. Excluded: `src/aim-core/**` (frozen public API), `docs/knowledgeKernel/`, messaging, worker, UI, the built-in `src/domain/transition/transitionLookup.json`.

## 4. Work Performed

- `createTransitionLibraryService({ catalogue, userLibrary })`: user records form a second layer over the unchanged built-in DB on the four levels `simpleFcn`, `protoFcn`, `halfWave`, `transition`; it offers the existing query surface (`listPresets`, `getPresetSpec`, `getCatalogue`, `updateWorkingCopy`, `resetWorkingCopy`) over the merged catalogue plus `putUserRecord`, `removeUserRecord`, `exportUserLibrary`, `importUserLibrary`, `evaluateCoupling`.
- Rules: built-in records are immutable; ids are checked; every change re-validates the whole user layer (structure, references, and every user halfWave and transition is actually built and must be finite, start at 0 and reach 1); a record in use cannot be removed; a refused change leaves the library as it was; working copies survive library changes.
- Library file "analog transDB": the same four levels with only the user's records and `schema.kind = "user-library"`; import is all-or-nothing, identical records are skipped, a differing record needs `replace: true`.
- Declaration: a halfWave carries `quantity: "curvature" | "cant"` (default `curvature`); a transition mixing both is refused; presets, specs and catalogue report `origin` (`built-in` / `user`) and `quantity`.
- Coupling (`cantCurvatureCoupling.js`, pure numerics, model stated in the file header): `k = f − ε²·f″` with `ε² = h·ψ_E·R/L²`. Cant given: curvature by differentiation. Curvature given: `f − ε²·f″ = k`, `f(0)=0`, `f(1)=1`, solved by finite differences; the end slopes of the ramp are the suitability verdict. The default assumption (h 1.8 m, cant 150 mm, rail base 1.5 m, R 1000 m, L 100 m, ε = 0.134) is returned with every result and can be overridden.
- Modularization: both modules live in a new directory `src/services/transition-library/`, outside the frozen core, importing only public core modules, the existing structural validator and each other; the existing query service, resolver and builder are reused unchanged, nothing is copied. `src/services/transition/` was left untouched because its boundary test fixes its content.

## 5. Changed Files

- Added: `src/services/transition-library/createTransitionLibraryService.js`, `src/services/transition-library/cantCurvatureCoupling.js`, `src/services/transition-library/index.js`, `test/services/transition-library/transition-library-service.test.mjs`, `test/services/transition-library/cant-curvature-coupling.test.mjs`, `docs/app/architecture/MISSION_REPORT_TRANSED_USER_LIBRARY_001.md`
- Modified: None
- Moved or renamed: None
- Deleted: None

## 6. Evidence and Validation

- New tests, `node --test test/services/transition-library/*.test.mjs`: `passed` (17/17): bottom-up creation equals the built-in Watorek curve; immutability of built-ins and of the injected catalogue; nine kinds of broken input rejected with code and reason; unsuitable halfWave rejected; removal order; re-validation on change; export/import round trip, conflict, `replace`, broken file imported not at all; working copies preserved; curvature/cant declaration; default assumption; import boundary of the two modules.
- Coupling numerics: forward and reverse are inverse within 1e-5; the end slope of a curvature built for ε = 0.134 is −0.28 / 0.000 / +0.32 at ε = 0.08 / 0.134 / 0.2; clothoid gives the linear ramp exactly; Bloss matches the closed form `6ε·coth(1/2ε) − 12ε²` within 1e-3: `passed`.
- Real DB entries through the service at the default assumption: `bloss` end slopes 0.590 (not suitable), `vienna7` 0.328 (not suitable), the Vienna-7 shape declared as cant yields curvature in [−0.102, 1.102] with end slopes 0.000 (suitable): `passed`.
- Existing boundary tests, `node --test test/services/transition/*.test.mjs`: `passed` (12/12).
- Full suite, `node --test 'test/**/*.test.mjs'`: 2421 tests, 21 failures, identical by name to the run of the same tree before this change (the tree merged as `41d821d`; `diff` of sorted names empty): `passed` for this change. Limitation: the 21 are pre-existing and unrelated.
- Browser: `not run` — nothing in this slice is reachable from the app.
- Limitations: the model is the reduced reference-point relation worked out with Uwe on 2026-11-10; Uwe has not yet confirmed sign convention and small-angle approximation (OD-3).

## 7. Kernel and Architecture Impact

```text
Kernel impact: none
Architecture impact: candidate
RefImpl impact: changed
Thesis impact: follow-up-required
```

- Architecture: a user layer over the transitionDB and a `quantity` declaration on halfWaves are new; they are kept outside core as service code and need a decision before they enter core or the DB schema (OD-4).
- RefImpl: new service modules only; no existing module changed.
- Thesis: `docs/thesis/AIM/dynamics/schwerpunkt_state-DE.tex` states that Schwerpunkt-Trassierung is no current capability; the coupling evaluation is a model-qualified candidate in that sense, but the text does not yet mention it.

## 8. Conflicts, Risks, and Open Decisions

- Risk: `KappaFcnBuilder` ignores `quantity`; a cant-declared transition resolved by a consumer that does not look at `meta.quantity` would be used as curvature. No consumer sees the library yet; this must be closed when it is wired in.
- Risk: the gap matrix notes that constants are not resolved by the evaluator; the user layer therefore offers no `constant` level.
- OD-1 (Uwe): decided on 2026-11-10 — commit on `claude/transed-user-layer` and PR against `main`; merge is Uwe's call.
- OD-2 (Uwe): next slice — wire the library into worker and local runtime (`Transition.*` commands) together with the first visible TransEd mode, or separately first.
- OD-3 (Uwe): confirm the coupling model (inward offset h·ψ, small angles, `ε² = h·ψ_E·R/L²`).
- OD-4 (Uwe/Rock): whether user layer and `quantity` move into core and the DB schema, or stay a service concern.

## 9. Handover

- Next safe step: merge the PR on Uwe's word; then decide OD-2.
- Prerequisites: none for the commit; OD-2 before the next slice.
- May touch: only the files in section 5.
- Other streams can proceed independently; no shared file is changed.
- Done criterion for the next package: a creation made in TransEd is stored through the library service, appears in the catalogue with origin `user`, and survives export and import in a second session.
