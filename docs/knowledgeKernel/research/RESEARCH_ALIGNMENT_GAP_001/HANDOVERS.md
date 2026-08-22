# Concrete Handovers

These are implementation and editorial candidates. They do not authorize
changes and do not approve Kernel content.

## 1. App-Core handover

### APP-CORE-PRAN-001 — Alignment Aggregate Contract

Mission-filter value:

- establishes a required AIM-Core capability;
- creates a stable module boundary;
- removes blockers from creation, editing, calculation, and persistence.

Objective:

Define a browser-independent, language-neutral-leaning `AlignmentAggregate`
contract that coordinates existing horizontal construction with explicit
vertical, cant, addressing, topology, realization, evaluation, and revision
ports without importing App/UI/SPOT concerns into Core.

First package:

1. immutable aggregate header:
   - `alignmentId`;
   - `revisionId`, parent revision, schema version;
   - intrinsic domain and orientation;
   - units and convention identifiers;
2. typed facet states:
   - `present`;
   - `explicit-zero`;
   - `unknown`;
   - `not-applicable` only where professionally valid;
3. read-only interfaces for:
   - horizontal law;
   - vertical law;
   - cant law;
   - address mapping;
   - topology participation;
   - realization context;
   - speed/evaluation contexts;
4. no UI, IFC, GND, or persistence-technology dependency.

Done criterion:

- empty/local Alignment can represent H plus explicit zero V/C;
- imported incomplete Alignment can represent unknown V/C without converting
  them to zero;
- one intrinsic location queries all available facets;
- contract roundtrips through a technology-neutral fixture;
- existing horizontal tests remain green.

### APP-CORE-PRAN-002 — Vertical and Cant Laws

Objective:

Implement vertical and cant constructive laws on the intrinsic domain with
explicit sign/reference conventions and continuity checks.

Required mathematical escalation to Uwe:

- exact choice of vertical and cant primary functions;
- rail/axis/gauge convention;
- continuity classes at element boundaries;
- relationship between horizontal `s`, spatial arc length, and profile/cant
  parameters;
- which degrees of freedom AXTRAN may vary in the first coupled edit.

Done criterion:

- plan, profile, and cant return synchronized values for the same intrinsic
  station;
- explicit zero differs from unknown;
- one edit produces reviewable connected residuals without partial mutation.

### APP-CORE-PRAN-003 — Address, topology, and realization ports

Objective:

Provide:

- potentially multi-valued `s ↔ operational address`;
- explicit standalone/connected topology participation;
- local-cartesian or qualified-world realization status;
- ambiguity-bearing World-to-Track results.

Done criterion:

- kilometre jump has correct incoming/outgoing results;
- re-kilometring does not change intrinsic Alignment identity;
- disconnected Alignment is a valid explicit state;
- missing/conflicting CRS never produces falsely geographic output.

### APP-CORE-PRAN-004 — Lossless revision and behavioral roundtrip

Objective:

Persist constructive source intent, relations, conventions, provenance, and
revision lineage through a storage-independent port.

Done criterion:

`create/import → query → edit → calculate → save → reopen → recalculate`
produces equivalent constructive laws, identifiers under the declared policy,
address mappings, topology references, realization status, evaluation inputs,
and residuals.

## 2. Knowledge Kernel handover

### KK-PRAN-001 — Working Aggregate versus Alignment Identity

Question for Governance:

Does the Kernel need a concept for the **work-capable Alignment aggregate** that
coordinates but does not absorb:

- Alignment Identity;
- constructive horizontal/vertical/cant laws;
- operational addressing;
- topology participation;
- metric realization;
- evaluation contexts;
- revision/persistence?

Candidate answer:

Yes, if defined as a coordination boundary rather than a new super-identity.

Required checks:

1. preserve `KD-2026-006`: intrinsic parameterization is not operational
   kilometre;
2. preserve CRS/realization separation;
3. preserve calculation/evaluation/decision/authority separation;
4. specify whether vertical and cant laws contribute to constructive identity
   or are independently identified constructive dependents;
5. specify identity survival across edits and revisions;
6. decide whether a disconnected Alignment has complete object identity while
   holding an explicit topology-participation state.

Decision identifiers:

- `PRAN-KD-001`: identity composition of horizontal, vertical, and cant laws;
- `PRAN-KD-002`: identity persistence under constructive change;
- `PRAN-KD-003`: role of the work aggregate versus SPOT/project context;
- `PRAN-KD-004`: topology port versus network identity.

Do not promote the candidate definition from `POSITIVE_NUCLEUS.md` without
Governance review.

## 3. Thesis handover

### THESIS-PRAN-001 — What must an Alignment know to work?

Purpose:

Use the positive nucleus as an accessible synthesis chapter or late bridge,
after the historical chapter proposed by HISTORY-003 and before detailed
application/exchange consequences.

Reader arc:

1. a line on a map is not yet an editable railway Alignment;
2. three constructive laws share one intrinsic route through the problem;
3. kilometre, topology, and CRS locate different things;
4. speed evaluates the railway use without becoming geometry;
5. change and persistence turn description into working knowledge;
6. ufAIM reconnects established responsibilities; novelty remains a hypothesis
   about the integration and formal role separation.

Suggested figure:

One central intrinsic spine with three constructive bands (H/V/C), surrounded
by three separate relation fields (address, network, world), one evaluation
field (speed/rules), and a revision/change bracket. Avoid boxes-and-arrows
workflow appearance and do not present the whole aggregate as identity.

Citation plan:

- reuse HISTORY-003 stable IDs;
- IFC: H/V/C and business-logic/geometry distinction;
- ISO 19148: linear referencing;
- LandInfra/InfraGML: Alignment/Railway/cant/kilometre relations;
- EN 13803: speed-dependent alignment parameters;
- UIC RTM/RSM: multi-level topology and positioning;
- Simms/Talbot/Schramm/ÖBB: historical constructive accumulation.

Claims requiring qualification:

- “minimal complete” is a Research result, not a standard definition;
- “ufAIM synthesis” is not a priority claim;
- persistence completeness is a proposed engineering criterion;
- no current standard is claimed categorically deficient beyond the inspected
  scope.

Done criterion:

- English/German explanations preserve all role separations;
- every standards claim has a stable citation;
- zero/unknown distinction is explicit;
- no diagram implies that evaluation or authority owns identity;
- the chapter states which parts are established knowledge, ufAIM synthesis,
  and open research.

## 4. Independent sequencing

The streams can proceed without blocking one another:

- App-Core can prototype the aggregate interface using candidate terminology;
- Kernel can review identity/coordination boundaries independently;
- Thesis can prepare a source/figure plan but should wait for Kernel decisions
  before canonical definitions;
- Research can deepen vertical/cant conventions and persistence equivalence.

The highest delivery-value successor is `APP-CORE-PRAN-001`, because it creates
a stable module boundary and exposes missing facet states without requiring the
entire nucleus to be implemented at once.
