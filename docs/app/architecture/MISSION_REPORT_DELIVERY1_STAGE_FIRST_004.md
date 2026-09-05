# MISSION REPORT

## 1. Mission

Mission `APP-DELIVERY1-STAGE-FIRST-004`, responsible stream `app`, package `APP-DELIVERY1-STAGE-FIRST-004`: remove automatic overlay and Cockpit dominance from the normal AIM start.

## 2. Status

`complete`

The normal start is stage-first. Workbench and Cockpit remain explicitly available but no longer cover or narrow the initial engineering stage.

## 3. Baseline and Scope

- Repository root: `/private/tmp/ufAIM-delivery1-stage-first`
- Branch: `codex/delivery1-stage-first`
- Package baseline: `origin/main` at commit `3bd219b`
- Pre-existing changes: none after the package baseline
- Authorized scope: initial Workbench visibility, initial Cockpit state, focused tests, mission report
- Excluded: shared checkout, map implementation, import semantics, Viewer/technetViewer, Thesis, `.claude/`, `docs/knowledgeKernel/`, AXTRAN, persistence, and redesign of Cockpit contents

## 4. Work Performed

- Removed the unconditional Workbench `showOverlay` call after initial workspace hydration.
- Kept workspace hydration active and all explicit Workbench entry actions intact.
- Started the shell with the Cockpit collapsed.
- Kept the Cockpit available through its existing explicit control.
- Updated the guided-start expectation and added a stage-first regression boundary.

## 5. Changed Files

Added:

- `test/app/workspace/alignment-workspace-stage-first-visible.test.mjs`
- `docs/app/architecture/MISSION_REPORT_DELIVERY1_STAGE_FIRST_004.md`

Modified:

- `app/gndImportWorkbench/gndImportWorkbenchController.js`
- `app/view/shell/buildWindowShell.js`
- `test/app/workspace/alignment-workspace-guided-start.test.mjs`

Moved, renamed, or deleted: None.

## 6. Evidence and Validation

- Focused stage, start, import, and Workspace matrix: `node --test test/app/workspace/alignment-workspace-start-title-visible.test.mjs test/app/workspace/alignment-workspace-stage-first-visible.test.mjs test/app/workspace/alignment-workspace-guided-start.test.mjs test/app/workspace/alignment-bim-workspace.test.mjs test/app/import/data-drop-visible-import-journey.test.mjs test/app/import/data-drop-visible-import-journey-boundary.test.mjs`; passed, 24/24.
- JavaScript syntax: `node --check app/gndImportWorkbench/gndImportWorkbenchController.js` and `node --check app/view/shell/buildWindowShell.js`; passed.
- Diff hygiene: `git diff --check`; passed.
- Browser acceptance: fresh repository-root server on port `8137`, URL `http://localhost:8137/`; passed. The old phrase was absent, `gndImportWorkbenchOverlay` had computed display `none`, the shell carried `is-cockpit-collapsed`, measured Cockpit width was `0`, and the full-width stage showed `Wo soll deine Trassierung entstehen?`.

## 7. Kernel and Architecture Impact

Kernel impact: none

Architecture impact: conforming

The change preserves existing controllers and explicit entry points while altering only initial presentation state.

RefImpl impact: changed

Thesis impact: none

## 8. Conflicts, Risks, and Open Decisions

- A real map or globe start remains separate work; this package only exposes the stage and removes automatic visual competition.
- No decision from Uwe is required for this package.

## 9. Handover

Next safe step: publish this package to `origin/main`, then validate the physical-import visibility package against the resulting baseline. Only the five files listed above belong to this package. Other streams may proceed independently. Done criterion met: on a fresh normal browser start, no tool overlay is open, the Cockpit does not consume stage width, the spatial stage is visually dominant, and Import/Workbench/Cockpit still open explicitly.
