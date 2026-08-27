# MISSION REPORT

## 1. Mission

- Mission name: Awaited Canonical Reopen Profile Readback
- Responsible stream: `app`
- Requested objective: confirm canonical reopen only after exact synchronized profile projection readback at the rehydrated Alignment revision and unchanged intrinsic cursor.
- Package identifier: `CANONICAL_REOPEN_PROFILE_READBACK_001`

## 2. Status

complete

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM`
- Branch: `main`
- Baseline commit: `c53ae7b`
- Authorized production files: `app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js`, `app/runtime/init/initFeatures.js`.
- Authorized tests: the narrow direct Journey, Reopen, promoted-evidence, and focused profile-readback tests.
- Explicit exclusions: open Rail-Pair presentation files, Thesis, `.claude`, `technetViewer.html`, IVHW, Knowledge Kernel, AIM Core, new mathematics, state contracts, persistence formats, and a claim of awaited horizontal-surface rendering.
- Pre-existing excluded changes were preserved. A final path-scoped diff and full working-tree status were used to check ownership overlap.

## 4. Work Performed

- Injected the existing `alignmentProfileSynchronizedView` as `profileSource` into the canonical Alignment workspace journey.
- Transported the explicit canonical `AlignmentData.revision` from SPOT rehydration into the activation orchestration.
- Required an explicit non-null revision and an available `profileSource.refresh()` port before reopen can succeed.
- Awaited the existing synchronized refresh Promise after canonical rehydration.
- Rechecked active Alignment identity and intrinsic cursor after the awaited refresh.
- Required projection status `projected`, exact Alignment ID, structurally equal revision, cursor kind `intrinsic-s`, exact cursor value, and explicit `vertical`, `cant`, and `chainage` fields.
- Added stable fail-closed results for unavailable revision or port, refresh failure, changed active context, and mismatched readback.
- Preserved the architectural boundary: the package does not claim that the separate Main horizontal rendering surface is awaited.

## 5. Changed Files

Added:

- `test/app/workspace/canonical-workspace-reopen-profile-readback.test.mjs`
- `docs/app/architecture/aim-core/services/MISSION_REPORT_CANONICAL_REOPEN_PROFILE_READBACK_001.md`

Modified:

- `app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js`
- `app/runtime/init/initFeatures.js`
- `test/app/workspace/promoted-alignment-main-q-l-journey.test.mjs`
- `test/app/workspace/gnd-promoted-evidence-workspace.test.mjs`
- `test/app/import/gnd-relation-review-confirm.test.mjs`

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- Focused canonical readback, direct Journey, promoted-evidence, GND relation-rehydration, Guided Start, visible start, and Reopen boundary tests: `node --test test/app/workspace/canonical-workspace-reopen-profile-readback.test.mjs test/app/workspace/promoted-alignment-main-q-l-journey.test.mjs test/app/workspace/gnd-promoted-evidence-workspace.test.mjs test/app/import/gnd-relation-review-confirm.test.mjs test/app/workspace/alignment-workspace-guided-start.test.mjs test/app/workspace/alignment-workspace-guided-start-visible.test.mjs test/app/workspace/alignment-workspace-guided-start-boundary.test.mjs`; passed after implementation.
- The focused readback tests prove that an unresolved profile refresh prevents early Journey resolution and that foreign status, identity, revision, cursor kind/value, missing lanes, changed active context, and refresh failure all reject.
- JavaScript syntax checks on both modified production files and the new test: passed.
- `git diff --check` on all package-owned files: passed.
- Browser acceptance: not run because no controllable browser backend was available; no harness was injected into the application.
- Commit and push: not run, as instructed.

## 7. Kernel and Architecture Impact

Kernel impact: none

Architecture impact: conforming

The Journey awaits an existing application projection port and validates its existing result contract. It creates no state, persistence, geometry, or calculation authority.

RefImpl impact: changed

Canonical Alignment reopen now waits for exact synchronized profile readback before reporting success.

Thesis impact: none

## 8. Conflicts, Risks, and Open Decisions

- The synchronized profile contract exposes `vertical`, `cant`, and `chainage`, but no horizontal surface result. Horizontal Alignment state remains preserved in canonical `AlignmentData` and rendered by the separate Main view controller.
- This package therefore does not claim a fully awaited horizontal Main-surface readback. Establishing such proof requires a separate completion/readback port from the Main view controller.
- No Rail-Pair initialization decision was made or implied.
- No decision from Uwe is required.

## 9. Handover

- Next safe step: review and commit the seven package-owned files separately from all open Rail-Pair and Thesis work.
- Prerequisite: keep unrelated working-tree files out of the commit.
- Rail-Pair presentation may continue independently because no shared file was modified.
- Exact browser done criterion: reopen a persisted Alignment through `Weiterarbeiten`; verify the dialog remains pending until the synchronized profile region, longitudinal view, Cant/cross-section, and their synchronous subscribers show the same Alignment ID, revision, and intrinsic cursor; then confirm closure. Any missing revision, mismatch, context change, or refresh failure must keep the normal Reopen path fail-closed.
