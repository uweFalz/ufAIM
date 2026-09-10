# MISSION REPORT

## 1. Mission

Mission `DELIVERY1-IMPORT-LATENCY-001`, responsible stream `app`, package `DELIVERY1-IMPORT-LATENCY-001`: remove the proven interactive latency blocker on the real `SCx_1720.xml` import path so the normal browser flow reaches the visible twelve-candidate result within a fixed 30-second budget, without changing import, admission, source-attachment, or persistence truth.

## 2. Status

`complete` — after rebase onto current `origin/main`, the real-file import reached the terminal visible result `Import result · 12 Kandidaten` in `21534 ms` on a fresh browser origin, inside the 30-second budget.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM`.
- Isolated worktree: `/private/tmp/ufAIM-delivery1-import-latency-0910`.
- Branch: `codex/delivery1-import-latency-0910`.
- Mission-start baseline: `origin/main` at `6a591b57c05e7650a987a6795ae22e8ab237d56d`.
- Integration base after the non-overlapping rebase: `origin/main` at `a9d71245af04870e767f349317bf583413492210`.
- Authorized scope: the pre-admission import-preview projection path, its controller seam, focused tests, and this report.
- Pre-existing shared-checkout changes in Thesis, technetViewer, `.claude/`, and generated artifacts were not present in or copied into the isolated worktree and were not touched.
- Explicit exclusions: `docs/knowledgeKernel/`, Thesis, IVHW, Viewer/technetViewer, importer semantics, admission decisions, source attachments, promoted engineering state, persistence, and unrelated UX work.

## 4. Work Performed

- Bounded the disposable import-map preview of each alignment to at most 256 uniformly spaced points while retaining both alignment endpoints.
- Disabled per-element segment and boundary resampling for this import preview because the adapter consumes only the projected polyline and bounding box.
- Added optional `maxPoints` and `includeSegments` controls to the shared projection seam with defaults that preserve every existing non-import caller's behavior.
- Added a behavioral regression test that projects a 100 km alignment through the real import-preview adapter and proves the 256-point cap plus endpoint retention.
- Kept import candidates, evidence status, admission status, source attachments, promotion, and persisted geometry outside the optimization path.

## 5. Changed Files

Added:

- `test/app/import/import-preview-sampling-budget.test.mjs`
- `docs/app/architecture/MISSION_REPORT_DELIVERY1_IMPORT_LATENCY_001.md`

Modified:

- `app/io/import/importVisibleTracksAdapter.js`
- `src/domain/projection/AlignmentProjectionService.js`
- `src/domain/projection/ViewProjectionController.js`

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- Prior blocker evidence from `docs/app/architecture/MISSION_REPORT_DELIVERY1_SOURCE_ATTACHMENT_VISIBILITY_001.md`: normal-start import of `/Users/uwefalz/Developer/ufAIM/test/samples/SCx/SCx_1720.xml` took `972441 ms` before twelve candidates became visible — `passed` as baseline evidence.
- Independent pre-change reproduction: repository-root server from baseline worktree on `http://127.0.0.1:8172/`; user action at `2026-09-10T09:38:55.686Z`, first `Import.CommitJob` at `2026-09-10T09:50:45.542Z`, approximately `709856 ms` — `passed`; limitation: the console timestamp delimits action-to-commit rather than the final paint.
- Final normal-start browser acceptance: repository-root server `/private/tmp/ufAIM-delivery1-import-latency-0910`, unused port `8177`, URL `http://127.0.0.1:8177/`; clicked the visible `Daten hineinziehen` control, selected the real `test/samples/SCx/SCx_1720.xml`, and observed terminal UI `Import result · 12 Kandidaten` with four alignment candidates plus profile, cant, and station-equation evidence — `passed` in `14951 ms`; no error and no unexplained disappearance.
- Post-rebase browser acceptance on current `origin/main`: same isolated repository-root server on unused port `8179`, URL `http://127.0.0.1:8179/`; the same visible control and real file produced the same terminal twelve-candidate UI — `passed` in `21534 ms`; no error, with the complete result confirmed in the rendered body. The incoming AXTRAN FIT package had no file overlap with this package.
- Candidate integrity in the terminal UI: alignments `A101720L`, `A101720M`, `A101720R`, and `A101720S` remained qualified; profile/cant/staEq entries remained explicitly partial/non-promotable — `passed`; limitation: this package did not repeat the already-proven promotion, AXTRAN, save, close, and reopen stages.
- Behavioral preview-budget test: `node --test test/app/import/import-preview-sampling-budget.test.mjs` — `passed`, 2 tests, 0 failures; verifies 256 points and exact first/last point for a 100 km alignment.
- Delivery regression selection after rebase onto current `origin/main`: `node --test test/app/import/source-declared-alignment-attachments.test.mjs test/app/import/import-preview-sampling-budget.test.mjs test/app/workspace/promoted-alignment-workspace-journey.test.mjs test/app/alignment-profile/*.test.mjs test/services/alignment/*.test.mjs test/gnd-import-evidence.test.mjs test/axtran2/corpus/corpus.test.mjs test/axtran2/symmetric-eigen.test.mjs` — `passed`, 343 total, 333 passed, 10 fixture-dependent skips, 0 failed; limitation: the ten corpus skips report samples not checked out in this worktree.
- Whitespace validation: `git diff --check` — `passed`.

## 7. Kernel and Architecture Impact

Kernel impact: none

Architecture impact: conforming

RefImpl impact: changed

Thesis impact: none

The Reference Implementation now gives the existing pre-admission representation adapter an explicit bounded preview budget. Projection defaults remain unchanged, and no architectural concept or Knowledge Kernel meaning was added or altered.

## 8. Conflicts, Risks, and Open Decisions

- `RISK-APP-D1-ATTACH-001` is closed for the declared 30-second import-to-visible-candidates budget on the tested real SCx path.
- `RISK-APP-D1-LATENCY-001`: the 256-point import preview is intentionally an overview representation; canonical imported sparse geometry and the promoted alignment remain full fidelity. Future UI that consumes import-preview segment boundaries must not assume they are present when `includeSegments: false` is selected.
- Delivery 1 remains `ROT`: this package proves only the import stage's interactive latency and does not replace the complete uninterrupted gate through selection, radius edit, visible AXTRAN consequences, synchronized views, save, close, and lossless reopen.
- Conflicts with parallel missions: None; the shared dirty checkout was not modified.
- Open decisions: None.

## 9. Handover

The next safe step is to run the complete uninterrupted Delivery 1 browser journey from the integrated commit on a fresh origin, using `SCx_1720.xml`. It may touch only the already-scoped Reference Application path if that journey exposes a concrete blocker; `docs/knowledgeKernel/`, Thesis, IVHW, and Viewer/technetViewer remain excluded. Other streams may proceed independently provided they do not edit the five files owned by this package before integration. Exact done criterion for the next package: normal start → real import within 30 seconds → visible alignment selection → radius change → visibly marked evidence-only AXTRAN consequences → synchronized Horizontal/Vertical/Cant/Chainage/cross-section views → save → close → lossless reopen, with no false success or disappearing engineering state.
