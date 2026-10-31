# MISSION REPORT

## 1. Mission

APP-AXTRAN-HOLDERS-20261031. Responsible stream: app. Repair the remaining representation mismatch between imported zero-length fixed holders and the App AXTRAN evidence service, under Rock's delegated continuation of Uwe's direct App repair/acceptance instruction.

## 2. Status

review-required

The bounded service correction and offline regression suite are ready for independent Root validation and renewed normal Browser acceptance. No convergence or Delivery 1 acceptance is claimed.

## 3. Baseline and Scope

Repository root: /Users/uwefalz/.codex/worktrees/aim-branches-integration-20261030/ufAIM.
Branch: codex/aim-branches-integration-20261030.
HEAD: 1697b75824d55bdeaa52280866be7760261e5e77.

Existing uncommitted work comprises the frozen TRA import correction, the materialization/sparse-builder holder correction, their tests/reports, and Root's corpus contract test. These were not edited by this package. Ownership is limited to src/services/alignment/AlignmentAxtranEvidenceService.js, test/services/alignment/alignment-axtran-zero-holder.test.mjs, and this report. Root explicitly confirmed the preceding browser and server had ended before edits began. No browser, listener, main, Git commit/push, original import patch, storage migration, or docs/knowledgeKernel operation occurred in this mission.

## 4. Work Performed

The preceding normal Browser run passed radius editing, saving, and first reopening, but the evidence service truthfully refused the corrected geometry because declaredElements required strictly positive length for every non-immediate element. This was a declaration mismatch: existing CLI fitTraCore already declares the TRA loader's held zero-length junction arcs with both length and curvature held.

The App service now recognizes only the existing explicit meta.zeroLength === true marker on arc/straight elements whose effective source length is exactly numeric zero. It retains these elements in the declaration sequence and analytic/production geometry chains. Their length and, for arcs, curvature are declared held rather than free. They therefore do not appear in the free-variable vector or free overlay and retain their source values during evaluation. Missing markers, false marker strings, negative/nonfinite lengths, and falsely marked positive lengths remain rejected. Marked transitions are not silently reinterpreted as fixed holders.

The already supported per-element minimum-length map gives qualified holders a zero lower bound and every other declared element the existing 0.001 bound. This prevents an artificial minimum-length violation for a held zero quantity without loosening ordinary segments. Solver equations, codec, Kernel geometry, held-pose rules, automatic application policy, and the interactive variable threshold are unchanged.

Independent review found a dual-field authority mismatch: a held holder with curvature 0.002 and radius 250 was constructed with production curvature 0.004, while the analytic chain read 0.002. Because held quantities have no overlay, the usual free-curvature overlay reconciliation could not correct it. The holder-only curvature resolver now follows the production sparse builder's radius-first precedence, rejecting an explicit zero/nonfinite radius or a nonfinite/zero reciprocal. Ordinary non-holder resolution remains unchanged. This is an implementation consistency correction, not a new curvature convention.

The returned heldElements field deliberately keeps its prior meaning: explicit caller-provided held element IDs only. Intrinsic holder quantities are additionally held by declaration, identifiable by the existing marker in geometry; they are not presented as a new user hold request. The external-observation evaluatedInput preserves original input geometries and options, including the original explicit heldElements array. No result schema or version change was introduced.

## 5. Changed Files

Added:

- test/services/alignment/alignment-axtran-zero-holder.test.mjs
- docs/app/architecture/MISSION_REPORT_APP_AXTRAN_HOLDERS_20261031.md

Modified:

- src/services/alignment/AlignmentAxtranEvidenceService.js

Moved or renamed: None.

Deleted: None.

Prior mission and Root-owned changes are excluded from this list.

## 6. Evidence and Validation

Passed: node --test test/services/alignment/alignment-axtran-zero-holder.test.mjs test/services/alignment/alignment-axtran-evidence-service.test.mjs test/services/alignment/alignment-point-observation-input.test.mjs — 43/43 checks, zero failed, zero skipped. Nine checks are new; counts overlap and must not be added.

The new suite covers straight and positive/negative arc holders, no free variables/overlays for holders, unchanged input, unchanged endpoint/total length on identical geometry, malformed/unmarked holder refusal, explicit held element compatibility, a held pose after a holder, invalid held IDs, external-observation evaluatedInput fidelity/freeze, and the physical 5500R074-082.TRA fixture. The initial author test incorrectly expected held quantities in codec.decode's free overlay; inspection confirmed the established free-only contract and assertions were corrected without changing that product contract.

The added authority regression compares the reviewer's conflicting dual-field holder against its production-equivalent normalized declaration through three real iterations, requiring identical candidate, diagnostics, and status with no input mutation. Explicit parameter-level and element-level invalid radii (zero, NaN, infinities, reciprocal overflow) are refused rather than replaced by the finite curvature field. The preceding 41-test freeze and Browser run are historical; this final 43-test freeze supersedes their service source identity.

Physical fixture result: 69 edit elements, five fixed holders retained, 17 immediate transitions excluded from declarations exactly as before, 67 free variables, threshold 96. maxIterations: 0 returns proposalStatus max_iterations, zero iterations, evidence-only, admissible:false. The 47 overlay entries correspond only to elements containing free quantities; absence of a held holder's patch preserves its values. This is evidence behavior, not solver convergence, fit quality, field acceptance, or a speed guarantee for positive iteration budgets. The fixture test explicitly skips only when the local corpus is unavailable; it ran here.

Passed: git diff --check. Not run by this mission: renewed browser, actual IndexedDB persistence, full integrated suite, or publication. Root owns those independent checks.

SHA256 freeze:

- src/services/alignment/AlignmentAxtranEvidenceService.js: 21acdaf59053320f73f3c664639ff32443b62be7069161e7c3aef1c44491c65a
- test/services/alignment/alignment-axtran-zero-holder.test.mjs: fddb420949526dbdfbf183bb293c1993a94a96b3f48bbe0e490ea545187e2bc7

## 7. Kernel and Architecture Impact

Kernel impact: none
Architecture impact: conforming
RefImpl impact: changed
Thesis impact: none

The App evidence adapter now expresses existing fixed-holder semantics through existing held quantities and per-element bounds, matching the established solver/CLI representation. No new mathematical law, canonical entity, storage authority, or Kernel definition is introduced. The Reference Application can produce honest AXTRAN consequence evidence for the imported holder-containing alignment instead of refusing its declaration.

## 8. Conflicts, Risks, and Open Decisions

No new decision for Uwe or ownership conflict. Effective intrinsic holds are not identical to the explicit heldElements output list; their provenance remains the existing marker in the input geometry. Ordinary unmarked zero-length fixed elements are unsupported. Existing immediate-transition exclusion and unknown-source limitations remain unchanged. A maxIterations0 evidence result is not a convergence claim; browser default iteration behavior and broader full-App acceptance require their own evidence. Earlier Browser refusal remains historical evidence and must not be retroactively rewritten as success.

## 9. Handover

Root can verify the frozen service/test hashes, run independent integrated checks, and repeat the authorized normal Browser journey from a fresh source identity. The package's done criterion is that the real holder-containing import supports radius editing and truthful AXTRAN evidence with unchanged fixed holders, then saves and first-reopens the same declared state and receipt. Remaining Browser evidence belongs to Root; this report requests no solver/core expansion or additional mission.
