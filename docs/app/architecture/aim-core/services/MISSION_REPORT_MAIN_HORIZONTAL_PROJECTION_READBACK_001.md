# MISSION REPORT

## 1. Mission

- Mission name: Awaited Main Horizontal Projection Readback
- Responsible stream: `app`
- Requested objective: confirm canonical reopen only after the visible Main horizontal projection reports the same canonical Alignment identity, revision, and intrinsic cursor.
- Package identifier: `MAIN_HORIZONTAL_PROJECTION_READBACK_001`

## 2. Status

complete

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM`
- Branch: `main`
- Baseline commit: `a7833e1`
- Authorized production files: `app/controllers/viewController.js`, `app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js`.
- Authorized tests: focused horizontal readback and the narrow direct Journey fixtures.
- Explicit exclusions: open Rail-Pair presentation files, Thesis, `.claude`, `technetViewer.html`, IVHW, Knowledge Kernel, AIM Core, new geometry, state or persistence authority.
- Pre-existing excluded changes were preserved and checked with path-scoped diff plus full working-tree status.

## 4. Work Performed

- Reused the existing complete async Main render handler for both subscriptions and explicit readback; no second rendering path was created.
- Added `refreshHorizontalProjection()`, which invalidates SPOT and geometry caches before awaiting the existing render. This prevents a same-ID stale canonical revision from being acknowledged.
- Transported revision only from `activeGeometry.spotObject.data.alignmentData.revision`, guarded by explicit own-property presence.
- Added a frozen presentation-only envelope containing `status`, `objectId`, canonical `revision`, qualified `intrinsic-s` cursor, `projectionSignature`, `mode`, and `selectedElementId`.
- Returned no successful envelope for preview mode, missing identity or revision, missing projection signature, invalid cursor, absent track, or render failure.
- Extended canonical reopen to require and await both the existing synchronized profile readback and the new Main horizontal readback.
- Rechecked the active Alignment and cursor after both awaits, and required exact horizontal identity, revision, cursor, active mode, and projection signature before success.
- Added stable fail-closed codes for unavailable, failed, or mismatched Main horizontal readback.

## 5. Changed Files

Added:

- `test/app/workspace/main-horizontal-projection-readback.test.mjs`
- `docs/app/architecture/aim-core/services/MISSION_REPORT_MAIN_HORIZONTAL_PROJECTION_READBACK_001.md`

Modified:

- `app/controllers/viewController.js`
- `app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js`
- `test/app/workspace/canonical-workspace-reopen-profile-readback.test.mjs`
- `test/app/workspace/promoted-alignment-main-q-l-journey.test.mjs`
- `test/app/workspace/gnd-promoted-evidence-workspace.test.mjs`

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- Focused Main horizontal envelope and boundary tests: `node --test test/app/workspace/main-horizontal-projection-readback.test.mjs`; passed, 3 tests, 0 failures.
- Combined canonical Reopen, delayed profile and horizontal completion, direct Journey, promoted evidence, GND rehydration, and Guided Start regression suite: passed after implementation.
- Tests prove that delayed horizontal completion prevents early Journey success and that missing port, refresh failure, foreign identity/revision/cursor, preview mode, or missing signature fail closed.
- Source boundary tests prove cache invalidation, await of the existing render handler, canonical AlignmentData revision access, absence of `modifiedAt` fallback, and absence of persistence ownership.
- JavaScript syntax checks on changed production and test files: passed.
- `git diff --check` on all package-owned files: passed.
- Browser acceptance: not run because no controllable browser backend was available; no application harness was injected.
- Commit and push: not run, as instructed.

## 7. Kernel and Architecture Impact

Kernel impact: none

Architecture impact: conforming

The new port awaits and reports an existing presentation render. It does not define geometry, canonical state, revision, or persistence semantics.

RefImpl impact: changed

Canonical reopen now requires exact, awaited Main horizontal and synchronized profile readback before success.

Thesis impact: none

## 8. Conflicts, Risks, and Open Decisions

- `projectionSignature` remains presentation identity only and is never used as a substitute for canonical revision.
- The port can acknowledge only projectable active horizontal geometry. Empty, invalid, or preview geometry remains fail-closed by design.
- No Rail-Pair initialization decision was made or implied.
- No decision from Uwe is required.

## 9. Handover

- Next safe step: review and commit the seven package-owned files separately from all open Rail-Pair and Thesis work.
- Prerequisite: keep unrelated working-tree files out of the commit.
- Rail-Pair presentation can continue independently because no shared file was modified.
- Exact browser done criterion: reopen persisted Alignment `A1` at canonical revision `R2` and intrinsic cursor `s`; keep the workbench pending until Main projection, track and cursor plus synchronized profile/longitudinal/Cant/cross-section complete; require both receipts to report `A1`, `R2`, and the same `intrinsic-s`; then close. Same-ID stale cache, preview, missing revision/signature, context change, or render failure must remain fail-closed.
