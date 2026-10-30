# ufAIM Delivery Plan 2026–2027

## Commitment

Project start for this delivery plan:

```text
Sunday, 26 July 2026, 22:17 Europe/Berlin
```

North Star:

> **Make Alignment Knowledge Work.**

This plan schedules the complete programme in
`docs/ALIGNMENT_KNOWLEDGE_WORK_PROGRAM.md`. It sequences the programme without
reducing it.

## Delivery 1 — Recognizable ufAIM Alignment Design App

Target:

```text
31 October 2026
```

Rescheduled by Uwe on 20 October 2026: “Zusammenführen! verschobene Deadline:
Oct 31”. The original 30 September 2026 target was not met. This changes the
Delivery 1 target date, not its scope or acceptance criteria; Delivery 2 and
Delivery 3 dates remain unchanged. Consolidating independently checked local
candidates is progress toward delivery, not evidence of complete acceptance.

The delivery is recognizable as the intended product when a user can:

1. start in an empty local engineering space or import engineering data;
2. see and select an Alignment;
3. create and perform elementary edits, including a direct radius change;
4. receive calculated AXTRAN consequences;
5. work with horizontal, vertical, cant, chainage, and speed-qualified state;
6. see synchronized plan, curvature, longitudinal, cant, and initial
   cross-section views;
7. see geographic context through MapLibre when qualified CRS evidence exists;
8. remain in explicit local-cartesian mode otherwise;
9. preserve, close, reopen, and recover the engineering state without semantic
   loss;
10. use the normal application without automatic E2E harnesses or blocking
    imports.

This delivery does not require:

- complete network planning;
- full infrastructure digital-twin capability;
- platform, overhead-line, or cable-route applications;
- IFCalignment export;
- general corridor optimization.

## Delivery 2 — Alignment Workbench Alpha

Target:

```text
30 November 2026
```

Required additions:

- multiple Alignments and first usable track-network topology;
- connection and switch relationships;
- IFC import in the shared Engineering/World workspace;
- improved AXTRAN candidates, conditions, and free parameters;
- explicit trial versus consequential-change interaction;
- external demonstration without developer-guided recovery.

## Delivery 3 — IFCalignment Roundtrip

Target:

```text
31 March 2027
```

Required cycle:

```text
create or import
→ edit and calculate
→ combine with IFC context
→ export IFCalignment
→ re-import
→ compare preserved engineering meaning
```

## Execution Status — 30 October 2026

Uwe's current priority order is:

1. bring the selected branches together;
2. maintain the AIM development timeline against this plan and the complete
   work programme;
3. clarify `AIMcoreFix` / “what is AIM?” without silently redefining the
   existing AIM Core, alignmentOS, Knowledge Kernel, or product boundaries.

Priority 1 currently exists as a local integration tree based on
`6fb5f3bc54db0a725c53fc81c9897da8fad61106`. It combines the accepted 099
alignmentOS consolidation semantics with the PR82/PR83 AXTRAN owner paths and
the residual-chart content. Independent review has accepted the tree for
bounded offline integration; the separate Git integration remains open, so
this is not finished `main` content. During that work, `origin/main` was reported to
have advanced independently to `fa1b893b61ceebb26fa1d4a1308fc957c218fc58`
through PR84. That observation is provenance for the later integration gate,
not a new remote verification by this plan.

Delivery 1 remains **ROT** on 30 October 2026. Code capability, focused tests,
isolated candidate evidence, and local integration are not interchangeable
with delivery acceptance. The ten criteria above remain the complete Delivery
1 gate. The currently documented remaining gates are:

- one current, uninterrupted normal-application acceptance across the complete
  Delivery 1 user path;
- visible qualified-CRS geographic context through MapLibre, while retaining
  explicit local-cartesian behavior when qualification is absent;
- explicit retention of PR83's known 12 transition-junction divergences, up to
  approximately 674 m, as an unresolved limitation rather than accepted
  round-trip behavior.

The adapter result contract and its persistence/readback boundary remain an
implementation dependency within the existing programme. They support the ten
criteria, especially calculated consequences and lossless reopen, but do not
constitute an eleventh Delivery 1 criterion.

Existing horizontal, vertical, cant, chainage, speed, synchronized-view,
import, calculation, and reopen capabilities shall be described according to
their actual constructive, partial-evidence, evidence-only, or accepted status.
The plan does not infer missing capability merely because a current combined
acceptance has not yet been run, and it does not infer acceptance from code or
test presence.

Priority 3 is Uwe's targeted clarification and design task, not a new delivery
date or an authorization to change active authority without review. It must
reconcile the intended AIM meaning
with active Knowledge Kernel authority, the alignmentOS system/contract
boundary, demonstrated implementation, and the complete work programme. No
programme item may be removed or reclassified through terminology alone.

## Immediate Critical Path

The earlier route established the background-import and first physical
AIM-Core boundaries and then separated additional Core modules and services.
Those completed stages remain provenance; they are not newly reopened packages.

The current sequence is:

1. complete the authorized Git integration of the bounded-offline-reviewed
   branch composition against the then-current Main lineage;
2. run the current uninterrupted Delivery 1 normal-application acceptance and
   repair only concrete defects exposed against the ten existing criteria;
3. connect the resulting accepted Delivery 1 state to the Delivery 2 additions;
4. carry unresolved adapter-result, persistence/readback and PR83 junction
   limitations forward through their existing programme responsibilities,
   without expanding Delivery 1 scope or hiding known evidence.

## Continuous Handover Rule

- App Architect keeps the next implementation-ready App package prepared.
- App receives the next safe package immediately after returning a completed or
  terminally blocked package.
- Trace performs cross-artifact review and does not become the App package
  manager.
- Research, Knowledge Kernel, and Thesis continue independently within their
  scopes.
- A completed task shall not remain idle when a safe, authorized successor is
  already known.
- Routine questions, repeated approval requests, and report-only pauses shall
  not interrupt the critical path.
- Uwe is informed only for engineering decisions, genuine blockers,
  irreversible migrations, and commit/merge/push gates.

## Mathematical Escalation

Uwe is explicitly available for mathematical and railway-engineering questions,
especially:

- AXTRAN problem formulation;
- fixed, free, and constrained parameters;
- continuity and boundary conditions;
- transition-function grammar and Berlinish;
- horizontal, vertical, and cant coupling;
- intrinsic distance and chainage;
- speed-qualified consequences;
- ambiguity between mathematically valid and engineering-meaningful solutions.

Escalations shall contain:

1. the precise mathematical or engineering question;
2. known variables and assumptions;
3. the smallest reproducible example;
4. candidate options and their consequences;
5. the exact decision needed from Uwe.

Do not request Uwe's approval for routine implementation choices.

## Weekly Outcome Check

Each week must end with evidence of at least one:

- newly completed user action;
- newly established AIM Core capability;
- stable module boundary enabling independent work;
- newly synchronized view of the same Alignment state;
- removed blocker in import, creation, editing, calculation, persistence, or
  exchange.

Activity, test count, document length, and commit count alone are not outcomes.

## Schedule Protection

Delivery 1 is protected from:

- broad cleanup;
- Big-Bang refactors;
- speculative application modules;
- repeated repair chains unrelated to the Delivery 1 user path;
- Kernel or Thesis work being used as a prerequisite without a demonstrated
  product dependency;
- UI polish that does not improve orientation, action, feedback, or trust.

The dates may only be changed through an explicit Uwe/Rock delivery decision
based on observed evidence.
