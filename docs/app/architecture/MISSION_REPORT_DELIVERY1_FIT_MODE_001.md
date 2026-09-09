# MISSION REPORT

## 1. Mission

Mission `APP-DELIVERY1-FIT-MODE-001`, responsible stream `app`: put the decided length-prior question (`AXTRAN2_LENGTH_PRIOR_PROPOSAL.md`, decision A on 2026-09-09) into the visible horizontal edit journey — one choice before the fit, one sentence in the result — without applying a proposal or promoting it to canonical truth.

## 2. Status

`review-required`

The Alignment editor carries a fit-mode select (keep the plan with σ 5 %, samples only), the consequence evidence runs with the corresponding length prior, and the verified receipt says in one sentence which mode ran and which lengths the samples did not determine. Independent review and integration remain required.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM-app`
- Branch: `feat/delivery1-fit-prior`
- Baseline: `origin/main` at `7ac415d897375a93fec6a8ea0686fb437430bf1b`
- Pre-existing changes: none
- Authorized scope: editor fit-mode control, evidence service fit mode and length prior, receipt sentence and rendering, i18n (de, en), focused tests
- Excluded: shared checkout `/Users/uwefalz/Developer/ufAIM`, canonical mutation by AXTRAN2, proposal acceptance, Viewer/technetViewer, Thesis, the solver itself (unchanged since #30)

The dirty shared checkout and its foreign Thesis, technetViewer, and `.claude` work were not modified, pulled, merged, or stashed.

## 4. Work Performed

- `AlignmentAxtranEvidenceService.evaluateChange` takes `fitMode` (`keep-plan` default, `measurements-only`) and `planSigma` (0.05), passes `lengthPrior` to the solver for `keep-plan`, and reports `fitMode`, `planSigma` and `undetermined` — the lengths the samples did not determine, by element with the play of the direction each leads, from `diagnostics.determinacy` (#30). Version 0.2.
- The Alignment editor shell carries `aeFitMode` with two options; the bridge reads it when the edit is applied and hands it to the evidence service. The choice is not stored.
- `buildHorizontalRealizationChangeReceipt` adds `diagnostics.fitMode` and one sentence: "Fit hielt den bearbeiteten Plan (σ 5 %), wo die Proben gleichgültig waren; von den Proben nicht bestimmt: T1, A1." or "Fit folgte nur den Proben; …". Evidence without a fit mode (0.1 producers) yields `null`, never a made-up sentence.
- The receipt view renders the sentence (`data-fit-mode`) and two rows, fit mode and undetermined lengths, on the existing evidence-only surface.
- i18n: three keys in `strings.de.js` and `strings.en.js`.

## 5. Changed Files

Added:

- `docs/app/architecture/MISSION_REPORT_DELIVERY1_FIT_MODE_001.md`

Modified:

- `src/services/alignment/AlignmentAxtranEvidenceService.js`
- `app/view/shell/buildWindowShell.js`
- `app/controllers/bridges/alignmentEditorBridge.js`
- `app/domain/workspace/buildHorizontalRealizationChangeReceipt.js`
- `app/view/workspace/renderHorizontalRealizationChangeReceipt.js`
- `app/i18n/strings.de.js`
- `app/i18n/strings.en.js`
- `test/services/alignment/alignment-axtran-evidence-service.test.mjs`
- `test/app/workspace/horizontal-realization-change-receipt.test.mjs`
- `test/app/workspace/horizontal-realization-change-receipt-visible.test.mjs`

## 6. Verification

- Focused: `node --test test/services/alignment/alignment-axtran-evidence-service.test.mjs test/app/workspace/horizontal-realization-change-receipt.test.mjs test/app/workspace/horizontal-realization-change-receipt-visible.test.mjs test/app/workspace/horizontal-realization-change-receipt-boundary.test.mjs test/app/alignment-profile/alignment-radius-edit-visible-consequence-journey.test.mjs test/app/workspace/horizontal-sequence-control-visible.test.mjs`; passed, 14/14 (three new).
- Whole tree: 1618 of 1630. The twelve failures are the environment of this worktree (`mdb-reader` not installed under `src/import/parsers/technet/gndEdit/mdb`, `rg` not installed) and one pre-existing on the baseline: `canonical Sparse body mechanically preserves the productive baseline` fails with the working tree stashed as well.
- Not verified in a browser: the select's rendering and the sentence on the live surface. The visible tests are source-level.

## 7. Risks and Open Points

- The evidence fit runs with `maxIterations` 12 as before; with the prior it converges on the service's own fixtures, and on larger alignments it reports what it reached — evidence-only either way.
- The sentence is German on a surface whose other labels are English; the surface was already mixed.
- The user's choice is read at apply time and not remembered, by decision; a remembered default is a product question.

## 8. Next Step

Review, then integrate. Browser check of the editor select and the receipt sentence on a real edit.

## 9. Effort

Three commits, one session.
