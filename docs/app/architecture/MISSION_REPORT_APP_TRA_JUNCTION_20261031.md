# MISSION REPORT

## 1. Mission

APP-TRA-JUNCTION-20261031. Responsible stream: app. Implement the bounded correction for TRA-like transition junction curvature in the normal LandFAT-to-sparse import bridge, with focused independent regression expectations. User's direct “dann los” authorizes the repair and integrated App acceptance; Rock owns the latter and the corpus contract test.

## 2. Status

review-required

The bounded product correction and focused tests are ready for Rock's independent corpus validation and integrated acceptance. This report does not claim Browser or Delivery 1 acceptance.

## 3. Baseline and Scope

Repository root: /Users/uwefalz/.codex/worktrees/aim-branches-integration-20261030/ufAIM.
Branch: codex/aim-branches-integration-20261030.
Baseline: 1697b75824d55bdeaa52280866be7760261e5e77, product tree identical to main 39ce863 before this mission according to the delegated baseline. Initial inspected status was clean.

Owned files: src/import/build/buildSparseFromLandFAT.js, test/import/tra-junction-curvature.test.mjs, and this report. Root changed test/axtran2/tra-roundtrip-contract.test.mjs concurrently under separate ownership; no overlapping edit occurred. No commit, main edit, source integration, browser, process/listener, existing profile, or user data operation was performed by this app mission. Core, sparseWriter, parsers, writer, other protected candidates, and docs/knowledgeKernel remain unchanged by this mission.

## 4. Work Performed

The bridge previously discarded the explicit radiusStart/radiusEnd values of TRA-like Spirals. Existing enforceAlternation supplies zero-length fixed elements between adjacent transitions and at open transition boundaries, with default zero curvature. Those defaults erased a nonzero peak junction even though source records specified it.

After existing alternation and ID assignment, the adapter now binds the source curvature to those existing holders. TRA-like signed engineering radii map to mathematical curvature -1/R, with numeric zero explicitly representing a straight. Both endpoints must be finite numbers and yield finite curvature. Missing values, strings, booleans, nonfinite values, and reciprocal overflow are rejected. At an actual fixed neighbor, the declared endpoint must match its curvature within 1e-12; at a shared synthetic holder both transition declarations must agree within the same tolerance. Contradictions throw rather than alter a source fixed element.

The operation is gated by extras.sourceSemantics.formatClass === 'tra-like'. Nonqualified inputs, including neighbor-driven LandXML without declared endpoint radii, keep their prior behavior. Explicit unresolved type8 source declarations remain unresolved and reach the existing production transition-build refusal; they are not converted to known geometry by this correction.

No new sparse elements are added beyond the preexisting alternation output. IDs, sourceIndex metadata, holder metadata, and cant target ordering are preserved. The source LandFAT object is not mutated. No Kernel geometry or transition-family definition changes.

## 5. Changed Files

Added:

- test/import/tra-junction-curvature.test.mjs
- docs/app/architecture/MISSION_REPORT_APP_TRA_JUNCTION_20261031.md

Modified:

- src/import/build/buildSparseFromLandFAT.js

Moved or renamed: None.

Deleted: None.

The concurrent corpus contract test is Root-owned and is not attributed to this mission.

## 6. Evidence and Validation

Passed: node --test test/import/tra-junction-curvature.test.mjs test/technet-type8-bloss-import.test.mjs test/import/fitted-tra-production-roundtrip.test.mjs — 50/50 tests, zero failed, zero skipped. The new file contributes 13 tests; these counts overlap and must not be added.

The new tests cover positive/negative peak junctions through actual makeAlignment2DFromSparse, independent linear-clothoid curvature and integrated-heading expectations, open nonzero boundaries, matching fixed neighbors, inconsistent junctions and neighbors, missing/invalid radii at either end, explicit zero, unchanged nonqualified neighbor behavior, unresolved-type8 production refusal, input immutability, and unchanged IDs/metadata/cant references. Synthetic LandFAT fixtures are not survey evidence. The existing type8 suite covers parser and typed GND source behavior; the fitted-TRA suite covers actual bytes through both productive paths. No MDB/XLSX extraction or global geometry guarantee is claimed.

Passed: git diff --check, including the concurrent Root corpus-test diff as observed during handover.

Not run by this app mission: full corpus acceptance, integrated Browser acceptance, persistence against existing user data, remote publication. Root owns independent corpus and Browser validation.

Product/test SHA256 freeze:

- src/import/build/buildSparseFromLandFAT.js: d8d90e2843e9eb944a51c199b2d27564705940dffe9f840ef5ab08e1dca62a13
- test/import/tra-junction-curvature.test.mjs: edcf597cabf574a66fd09d64816ea32bb0c24e6104eb6baddd98510e0c98fe93

## 7. Kernel and Architecture Impact

Kernel impact: none
Architecture impact: conforming
RefImpl impact: changed
Thesis impact: none

The import adapter now preserves declared source endpoint curvature using the already existing sparse fixed-holder representation. No new geometry model, persistence authority, or Kernel definition is introduced. The Reference Application's normal import bridge changes; inconsistent qualified source declarations now fail before construction.

## 8. Conflicts, Risks, and Open Decisions

No ownership conflict or new decision for Uwe. Explicit unresolved type8 remains guarded by the existing downstream production builder. The generic bridge's existing zero-length mapping, fixed-radius validation, pose resolution, and nonqualified-source interpretation are outside this bounded correction. The 1e-12 consistency tolerance is numerical comparison, not an accuracy or survey-quality claim. Genuine discontinuities must use an explicit supported discontinuity representation; conflicting endpoint declarations are not silently reconciled.

## 9. Handover

Rock can independently validate the frozen product/test files, run the updated all-corpus contract, and perform the already authorized integrated App acceptance. Prerequisites are confirmed file identity and protected existing work. Remaining changes may touch Root's corpus test and acceptance evidence; this author requests no further product scope. Done for this package requires independent confirmation that all 12 previously failing representable junction cases satisfy the actual productive import and writer roundtrip contract, with existing nonjunction cases preserved. Full Delivery 1 acceptance remains a separate set of requirements.
