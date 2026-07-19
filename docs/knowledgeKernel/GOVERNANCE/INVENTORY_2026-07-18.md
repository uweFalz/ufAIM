# Knowledge Kernel Inventory and P0 Decision Package — 2026-07-18

## Scope

This descriptive inventory covers active Markdown content in `docs/knowledgeKernel/`, excluding `research/` and `_draft/`. It records no approval by itself.

## Corrected Baseline and Current Restbestand

The mission baseline is:

- 29 active concept files: 27 placeholders and 2 substantively drafted Governance files;
- 7 placeholder navigation files outside Governance;
- therefore 34 active placeholders at the start of P0;
- 2 unapproved Governance concept candidates.

An earlier mechanical scan reported 37 placeholders because it also counted two placeholder README files under `research/` and this inventory's quoted placeholder patterns. That number was not the active-Kernel baseline.

After P0, the remaining active placeholders were still 34: all 27 non-Governance concept files and 7 navigation files assigned to P1–P5. P0 removed no placeholder from that 34-file mission baseline because its two Governance concepts had already been substantively drafted before that package; P0 normalized and completed them.

After K1, 29 active placeholders remain. K1 removes the four Identity concept placeholders and `IDENTITY/README.md` placeholder.

After K2, 26 active placeholders remain. K2 removes the two Objects concept placeholders and `OBJECTS/README.md` placeholder.

After K3, 18 active placeholders remain. K3 removes all seven Realization placeholders and `REALIZATION/README.md`; KC-REALIZATION-005 initially becomes a substantive `evidence-missing` entry. On 2026-07-19, `KD-2026-007` accepts the Research-supported reformulation to Physical Realization and changes that entry to `candidate`; the placeholder count remains 18.

After K4, 5 active placeholders remain. K4 replaces all twelve Evaluation concept placeholders and `EVALUATION/README.md`; three entries are supported candidates and nine carry separate `evidence-missing` unresolved markers while retaining lifecycle status `candidate`.

After `KD-2026-008`–`KD-2026-014`, 5 active placeholders still remain. The package adds the new substantive candidate `KC-EVAL-013 Engineering Sufficiency`; it replaces no placeholder. Evaluation therefore contains four Research- or provenance-supported candidates and nine evidence-gap records.

After `KD-2026-015`–`KD-2026-017`, 5 active placeholders still remain. The package adds the new substantive candidate `KC-EVAL-014 Material Consequence`; it replaces no placeholder. Evaluation therefore contains five Research- or provenance-supported candidates and nine evidence-gap records.

After KERNEL-REPAIR-005, 0 active placeholders remain. The package replaces 5 placeholders: 2 Communication concept placeholders (`KC-EDITOR-001`, `KC-EDITOR-002`) and 3 navigation placeholders (`COMMUNICATION/README.md`, `REPRESENTATION/README.md`, `diagrams/README.md`).

## Active Concept Inventory

| Domain | Concept files | Substantive | Placeholder | Package |
|---|---:|---:|---:|---|
| Governance | 2 | 2 candidates | 0 | P0 |
| Identity | 4 | 4 candidates | 0 | K1 |
| Objects | 2 | 2 candidates | 0 | K2 |
| Realization | 7 | 7 candidates | 0 | K3 plus `KD-2026-007` |
| Evaluation | 14 | 5 supported candidates, 9 evidence-gap records | 0 | K4 plus `KD-2026-008`–`KD-2026-017` |
| Communication | 2 | 2 candidates | 0 | KERNEL-REPAIR-005 |
| **Total** | **31** | **31** | **0** | |

No active placeholder navigation files remain after KERNEL-REPAIR-005.

## Placeholder Reduction Summary by Package

| Package | Baseline before package | Placeholders removed in package | Active placeholders after package |
|---|---:|---:|---:|
| P0 | 34 | 0 | 34 |
| K1 | 34 | 5 | 29 |
| K2 | 29 | 3 | 26 |
| K3 | 26 | 8 | 18 |
| K4 | 18 | 13 | 5 |
| KERNEL-REPAIR-005 | 5 | 5 | 0 |

## Current Candidate Composition and Evidence Posture

- Substantive supported candidates: 22 (Governance 2, Identity 4, Objects 2, Realization 7, Evaluation 5, Communication 2).
- Evidence-gap candidates (status `candidate` with unresolved evidence obligations): 9 (all in Evaluation).
- Active placeholder entries: 0.

Zero active placeholders means the active files are no longer placeholders; it does not mean the Kernel is approved or complete.

## Unresolved Research and Governance Obligations

- Evaluation retains nine evidence-gap candidate records requiring focused Research and candidate completion work.
- Representation has navigation guidance only and no active Representation concept file yet; focused Research and candidate promotion work remains required.
- Candidate status across domains still requires Governance review and explicit Decision Records for any future approval transitions.

## P0 Findings

### Status contradiction closed in candidates

The non-model labels `Proposed-Operational-Baseline` and `Draft Baseline (Operational)` have been replaced with `candidate`. `GOVERNANCE-002` now separates active concept statuses from the `research` repository phase and defines unresolved states as statuses rather than informal annotations.

### Constitution and provisional mandate

The Constitution is a `candidate`; P0 does not self-authorize it. K1 explicitly authorizes candidate preparation and validation under the candidate governance model, but does not approve that model. A standing operational mandate is offered as Decision D-001 below.

### Freezes under `_draft/`

At the 2026-07-18 inventory baseline, `_draft/40-freezes/FC-001.md` and `FC-002.md` contained `Status: Approved` but cited no decision authority, date, or decision record. On 2026-07-19, [`KD-2026-003`](DECISION_LOG.md#kd-2026-003) and [`KD-2026-004`](DECISION_LOG.md#kd-2026-004) re-legitimized their substantive meanings in the canonical [`FREEZES/`](../FREEZES/README.md) home. The historical files remain provenance only.

### Approval claims under `research/`

The IMPORT concept files and the FOUNDATIONS, SPOT, and IMPORT README files assert approval inside `research/`. Under the domain boundary, these are provenance claims and research evidence only. They do not establish active Kernel approval and are not automatically inherited by target concepts.

### Baseline versus current state

The corrected 34-placeholder baseline is retained separately from package progress. Future package reports must state both placeholders removed in that package and the active restbestand.

## P0 Traceability Matrix

| Kernel ID/document | Research evidence | Governance decision | RefImpl correspondence | Thesis explanation | Status |
|---|---|---|---|---|---|
| Constitution | `research/THESIS/KC-EDITOR-006` | `KD-2026-001` mandate; `KD-2026-002` authority; Constitution approval remains separate | Repository boundary only; no behavior used as authority | `foundations/principles.tex`, `foundations/ontology.tex` | `candidate` |
| GOVERNANCE-001 | `research/THESIS/KC-EDITOR-006`; research-tree counterexamples | `KD-2026-001` and `KD-2026-002` effective | RefImpl classified as demonstration/evidence | `foundations/principles.tex`, `foundations/ontology.tex` | `candidate` |
| GOVERNANCE-002 | Constitution candidate; research approval-claim counterexamples | `KD-2026-001`, `KD-2026-002`, and `KD-2026-005` effective | Reproducible behavior placed fourth in evidence order | `research/THESIS/KC-EDITOR-006` supplies editorial correspondence | `candidate` |

## K1 Identity Identifier Reconciliation

| Research ID | Active Kernel ID | Result | Uncertainty |
|---|---|---|---|
| `KC-FOUND-001` | `KC-ID-001` | Direct provenance | None found |
| `KC-FOUND-002` | `KC-ID-002` | Direct provenance | Exact object-type compositions remain open |
| `KC-FOUND-003` | `KC-ID-003` | Direct provenance | Exact constructive constituents remain object-type-specific |
| `KC-FOUND-004` | `KC-ID-004` | Direct provenance under `KD-2026-006` | “Stationing” is fixed to intrinsic longitudinal parameterization, not operational addressing |

Neither identifier family is renamed. Research approval claims are not inherited by the `KC-ID-*` candidates.

## K1 Identity Traceability Matrix

| Kernel ID | Research source | Governance decision | RefImpl correspondence | Thesis explanation | Status |
|---|---|---|---|---|---|
| KC-ID-001 | `KC-FOUND-001`; boundary support from 007–009 | K1 permits candidate preparation; approval pending | `AlignmentData.id`, source and `derivedFrom` references | `kernel/engineering_identity.tex`; `kernel/engineering_objects.tex` | `candidate` |
| KC-ID-002 | `KC-FOUND-002`; relational support from 005–006 | K1 permits candidate preparation; approval pending | ID plus mapping/source relations; incomplete composition proof | `kernel/engineering_identity.tex`; `foundations/kernel_glossary.tex` | `candidate` |
| KC-ID-003 | `KC-FOUND-003`; boundaries from 007–009 | K1 permits candidate preparation; approval pending | editable source distinguished from derived sparse alignment | `foundations/kernel_glossary.tex`; `reality/data.tex` | `candidate` |
| KC-ID-004 | `KC-FOUND-004`; `_draft/10-concepts/AlignmentIdentity.md` supporting clarification | `KD-2026-006` resolves terminology; approval remains separate | ordered elements, internal `s`, curvature, derived pose, external `staEq` | `modeling/sparse.tex`; `reality/km_line_and_stationing.tex` | `candidate` |

Similar names and behavior are correspondence only, not demonstrated conformance.

## Engineering Sufficiency Addition

| Kernel ID | Research source | Governance decision | RefImpl correspondence | Thesis explanation | Status | Open responsibility |
|---|---|---|---|---|---|---|
| KC-EVAL-013 | `RESEARCH-EVAL-PRS-001` (`survives with reformulation`, strongly supported); `RESEARCH-EVAL-PRS-002` (`missing Evaluation responsibility`) | `KD-2026-008`–`KD-2026-014`; approval remains separate | follow-up required; no software object model prescribed | follow-up required | `candidate` | Material Consequence relation is now the separate candidate `KC-EVAL-014` |

The active placeholder count remains 5 because `KC-EVAL-013` is a newly added substantive candidate rather than a replacement for an existing placeholder. Purpose-Relative Sufficiency remains the historical Research name; Engineering Sufficiency is the active candidate name.

## Material Consequence Addition

| Kernel ID | Research source | Governance decision | RefImpl correspondence | Thesis explanation | Status | Open responsibilities |
|---|---|---|---|---|---|---|
| KC-EVAL-014 | `RESEARCH-EVAL-MC-001` (`independent relation`, high confidence); supporting PRS-001/002 | `KD-2026-015`–`KD-2026-017`; approval remains separate | follow-up required; no universal risk or software object model prescribed | follow-up required | `candidate` | lifecycle invalidation, minimum provenance, cumulative effects, domain profiles |

The active placeholder count remains 5 because `KC-EVAL-014` is a newly added substantive candidate rather than a replacement for an existing placeholder.

## Historical Decision Briefs and Resolutions

The briefs below record the questions as prepared on 2026-07-18. Uwe Falz resolved D-001 through D-004 and K1-ID-001 on 2026-07-19 through [`KD-2026-001`](DECISION_LOG.md#kd-2026-001)–[`KD-2026-006`](DECISION_LOG.md#kd-2026-006). Their original options remain here as historical decision preparation, not as open questions.

### D-001 — Standing operational mandate

- **Resolution:** `KD-2026-001` — effective.

- **Question:** May the Constitution and GOVERNANCE-001/002 govern candidate preparation and review beyond missions that grant this authority explicitly?
- **Evidence:** No earlier decision record was found; all three documents are candidates. K1 grants mission-local candidate-preparation authority but no approval.
- **Options:** (A) grant a standing mandate limited to candidate preparation and validation; (B) approve the documents formally after review; (C) require explicit authorization in each mission.
- **Consequences:** A permits consistent preparation without pretending approval; B establishes binding governance; C preserves mission-by-mission control.
- **Recommendation:** A, recorded explicitly, followed by separate formal review.

### K1-ID-001 — Meaning of “stationing” in KC-FOUND-004

- **Resolution:** `KD-2026-006` — intrinsic longitudinal parameterization.

- **Question:** Does `KC-FOUND-004` use “stationing” for intrinsic longitudinal parameterization or for operational station/kilometre addressing?
- **Evidence:** The Research file is unqualified; `_draft/10-concepts/AlignmentIdentity.md` says “station parameterization”; RefImpl separates internal monotone `s` from `staEq`; Thesis separates operational stationing from constructive identity.
- **Options:** (A) confirm intrinsic longitudinal parameterization; (B) confirm operational stationing; (C) return the Research statement for clarification.
- **Consequences:** A supports KC-ID-004 as written; B creates a semantic conflict and blocks promotion; C leaves the candidate usable for review but not `review-ready`.
- **Recommendation:** A if it reflects intended Research terminology; otherwise C. K1 does not choose on Uwe's behalf.

### D-002 — Approval and revocation authority

- **Resolution:** `KD-2026-002` — Uwe Falz is primary authority; limited explicit delegation is permitted.

- **Question:** Is Uwe Falz the sole authority, or may named delegates decide?
- **Options:** (A) Uwe Falz alone; (B) Uwe Falz plus delegates appointed in a prior decision record.
- **Consequences:** B enables delegation while preserving traceability; unnamed or implicit delegation remains invalid.
- **Recommendation:** B with explicit, revocable appointments.

### D-003 — Freeze legitimation and location

- **Resolution:** `KD-2026-003` and `KD-2026-004` — approved canonical records under `FREEZES/`; historical drafts preserved.

- **Question:** Are FC-001 and FC-002 legitimately approved, and where is their canonical governance home?
- **Evidence:** Both say `Status: Approved` under `_draft/40-freezes/` but contain no approver, date, or decision reference.
- **Options:** (A) confirm them by a new decision and retain immutable historical files under `_draft/`; (B) confirm and migrate/copy authoritative records to an active Governance location; (C) treat them as candidates pending substantive review.
- **Consequences:** Only A or B establishes their authority-order position; C prevents their use as approved freezes.
- **Recommendation:** B, with stable links back to the historical files. No move occurs in P0.

### D-004 — Decision Log and historical statuses

- **Resolution:** `KD-2026-005` — append-only `GOVERNANCE/DECISION_LOG.md` with immutable `KD-YYYY-NNN` identifiers; historical files remain in place for now.

- **Question:** Where are decisions recorded, how are they identified, and where do deprecated/revoked entries remain?
- **Options:** (A) append-only `GOVERNANCE/DECISION_LOG.md` using `KD-YYYY-NNN`, with deprecated/revoked files retained at stable canonical paths; (B) per-entry decision blocks plus a generated index; (C) another explicitly specified scheme.
- **Consequences:** A provides one auditable sequence and stable links; B keeps context local but needs index consistency.
- **Recommendation:** A. The mandatory record fields are already defined in GOVERNANCE-002.

## Validation Checklist for P0

- P0 concept placeholders: none.
- P0 concept statuses: only `candidate`; no Codex approval.
- Duplicate canonical Governance definitions: none found.
- The open status, freeze, and authority conflicts recorded at the P0 baseline were resolved on 2026-07-19 by `KD-2026-001`–`KD-2026-005`.
- Internal links: to be checked mechanically after editing.
- Evidence paths: repository-relative and concrete.
- Reference Implementation and Thesis: unchanged by P0.
- Changes outside P0: none intended.

## K1 Validation Checklist

- Governance and Identity concept statuses: `candidate`; no Codex approval or revocation.
- Identity concept placeholders: removed; `IDENTITY/README.md` substantive.
- Identifier mapping: recorded without renaming either family.
- KC-ID-004 terminology uncertainty: resolved by `KD-2026-006`; “stationing” means intrinsic longitudinal parameterization.
- Internal links, whitespace, scope, and exact placeholder count: verified during K1 validation and reported in the K1 Mission Report.
- Reference Implementation and Thesis: evidence read only; unchanged by K1.

## Next Package Recommendation

Any promotion of KC-ID-004 still requires its own Governance review and Decision Record; `KD-2026-006` resolves terminology but does not approve the Identity candidate. Do not begin K2 without a separate mission.
