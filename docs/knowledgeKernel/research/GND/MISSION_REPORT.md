# MISSION REPORT

## 1. Mission

- Mission: `RESEARCH-GND-CONVERGENCE-002 — Import Knowledge and SPOT Gain`
- Responsible stream: `research`
- Requested objective: extract engineering knowledge carried by GND and determine what ufAIM can gain during import.
- Package identifier: `RESEARCH-GND-CONVERGENCE-002`

## 2. Status

`complete`

Research outcome: **survives with reformulation**. GND carries actionable constructive, stationing, reference-system, identity, quality, and provenance knowledge beyond drawable geometry, but admission must distinguish source evidence from constructed or canonical claims.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Documents/developer/ufAIM`
- Branch: `main`
- Baseline commit: `1ea2b3cace79ec798545a0477581fbc4c800c838`
- Pre-existing working-tree changes: App curvature-band work in `app/` and `src/services/alignment/`; Thesis source/index/PDF changes in `docs/thesis/AIM/`. They were inspected only for overlap and not modified.
- Authorized additions: `docs/knowledgeKernel/research/GND/` only.
- Read-only evidence: current `test/samples/`, relevant `_legacy/` GND examples, GND importer/analysis/tests, bundled VermEsn reference, App stationing and CRS notes.
- Exclusions honored: active Kernel, Governance, App/importer code, Thesis, corpus data, and `_legacy/`.
- Overlap check: final status/diff inspection confirmed no mission edit overlaps pre-existing changed files.

## 4. Work Performed

Question: what must be known to interpret real GND deliveries, and what knowledge beyond geometry is worth retaining for SPOT?

Tests performed: structural workbook inspection; corpus identity hashing; field/reference comparison; current importer data-flow trace; synthetic and legacy-probe test review; counterexample analysis for multiple systems, compound station values, duplicate point observations, EK jumps, and lossy EH/EU handling.

Findings: the seven core sheets form a repeated source model; header position is not stable; point/element provenance and quality are populated; source stationing is not safely identical to internal curve-length; EK supplies distinct kilometre-reference evidence; EH/EU contain constructive content; and source-scoped identity/conflict evidence is valuable. The current importer discards or conflates material fields and can fabricate plausible values.

Candidates: a lossless normalized import result, evidence-first SPOT admission payload, composite re-import signatures, and six ordered App packages. These remain Research recommendations, not approved architecture.

Confidence: high for field meanings and current code behavior; medium for re-import matching recommendations; unresolved for all exporter station encodings, special signed-radius conventions, profile domain, and full modern version deviations.

## 5. Changed Files

Added:

- `docs/knowledgeKernel/research/GND/README.md`
- `docs/knowledgeKernel/research/GND/01-corpus-and-variants.md`
- `docs/knowledgeKernel/research/GND/02-import-interpretation-matrix.md`
- `docs/knowledgeKernel/research/GND/03-current-importer-gap-analysis.md`
- `docs/knowledgeKernel/research/GND/04-spot-gain-analysis.md`
- `docs/knowledgeKernel/research/GND/05-reimport-and-conflicts.md`
- `docs/knowledgeKernel/research/GND/06-evidence-and-uncertainty-register.md`
- `docs/knowledgeKernel/research/GND/07-app-handover.md`
- `docs/knowledgeKernel/research/GND/MISSION_REPORT.md`

Modified: None.

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- Corpus identity: SHA-256 over current and legacy GND XLSX/MDB holdings; result `passed`; limitation: identity does not prove semantic equivalence.
- Workbook structure: bundled Python/openpyxl read-only field inspection of a representative current workbook plus direct XLSX workbook-manifest inspection across all declared current/legacy XLSX examples; result `passed`; limitation: no workbook was rewritten, no sensitive rows were copied, and not every extra sheet was semantically decoded.
- Format evidence: compared the bundled VermEsn field reference and `sharedTechnet.js`; result `passed`; limitation: the 2000 reference is not a complete modern GND XLSX specification.
- Importer trace: inspected reader, normalization, point/edge indexing, sequence construction, LandFAT mapping, CRS resolution, import contracts, admission, and regression tests; result `passed`.
- Documentation link/scope/diff checks: `git diff --check -- docs/knowledgeKernel/research/GND`, file inventory, heading check, and README link check; result `passed`; limitation: Markdown rendering was not browser-tested.
- Runtime importer tests: `not run`; limitation: this Research-only package changed no executable code and relied on inspection of the existing synthetic regression suite for behavior evidence.

## 7. Kernel and Architecture Impact

Kernel impact: candidate

Research identifies possible treatment of EK reference lines, stationing evidence, observations, and provenance. No candidate is promoted or approved.

Architecture impact: candidate

The normalized source layer, admission payload, and re-import evidence rules are implementation-oriented candidates.

RefImpl impact: follow-up-required

The importer has P0 truthfulness defects and information-loss gaps; no code was changed in this mission.

Thesis impact: none

## 8. Conflicts, Risks, and Open Decisions

- `GND-U01`: choose/validate decoding rules for `STATION`, `EKAKM`, and `EKEKM`; options are exporter-specific decoder, opaque evidence until decoded, or user-supplied schema. Recommended: opaque evidence by default plus validated decoder profiles.
- `GND-U02`: define engineering tolerance policy; options are fixed global tolerance or purpose/accuracy-derived tolerance. Recommended: purpose/accuracy-derived with conservative default.
- `GND-U03`: decide whether EK kilometre-reference line fits approved existing SPOT concepts; options are existing object/property/relation or future Kernel candidate. Research does not decide.
- `GND-U04`: set retention/access policy for person/editor and free-text provenance.
- Risk: acting on current placeholder cant or external-as-internal stationing can create silent false knowledge.
- Parallel conflict: none; pre-existing App/Thesis changes were outside mission-owned files.

## 9. Handover

Next safe step: `APP-GND-01 — Truthfulness safety gate` from `07-app-handover.md`.

Prerequisites: accept this Research handover as evidence; no Kernel decision is required to stop fabricated/incorrect values.

May touch: GND parser/mapping code and focused synthetic importer tests; it must not promote new SPOT/Kernel concepts.

Independent work: station-decoding evidence collection and privacy policy can proceed independently; APP-GND-02 should follow APP-GND-01.

Exact done criterion: no GND output claims decoded cant/profile/direction when the value was placeholder, unit-mismatched, or unsupported; all four safety cases have deterministic regression tests and user-visible diagnostics.
