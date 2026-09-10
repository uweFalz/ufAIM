# MISSION REPORT

## 1. Mission

Mission `DELIVERY1-SPEED-QUALIFIED-STATE-001`, responsible stream `app`, package `DELIVERY1-SPEED-QUALIFIED-STATE-001`: close the remaining Delivery-1 browser-journey gap by carrying source-declared speed evidence from a real LandXML import into the synchronized Alignment workspace, showing it visibly and truthfully, and preserving it across close/reopen. The result must remain `evidence-only` and `admissible=false`; no speed unit or rule-derived admissibility may be invented.

## 2. Status

`complete` — the real `SCx_1720.xml` import now exposes A101720R speed evidence at the shared intrinsic cursor in Main, q · Lok, and L · Bänder. At `s=0` the visible value is `sourceSpeed 120`, `unit not-declared`, `support exact-source-record`, `sourceType CantStation`, with `partial-evidence · provenance present · evidence-only · admissible=false · SOURCE_SPEED_NOT_ADMITTED_AS_CONSTRUCTIVE_STATE`. The same state survives close and normal reopening through `Vorhandene Objekte`.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM`.
- Isolated worktree: `/private/tmp/ufAIM-delivery1-speed-0910`.
- Branch: `codex/delivery1-speed-qualified-0910`.
- Baseline: `origin/main` at `cacc1925e688708486d9aa1e385e5c82c51051e3`.
- Authorized scope: existing LandXML import outcome, synchronized Alignment profile projection/view-model boundary, Alignment Intelligence/HUD projection, promotion readback, and focused tests under `app/`, `src/`, `test/`, plus this report.
- Explicit exclusions: `docs/knowledgeKernel/`, Thesis, Viewer/technetViewer, IVHW, new packages, architectural modularization, unrelated UX polish, and the dirty shared checkout.
- The shared checkout's unrelated Thesis, technetViewer, `.claude`, and other working-tree changes were not pulled, merged, stashed, edited, or attributed to this mission. All work was performed in the fresh isolated worktree from `origin/main`.

## 4. Work Performed

- Retained explicit `CantStation.speed` and `SpeedStation.speed` values as source-declared Alignment attachments and added a fail-closed speed admission record.
- Projected source speed records onto the shared intrinsic-`s` cursor without assuming a speed unit. Exact source records and equal-valued bracketing records are distinguished; unequal bracketing records remain visible as separate evidence facts.
- Added the `speed` lane to the synchronized Alignment profile projection and carried both `speed` and canonical `state` through `createAlignmentProfileViewModel`; this closes the observed loss boundary between the service projection and the workspace journey.
- Added the speed capability to Alignment Intelligence and its HUD, preserving `admission` and tri-state `admissible` metadata through the domain/view boundary.
- Extended promoted-Alignment readback to require the speed lane together with vertical, cant, and chainage, preventing a silent successful activation when the speed projection is missing.
- Rendered `evidence-only` and `admissible=false` visibly in the compact HUD and q-Lok status text.
- Exercised a real fresh-origin browser journey with `/Users/uwefalz/Developer/ufAIM/test/samples/SCx/SCx_1720.xml`: start map, visible file selection, 12 import candidates, A101720R promotion/display, synchronized speed evidence in Main/q/L, tab closure, `Vorhandene Objekte`, and lossless reopening.

## 5. Changed Files

Added:

- `docs/app/architecture/MISSION_REPORT_DELIVERY1_SPEED_QUALIFIED_STATE_001.md`

Modified:

- `app/controllers/alignment-profile/createAlignmentProfileViewModel.js`
- `app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js`
- `app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js`
- `app/domain/workspace/buildAlignmentEngineeringHudModel.js`
- `app/domain/workspace/buildExistingAlignmentIntelligenceModel.js`
- `app/view/workspace/ExistingAlignmentIntelligenceView.js`
- `src/import/build/buildAlignmentImportOutcome.js`
- `src/services/alignment/createSynchronizedAlignmentProfileProjection.js`
- `test/app/alignment-profile/alignment-profile-synchronized-controller.test.mjs`
- `test/app/import/source-declared-alignment-attachments.test.mjs`
- `test/app/workspace/alignment-engineering-hud.test.mjs`
- `test/services/alignment/synchronized-alignment-profile-projection.test.mjs`

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- Focused automated suite — command `node --test test/app/alignment-profile/alignment-profile-synchronized-controller.test.mjs test/app/import/source-declared-alignment-attachments.test.mjs test/services/alignment/synchronized-alignment-profile-projection.test.mjs test/app/workspace/existing-alignment-intelligence-journey.test.mjs test/app/workspace/alignment-engineering-hud.test.mjs test/app/workspace/canonical-workspace-reopen-rail-pair-semantic-readback.test.mjs`; result `passed`: 25 tests, 25 passed, 0 failed. Coverage includes source speed preservation, absent-speed fail-closed behavior, view-model transport, HUD admission visibility, promoted readback, and canonical reopen. Limitation: this is focused regression coverage, not the entire repository test suite.
- Diff integrity — command `git diff --check`; result `passed`. Limitation: rerun after any later rebase conflict resolution.
- Fresh-origin browser acceptance — repository-root server `/private/tmp/ufAIM-delivery1-speed-0910`, port `8193`, URL `http://127.0.0.1:8193/`; result `passed`. Normal visible path imported the real `SCx_1720.xml`, showed 12 candidates, promoted A101720R, and displayed the exact speed evidence quoted in section 2 in Main, q · Lok, and L · Bänder. The file completed quickly enough that the active busy state was not captured in the final DOM snapshot; the terminal candidate state and resulting engineering state were captured, and no success was inferred from test counts alone.
- Close/reopen browser acceptance — closed all `127.0.0.1:8193` application tabs, opened a new tab on the same fresh origin, selected `Vorhandene Objekte`, reopened A101720R, and read the synchronized HUD; result `passed`. Horizontal, vertical, cant, speed, and chainage remained available, with speed unchanged as `sourceSpeed 120`, `unit not-declared`, `evidence-only`, `admissible=false`. Limitation: source speed is evidence, not constructive authorization.
- Real-source parser check — browser-executed LandXML parser against `/Users/uwefalz/Developer/ufAIM/test/samples/SCx/SCx_1720.xml`; result `passed`: A101720R contained 63 cant/speed records, including first `CantStation.speed=120` and later `SpeedStation` records. Limitation: the source document declares no speed unit, so the UI intentionally says `unit not-declared`.

## 7. Kernel and Architecture Impact

Kernel impact: none

Architecture impact: conforming — the implementation uses the existing source-attachment, synchronized projection, Alignment Intelligence, and fail-closed admission boundaries. It does not introduce or redefine a Knowledge Kernel concept.

RefImpl impact: changed — source-declared speed evidence is now visible and persistent in the Reference Application's synchronized Alignment workspace.

Thesis impact: none

## 8. Conflicts, Risks, and Open Decisions

- No parallel-file conflict was observed; the dirty shared checkout remained untouched.
- The source speed unit is absent. This is intentionally rendered as `unit not-declared`; changing it to km/h or another unit requires qualified source/rule evidence and is not authorized here.
- Four unread Ril 800.0110 limits continue to keep the result `evidence-only` and `admissible=false`. They do not block this visible Delivery-1 journey.
- No decision from Uwe is required for this package.

## 9. Handover

The next safe step is to integrate the isolated branch tip into `origin/main` under the already granted push/merge gate, then run a short smoke reopen from `main`. Prerequisites are a clean integration check against the current `origin/main` and preservation of unrelated shared-checkout work. The integration may touch only the files listed in section 5. Thesis, Research, and Viewer streams can proceed independently because no Kernel or Thesis files changed. Done criterion for the next package: `origin/main` contains this report and implementation, the focused suite remains green, and a `main`-served browser reopen still displays A101720R speed as explicit unitless source evidence with `evidence-only` and `admissible=false`.
