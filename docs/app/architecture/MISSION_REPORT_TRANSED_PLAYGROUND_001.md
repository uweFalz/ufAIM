# MISSION REPORT

## 1. Mission

- Name: TransEd playground; stream `app`; package `TRANSED_PLAYGROUND_001`.
- Objective: set up TransEd as a page of its own, analogous to the viewer and AXTRAN2 (modular source, generated single HTML file), independent of the app shell; first content is mode 2 (halfWave in and out selectable, adjustable via w1 and w2).

## 2. Status

`partial` — the playground with mode 2 is implemented, tested and checked in the browser; committed on branch `claude/transed-playground` with a PR against `main`, not yet merged; modes 0 and 1 are not built (OD-2).

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM`; worktree `/Users/uwefalz/Developer/ufAIM-transed-playground`, branch `claude/transed-playground`, baseline `origin/main` `f8d124e`.
- Pre-existing changes: the shared checkout has an uncommitted edit by another stream in `tools/axtran2/pointObservationAdapter.mjs`; not touched. `tools/axtran2/bundle.mjs` is clean there.
- Authorized: new `transed/`, `tools/transed/`, `src/services/transition-library/`, tests, `package.json` script, this report. Excluded: the app shell and its TransEd files, `src/aim-core/**`, `docs/knowledgeKernel/`, messaging and worker.
- Outside the worktree: the generated file was copied to `/Users/uwefalz/Developer/ufAIM/dist/transed.html` (ignored by Git) so that it can be opened at once.

## 4. Work Performed

- Page: `transed/index.html` and `transed/app.js` hold presentation and workflow only. Mode 2: template select (fills both halfWaves and the partition), halfWave in and out from all 28 halfWaves, w1 and w2 by slider, number field or by dragging the cut lines in the picture; picture of κ, κ′, κ″ with their ranges; second picture with curvature and cant under the coupling model, end slopes, verdict and the editable assumption (h, end cant, R, L); save as own transition; own library with load and remove; library as file out and in; the browser remembers the library in local storage where available.
- Service: `createTransitionLibraryService` gains `listHalfWaves()` and `describeDraft()` (an unsaved combination of two halfWaves and a partition, with curves and coupling, or code and reason); coupling evaluation is shared between saved and unsaved transitions.
- Pictures: `src/services/transition-library/transitionPlot.js`, pure functions from samples to SVG, no plotting library.
- Single file: `tools/transed/bundle.mjs` writes `dist/transed.html` (20 modules, 133 KB, no outside reference, runs from `file://`); `npm run bundle:transed`.
- Modularization: the bundler reuses the module registry of `tools/axtran2/bundle.mjs` (four functions exported there, nothing copied); the AXTRAN2 bundle is byte-identical before and after. The page computes nothing itself; the single file is generated, not a second source.
- Deferred: modes 0 and 1; wiring into the app shell; refusal texts of the service are English, the page puts a German sentence in front of the common ones.

## 5. Changed Files

- Added: `transed/index.html`, `transed/app.js`, `transed/README.md`, `tools/transed/bundle.mjs`, `src/services/transition-library/transitionPlot.js`, `test/services/transition-library/transition-plot.test.mjs`, `test/transed/bundle.test.mjs`, `docs/app/architecture/MISSION_REPORT_TRANSED_PLAYGROUND_001.md`, `docs/app/architecture/evidence/TRANSED_PLAYGROUND_20261110/single-file.png`
- Modified: `src/services/transition-library/createTransitionLibraryService.js`, `src/services/transition-library/index.js`, `test/services/transition-library/transition-library-service.test.mjs`, `tools/axtran2/bundle.mjs`, `package.json`
- Moved or renamed: None
- Deleted: None

## 6. Evidence and Validation

- New and changed tests, `node --test test/services/transition-library/*.test.mjs test/transed/*.test.mjs`: `passed` (24/24): draft equals built-in Bloss; `HW_REGULAR3`/`HW_REGULAR4`, which no built-in transition uses, become usable; refusals; pictures; the bundle builds, holds one script and no outside reference, and its script computes the start picture against a minimal document.
- AXTRAN2 bundle after exporting four functions, `node tools/axtran2/bundle.mjs --out <a>` with and without the change, `cmp`: identical: `passed`.
- Full suite, `node --test 'test/**/*.test.mjs'`: 2439 tests, 21 failures, the same 21 names as the run before this change (on `41d821d`); one further `✖` line is a test marked todo in `test/axtran2/lexicographic.test.mjs`, new on `main` since then and not counted as a failure: `passed` for this change. Limitation: no baseline run on `f8d124e` itself; the 21 are pre-existing and unrelated.
- Visible journey, headless Chrome, fresh profile, both the served page (`http://127.0.0.1:8096/transed/index.html`, `Cache-Control: no-store`) and the single file (`file://…/dist/transed.html`): start on Bloss with three curves and two cut lines; template `clothoid` gives partition `0 · 1 · 0` and end slopes 1.000; `HW_REGULAR3` in, `HW_VIEN7` out, w1 0.3, w2 0.7; drag of the w1 line to 0.2; a wrong id is refused with reason; save as `regular3_vienna7`; length 200 m gives ε 0.067; after reload the transition is still in library and template list; no console error, no horizontal scroll at 1200 px: `passed`. Screenshot: `docs/app/architecture/evidence/TRANSED_PLAYGROUND_20261110/single-file.png`.
- Limitations: inputs, clicks and the drag were dispatched by script (secondary evidence under the visible-user-journey gate); file download and file upload of the library were not exercised in the browser (the service round trip is tested in Node); Safari and Firefox not tried; narrow screens not checked.

## 7. Kernel and Architecture Impact

```text
Kernel impact: none
Architecture impact: candidate
RefImpl impact: changed
Thesis impact: none
```

- Architecture: a third stand-alone page beside viewer and AXTRAN2; user layer and `quantity` remain service concerns as in `TRANSED_USER_LIBRARY_001` (its OD-4 stands).
- RefImpl: new page, bundler and picture module; library service extended.

## 8. Conflicts, Risks, and Open Decisions

- Risk: the coupling model is not yet confirmed by Uwe (OD-3 of `TRANSED_USER_LIBRARY_001`); the page states the model next to the result.
- Risk: local storage is per origin; the single file opened from another path or the served page do not share one library. The file export is the durable way.
- OD-1 (Uwe): decided on 2026-11-10 — commit on `claude/transed-playground` and PR against `main`; merge is Uwe's call.
- OD-2 (Uwe): next slice in the playground — mode 0 (function creator with frame picker), then mode 1 (halfWave composer), as agreed.

## 9. Handover

- Next safe step: merge the PR on Uwe's word; then OD-2.
- Prerequisites: none; no file of another stream is touched except `tools/axtran2/bundle.mjs` (clean in the shared checkout, output unchanged).
- May touch: only the files in section 5.
- Other streams can proceed independently.
- Done criterion for the next package: a function created in mode 0 with a chosen argument interval appears as halfWave source in mode 2 and survives export and import.
