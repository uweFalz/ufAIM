# MISSION REPORT

## 1. Mission

Mission: `GAP2-D003-CORRECTION — Core Midpoint versus Source Rail Reference`

Responsible stream: `research`

Objective: withdraw the lower/inner-rail Core reference and replace it with the
binding separation between the ufAIM/AIM-Core midpoint working trajectory and
explicit source/rule rail references.

Package:
`docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/`

## 2. Status

`complete`

Research outcome: `survives with reformulation`.

GAP2-D003 is corrected and closed as professional input: ufAIM/AIM-Core works
on the midpoint trajectory between governing rail edges. A lower, typically
curve-inner rail trajectory is retained only as explicit source/rule
provenance. Adapters transform between both references reversibly. Explicitly
justified undertiefung at a Bogenweiche remains a source/engineering exception,
not a Core-reference rule.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Documents/developer/ufAIM`
- Branch: `main`
- Baseline commit: `7367801a7f15687d8cb6abd4e4c9ccb4e7104180`
- Authorized files:
  - `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/DECISION_RECORD_GAP2_D003.md`
  - GAP-002 index and decision-dossier cross-references.
- Explicit exclusions: active Kernel, Governance, App, Thesis, Direction
  documents, Package 004, and unrelated Research.
- Pre-existing parallel App/import/test and untracked Research/Direction work
  remained outside this mission.

## 4. Work Performed

- Replaced the lower/inner-rail Core anchor with the complete midpoint working
  trajectory.
- Retained lower/inner-rail trajectory as source/rule provenance.
- Defined deterministic and reversible source-to-midpoint adapter behavior.
- Required roundtrip restoration of reference, direction, side, amount,
  validity, and provenance.
- Formalized paired left/right rail construction and scalar cant as a
  derived/partial representation.
- Defined the mandatory convention/provenance record.
- Preserved historical and source-specific datum choices without silent
  normalization or automatic admission as permitted variants.
- Restricted the allowed exception set to explicitly justified undertiefung at
  Bogenweichen.
- Recorded a targeted public exception search; no further reliable exception
  was established.
- Defined explicit handling for straight track, curvature zero/crossing,
  negative cant, equal rail height, anchor changes, multiple tracks and special
  constructions.
- Defined `Unknown`/`Ambiguous` outcomes for incomplete or contradictory
  evidence.
- Added direction-reversal consequences and a double-reversal equivalence
  requirement.
- Marked GAP2-D003 as decided professional input while preserving the Kernel
  Governance boundary.

## 5. Changed Files

Added:

- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/SUPERSESSION_GAP2_D003.md`

Modified:

- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/README.md`
- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/COUNTEREXAMPLES_AND_DECISIONS.md`
- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/DECISION_RECORD_GAP2_D003.md`
- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/MATHEMATICAL_CONTRACTS.md`
- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/EXCEPTION_SEARCH_GAP2_D003.md`
- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/MISSION_REPORT.md`
- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/MISSION_REPORT_GAP2_D003.md`

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- Corrected decision compared point-by-point with Uwe Falz’s midpoint-Core
  versus source-reference clarification: `passed`.
- Midpoint-Core versus source-rail separation check: `passed`.
- Trace supersession marker: `passed`.
- Adapter reversibility and roundtrip field requirements: `passed`.
- Special-case coverage for all named cases: `passed`.
- Public rule/practice exception search: `passed`; no further exception
  established.
- `Unknown`/`Ambiguous` non-guessing rule: `passed`.
- Local links and trailing-whitespace checks: `passed`.
- Git diff and scope audit: `passed`.
- Package 004 and active Kernel/App/Thesis files: unchanged.

## 7. Kernel and Architecture Impact

Kernel impact: candidate

This is binding professional input for later Research/implementation but not
Kernel approval.

Architecture impact: candidate

Later Aggregate/Cant Core contracts must use the midpoint working trajectory,
paired rails, reversible source adapters, qualified reference conventions, and
epistemic special-case results.

RefImpl impact: follow-up-required

No implementation changed; later authorized Cant Core work must consume the
record.

Thesis impact: follow-up-required

The distinction can later inform explanation, but no Thesis source changed.

## 8. Conflicts, Risks, and Open Decisions

- The exact Core type for “governing rail edge” remains open.
- Further datum exceptions require reliable rule/practice evidence.
- Organization-specific conversion libraries remain Research work after the
  underlying exception is established.
- Switch/crossing, multi-rail and gauge-changing contracts remain open.
- Cant-family and continuity decisions remain outside GAP2-D003.
- Risk: implementers may reuse the widespread lower/inner-rail source
  trajectory as the Core reference. The supersession notice explicitly
  prohibits that interpretation.

No further decision from Uwe/Rock is required to close GAP2-D003.

## 9. Handover

Later Alignment Aggregate and Cant Core packages shall read
`DECISION_RECORD_GAP2_D003.md` before defining cant fields, reference frames,
native defaults, import normalization or direction reversal.

Prerequisites:

- preserve paired rail identity;
- preserve source conventions and provenance;
- use midpoint between governing rail edges as the Core working trajectory;
- transform source references explicitly and reversibly;
- never infer inside/outside at curvature zero;
- surface incomplete evidence as `Unknown`/`Ambiguous`;
- do not treat this Research record as Kernel approval.

Package 004 may proceed independently and was not changed or interrupted.

Done criterion for a future Cant Core package:

Native and imported cant laws identify both rails, governing references,
distance definition, Core midpoint, source reference, direction, signs and
provenance; source-to-work-to-source roundtrip restores all original semantics;
special cases return explicit typed states; scalar cant remains derived; and
double direction reversal is behaviorally equivalent to the original.
