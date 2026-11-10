# MISSION REPORT

## 1. Mission

- Name: TransEd compare cache; stream `app`; package `TRANSED_COMPARE_CACHE_001`.
- Objective: the TransEd comparison (table and curve) shall follow the runtime working copy after "Übernehmen" and "Zurücksetzen".

## 2. Status

`partial` — fix, regression test and browser check are committed on branch `claude/transed-compare-cache` with a PR against `main`; not yet merged.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM`; worktree `/Users/uwefalz/Developer/ufAIM-transed-compare-cache`, branch `claude/transed-compare-cache`, baseline `origin/main` `d2ceee0`.
- Pre-existing changes: the shared checkout carries uncommitted edits by another stream in `app/view/editors/transitionEditorView.js` and `app/controllers/bridges/transitionEditorBridge.js` (popout `byId` lookup, `ownerDocument` pointer listeners); not touched, not included.
- Authorized: the two TransEd files, one new test, this report. Excluded: `docs/knowledgeKernel/`, worker/service code, all other streams' files.

## 4. Work Performed

- Cause: `_presetCache` in the view kept `desc`/`base` per preset forever; `samplePreset(id)` without cuts (used by `renderCompare`) returned the curve of the persisted partition after a working-copy change.
- Fix: the view exposes `invalidatePreset(presetId)` (drops the cache entry, resets the auto-range key, reloads the spec); the bridge calls it in `applyWorkingCopy` and `resetWorkingCopy` before `reloadCatalogue`.
- Modularization: no duplication added; the fix reuses `ensurePresetLoaded` and the existing `Transition.GetPresetSpec` command. No extraction opportunity in this bounded change (deferral justified by scope).

## 5. Changed Files

- Added: `test/app/workspace/transed-compare-working-copy.test.mjs`, `docs/app/architecture/MISSION_REPORT_TRANSED_COMPARE_CACHE_001.md`
- Modified: `app/view/editors/transitionEditorView.js`, `app/controllers/bridges/transitionEditorBridge.js`
- Moved or renamed: None
- Deleted: None

## 6. Evidence and Validation

- New test, `node --test test/app/workspace/transed-compare-working-copy.test.mjs`: `passed` (4/4); with the two app files stashed: `failed` (0/4), so the test detects the defect.
- Full suite, `node --test 'test/**/*.test.mjs'`: 2380 tests, 21 failures; baseline `d2ceee0` without the change: 2376 tests, the same 21 failures by name (`diff` of sorted names empty). Limitation: these 21 are pre-existing and unrelated to TransEd.
- Visible journey, headless Chrome against the served worktree (fresh profile, `Cache-Control: no-store`, port 8093): open TransEd, select `bloss`, enter 0.2/0.6/0.2, click `#teApply`, then `#teReset`; comparison polyline changes after apply (`60,165.52` → `60,162.31`) and returns after reset: `passed`. Control against the unfixed shared checkout (port 8094): polyline unchanged after apply: defect reproduced.
- Limitations: clicks and inputs were dispatched by script (secondary evidence under the visible-user-journey gate); the popout window was not exercised; the in-app browser pane cannot run the app (SharedWorker hello timeout).

## 7. Kernel and Architecture Impact

```text
Kernel impact: none
Architecture impact: none
RefImpl impact: changed
Thesis impact: none
```

RefImpl: TransEd view gains one cache-invalidation method; no command, contract or persisted data changed.

## 8. Conflicts, Risks, and Open Decisions

- Conflict: both modified files have uncommitted edits by another stream in the shared checkout; the hunks do not overlap textually (lines 45–47, 428–986 vs. the new block at 168 and the return object; bridge line 31 vs. 282–287), but ownership needs Rock's coordination.
- Risk: the comparison table shows only start/end/min/max of κ, which is 0/1/0/1 for any partition; only the curve makes the change visible.
- OD-1 (Uwe): decided (a) on 2026-11-10 — commit on `claude/transed-compare-cache` and PR against `main`.
- OD-2 (Uwe): merge the PR now, or after the other stream's TransEd edits have landed.

## 9. Handover

- Next safe step: decide OD-2; then merge the PR.
- Prerequisites: Rock confirms ownership of the two TransEd files.
- May touch: only the four files in section 5.
- Other streams can proceed independently.
- Done criterion: change is on `main`, the new test passes there, and one hand-operated apply/reset in TransEd shows the comparison curve following.
