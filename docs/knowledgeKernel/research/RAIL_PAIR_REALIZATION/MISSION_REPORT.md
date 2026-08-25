# MISSION REPORT

## 1. Mission

Mission: `RPR-D001 — Rail-Pair Realization Governance Preparation`

Responsible stream: `research`

Objective: Record Uwe Falz's confirmed professional decision on profile zero
horizon, paired native cant, sparse zero semantics, derived rail-pair state,
and the boundary to wheelset and vehicle interaction as a versioned Research
Decision Note without modifying active Kernel authority.

Package: `docs/knowledgeKernel/research/RAIL_PAIR_REALIZATION/`

## 2. Status

`complete`

Research outcome: `survives with reformulation`.

The Governance-preparation note and its first review revision are complete.
Uwe Falz accepted the recommendation that construction remain in the profile
zero horizon plus sparse paired offsets while the realized rail-pair midpoint
serves as the derived kinematic anchor. Active Kernel approval remains a
separate later action and is not claimed by this Research status.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM`
- Branch: `main`
- Baseline commit: `7d17ef8cb597b74a23130def81ee79b0cd6cef7d`
- Authorized scope: one new Research-only package under
  `docs/knowledgeKernel/research/`.
- Pre-existing parallel work: GND, GRA, App, Thesis, import, service, fixture,
  and test changes were present before this package. No pre-existing file was
  edited by this mission.
- Overlap check: final status and diff were restricted to
  `docs/knowledgeKernel/research/RAIL_PAIR_REALIZATION/`.
- Explicit exclusions: active Knowledge Kernel authority, existing GAP2 files,
  Thesis, App architecture, RefImpl, SPOT state, tests, parsers, and external
  standards research.

## 4. Work Performed

Question investigated:

What is the minimal construction contract that uniquely creates two railway
rails from `coordGeom`, `profile`, and `cant`, supports later operational use,
and avoids redundant persistent state?

Result:

- recorded `profile` as the constructive vertical zero horizon;
- recorded native `cant` as paired `cL(s)`, `cR(s)`, and qualified separation
  `g(s)`;
- made sparse absence equal zero only inside explicitly complete admitted
  coverage and `Unknown` otherwise;
- classified cross-level, common offset, roll, rail trajectories, rail-pair
  midpoint, track frame, and pose3 as derived;
- defined separate operator boundaries for Rail-Pair Realization, idealized
  wheelset kinematics, and real wheel--rail/vehicle interaction;
- supplied a primary/derived information matrix and redundancy rule;
- tested the candidate against standard cant, track scissors, zero cross-level
  with common offset, undertiefung, curvature zero/reversal, qualified gauge,
  and ideal versus real wheelset behavior;
- resolved GAP2-D003 wording by retaining the rail-pair midpoint as a derived
  realization/runtime working trajectory while making profile the persistent
  constructive zero horizon;
- supplied concrete proposed Kernel candidate wording;
- recorded review disposition `accepted with required anchor clarification`;
- defined the realized geometric rail-pair midpoint as the preferred derived
  kinematic anchor for pose3, wheelset, and vehicle consumers;
- required an explicit relation between the horizontal Alignment reference
  and the governing rail pair, preventing qualified separation from hiding a
  lateral common-mode ambiguity;
- recorded Thesis and RefImpl follow-ups without changing those areas.

Confidence:

- high for the insufficiency of scalar cross-level and for the
  construction/realization/vehicle boundary;
- medium for final type names and governing rail-reference taxonomy pending
  switch, crossing, multi-rail, rail-profile, and gauge-definition research.

## 5. Changed Files

Added:

- `docs/knowledgeKernel/research/RAIL_PAIR_REALIZATION/DECISION_NOTE_RPR_D001.md`
- `docs/knowledgeKernel/research/RAIL_PAIR_REALIZATION/MISSION_REPORT.md`

Modified: None.

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- Mission report policy check using
  `sed -n '1,220p' docs/MISSION_REPORT_POLICY.md`: `passed`.
- Existing Research authority comparison against
  `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/DECISION_RECORD_GAP2_D003.md`
  and its supersession/mission records: `passed`; the new note preserves their
  Research provenance and does not claim active Kernel approval.
- Thesis correspondence check against `docs/thesis/AIM/modeling/sparse.tex`,
  `docs/thesis/AIM/state/pose3_and_cant.tex`, and vehicle-space chapters:
  `passed`; follow-up conflicts are named but no Thesis file changed.
- RefImpl correspondence check against
  `src/aim-core/alignment/profile/CantConstructiveState.js`,
  `docs/app/architecture/aim-core/cant/CANT-CONSTRUCTIVE-STATE-v0.1.md`, and
  `src/services/alignment/createSynchronizedAlignmentProfileProjection.js`:
  `passed`; no implementation file changed.
- Algebraic counterexample check for equal cross-level with different common
  offset and `crossLevel=0` with non-zero paired offsets: `passed`.
- Required-case coverage check for track scissors, undertiefung, curvature
  zero/reversal, gauge qualification, and ideal versus real wheelset:
  `passed`.
- Anchor sufficiency review: `passed`; the note now distinguishes persistent
  construction from the derived midpoint anchor and requires an explicit
  horizontal Alignment-reference relation.
- Relative Markdown link resolution from the new decision note: `passed`.
- Package-only diff and whitespace check with `git diff --check --
  docs/knowledgeKernel/research/RAIL_PAIR_REALIZATION`: `passed`.
- Limitation: no external standards search, numerical rail realization, or
  vehicle simulation was required or run.

## 7. Kernel and Architecture Impact

Kernel impact: candidate

The package proposes a format-independent Kernel boundary and wording, but
does not modify or approve active Kernel authority.

Architecture impact: candidate

Later Architecture work must decide the exact paired-rail state, qualified
separation contract, coverage state, native law families, and realization
service boundary.

RefImpl impact: follow-up-required

`CantConstructiveState v0.1` is scalar, contiguous, and non-overlapping. It
cannot express the confirmed professional input without a later authorized
version or replacement.

Thesis impact: follow-up-required

The Thesis must later qualify scalar-cant and pose3 reconstruction statements
and remove the universal `cant family == cGeom family` claim.

## 8. Conflicts, Risks, and Open Decisions

- `RPR-KG-001`: Active Kernel Governance has not approved the proposed
  candidate. Options are promote after review, retain as Research evidence, or
  reject with recorded reasons.
- `RPR-GAUGE-001`: The exact governing rail-reference and separation
  measurement type remains open. It must distinguish nominal gauge,
  running-edge, rail-centre, contact, projected, and spatial distances.
- `RPR-MULTIRAIL-001`: Switches, crossings, multi-rail, and gauge-changing
  arrangements require route- and domain-qualified governing pair selection.
- `RPR-LAWS-001`: Native nonlinear cant laws and continuity requirements remain
  open; track scissors prove they cannot be universally inherited from
  `coordGeom`.
- `RPR-SPARSE-001`: Admission and coverage authority must be defined before an
  implementation treats absent entries as zero.
- Risk: persisting paired offsets together with cross-level, midpoint, spatial
  rails, and pose3 as equal truth would recreate the redundancy the candidate
  is intended to remove.
- Parallel mission conflict: none observed; only the two new package files are
  owned by this mission.

## 9. Handover

Next safe step: independent Governance/Kernel review of
`docs/knowledgeKernel/research/RAIL_PAIR_REALIZATION/DECISION_NOTE_RPR_D001.md`.

Prerequisites:

- accept, revise, or reject the proposed candidate wording;
- confirm the reformulated relationship to GAP2-D003;
- assign ownership for gauge/separation and governing rail-reference research;
- keep App and Thesis changes pending until the semantic decision is recorded.

A Governance package may touch the appropriate active Kernel candidate area
and provenance registers only after explicit authorization. It must not erase
or rewrite this Research record.

Research on gauge/separation and multi-rail pair selection can proceed
independently. App may prepare non-normative test cases, but productive Cant
Core replacement should wait for Architecture authorization. Thesis may
prepare marked discussion but should not state the candidate as approved.

Done criterion for the next package:

1. the candidate receives a recorded Governance disposition;
2. profile zero horizon, rail-pair midpoint, source references, and runtime
   working trajectory are unambiguously separated;
3. primary versus derived state and sparse coverage semantics are approved;
4. governing rail reference and qualified separation responsibilities are
   assigned;
5. RefImpl and Thesis follow-up packages receive bounded, non-conflicting
   contracts.
