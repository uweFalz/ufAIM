# AIM Dissertation Readiness Plan

## Binding publication form

The AIM Thesis is an engineering-science dissertation. Monograph readability is
a presentation requirement; the Kernel reference is a bounded reference part,
not a substitute for scientific argument. `docs/knowledgeKernel/` remains the
architectural authority. The dissertation explains and evaluates that
authority; it does not redefine it.

## Dissertation claim

The dissertation investigates how alignment knowledge can become an
identity-preserving, executable and epistemically controlled basis for railway
engineering work across construction, realization, observation, evaluation and
change.

## Defensible research contributions

The submission shall defend a small contribution set rather than present every
definition as an original result:

1. **Identity-preserving information model.** A formal separation of durable
   Alignment identity from constructive state, realization, representation,
   observation, evaluation and decision.
2. **Executable knowledge contracts.** Explicit inputs, outputs, assumptions,
   applicability and non-authority for engineering transformations and
   evaluations.
3. **Intrinsic constructive model.** A common intrinsic parameter with
   separated but coupled horizontal, vertical, Rail-Pair-Cant and chainage
   states, including controlled realization.
4. **Epistemically controlled engineering workflow.** Admission, ambiguity,
   provenance and partial knowledge remain visible through editing,
   calculation, persistence and reopening.
5. **Validation by a complete engineering journey.** The claims are tested on
   real source evidence through import, admission, selection, consequential
   modification, synchronized projections, persistence and semantic reopen.

These are candidates for the final contribution statement. Each must receive a
related-work boundary, a stated evaluation method and explicit evidence before
submission.

## Text classes and their obligations

### Scientific propositions

Only falsifiable mathematical, empirical or methodological claims remain in a
`proposition` or `theorem` environment.

- Mathematical claims require proof, a cited established result, or a clearly
  bounded derivation with assumptions.
- Empirical and methodological claims require a validation protocol, data,
  observable result and counterexample or limitation analysis.
- The central thesis requires a trace from research gap through contributions
  to evaluation results.

### Normative Kernel and engineering contracts

Statements that prescribe role separation, authority, admissibility or
dependency direction are contracts, principles, invariants or design rules.
They require traceability to the approved Knowledge Kernel and conformance
evidence from the Reference Implementation. They do not acquire truth merely
by being typeset as mathematical propositions, and they must not be presented
as newly approved Kernel meaning.

### Reference material

Definitions, operator catalogues, summaries, notation and compatibility tables
belong to the bounded Kernel-reference part or appendices. They require
terminological consistency, navigation and provenance, but not an individual
research claim for every entry.

## Required dissertation blocks

### Research state and gap

A dedicated related-work block shall compare at least alignment geometry and
transition research, railway information models, IFC/rail exchange, linear
referencing, engineering knowledge representation and executable digital
engineering. It shall identify what each field already solves and the precise
cross-field gap addressed by AIM. Bibliography entries shall appear because
they support an argument, not through blanket `\nocite{*}`.

### Real validation case study

One named, reproducible railway dataset shall traverse the complete user and
knowledge path: source inventory, parser outcome, evidence/admission boundary,
Alignment selection, radius change, AXTRAN consequences, synchronized
horizontal/vertical/cant/chainage/cross-section projection, save, close and
lossless semantic reopen. The study shall report inputs, decisions, residuals,
ambiguities, rejected evidence, timings where relevant, and before/after
semantic comparison. GRA/Gleisschere remains evidence-only until a separately
approved binding and admission contract exists.

### Critical discussion

The discussion shall address failure, non-uniqueness, unsupported source
evidence, CRS and metric limitations, alternative architectures, threats to
validity, scope limits and conditions under which the proposed separation does
not yield sufficient engineering knowledge. It shall distinguish demonstrated
results from intended future capability.

### Bounded Kernel reference

The reference part shall explain approved identities, states, contracts,
operators and invariants with stable cross-references. It may document the
implementation realization but may not redefine `docs/knowledgeKernel/`.

## Incremental package sequence

### DISS-01 — Proposition disposition

Classify every canonical proposition and its DE counterpart as scientific,
normative contract or reference material. Record existing support and required
disposition without changing semantics.

Done when all 92 EN propositions have stable IDs, source locations, class and
support requirement, and EN/DE pairing discrepancies are explicit.

### DISS-02 — Research questions and contribution contract

Reduce the dissertation to a small set of research questions and contribution
claims; map every claim to related work and evaluation evidence.

Done when each claim has a falsifiable boundary, novelty statement, evidence
method and explicit non-claim.

### DISS-03 — State of the art

Build the comparative research-state block without blanket source inclusion.

Done when every research question has a literature baseline, comparison table,
gap statement and cited primary evidence; unused bibliography entries are
removed or explicitly classified as further reading.

### DISS-04 — Mathematical obligation closure

Prove, derive, cite, reformulate or demote every scientific-mathematical
proposition.

Done when no mathematical proposition remains unsupported and all assumptions,
domains and degeneracies are explicit in EN and DE.

### DISS-05 — Validation protocol and evidence capture

Specify and execute the real engineering case study against versioned inputs
and a reproducible Reference Application baseline.

Done when the complete journey produces inspectable results, semantic
roundtrip comparison, failure evidence and a reproducible protocol.

### DISS-06 — Critical discussion

Test contribution claims against results, counterexamples and alternatives.

Done when every contribution has supported findings, limitations, threats to
validity and a bounded conclusion.

### DISS-07 — Structural consolidation

Recompose migration-sized fragments into the dissertation argument while
retaining the bounded reference part. Orphan sources, TODO presentation and
index depth receive separate decisions here, not in DISS-01.

Done when chapter order follows question → method → result → discussion,
navigation is usable, EN/DE parity is measured, and no template shell is
mistaken for evidence.

### DISS-08 — Submission closure

Perform bilingual build, reference, typography, reproducibility and claim-to-
evidence audits.

Done when both PDFs build without unresolved references or citations, visible
known defects are closed, all submitted claims trace to evidence, and the
submission baseline is immutable and archived.

## Protected constraints for early packages

- Do not modify `docs/knowledgeKernel/`.
- Do not promote evidence to constructive truth.
- Do not bulk-include orphan sources.
- Do not change TODO visibility without a distinct draft/release decision.
- Do not undertake an index rebuild as incidental cleanup.
- Do not edit files owned by concurrent Thesis work.
