# MISSION REPORT

## 1. Mission

Mission: `RESEARCH-ALIGNMENT-GAP-002 — Vertical, Cant, Domain, State, and Persistence Contracts`

Responsible stream: `research`

Objective: refine the open mathematical conventions for vertical geometry,
cant, common intrinsic domain, explicit zero versus unknown, and behaviorally
equivalent persistence into decision-ready contracts and counterexamples for a
later Alignment Aggregate.

Package:
`docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/`

## 2. Status

`complete`

Research outcome: `survives with reformulation`.

The GAP-001 nucleus survives with a precise two-level contract: a common
horizontal-distance coordination domain plus family-preserving vertical and
cant laws. Persistence requires constructive losslessness and declared
edit-operation bisimulation, not only value or sample equality.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Documents/developer/ufAIM`
- Branch: `main`
- Baseline commit: `5c7a99be086fdf38ce189035a61553239c242ae6`
- Authorized path:
  `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/`
- Read-only evidence:
  - GAP-001 and railway-history Research;
  - active Alignment identity candidate;
  - current horizontal App-Core correspondence;
  - official buildingSMART, OGC and DIN sources.
- Excluded: active Kernel bodies, Governance, App, Thesis, Direction documents,
  prior Research packages.
- Parallel App, Core, transition, import and test changes were present and
  remained outside this package.

## 4. Work Performed

Tests and results:

- derived the exact relation between horizontal distance, spatial length,
  gradient and vertical curvature;
- proved by counterexample that parabolic and circular vertical curves are not
  interchangeable;
- separated cant difference, cant angle and paired rail offsets;
- proved that scalar cant cannot uniquely determine rail realization;
- defined common-domain coverage and deterministic boundary ownership;
- defined a typed knowledge-state algebra in which explicit zero is
  `Known(0)` and unknown is not numeric;
- defined cross-facet unknown propagation;
- defined structural losslessness and operation-surface edit-bisimulation for
  persistence;
- supplied nine future persistence conformance fixtures;
- isolated five genuine non-equivalent model decisions and routine
  consequences that require no escalation.

Main candidate:

Use directed horizontal-plan arc length as the first common coordination
parameter; preserve vertical and cant constructive families; preserve paired
rail offsets when known; accept scalar cant only as partial evidence; and
version the persistence query/command equivalence surface.

Confidence:

- high for mathematical non-equivalence results;
- high for zero/unknown separation;
- medium-high for the proposed first Aggregate contracts;
- medium for persistence edit-bisimulation scope pending implementation.

## 5. Changed Files

Added:

- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/README.md`
- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/MATHEMATICAL_CONTRACTS.md`
- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/BEHAVIORAL_PERSISTENCE.md`
- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/COUNTEREXAMPLES_AND_DECISIONS.md`
- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/EVIDENCE.md`
- `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/MISSION_REPORT.md`

Modified: None.

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- Official IFC vertical/cant/common-domain pages: checked; `passed`.
- OGC LandInfra cant and direction semantics: checked; `passed`.
- DIN EN 13803 metadata: checked; `passed`.
- Full EN 13803 normative formulas: `not run`; paywalled, and no unsupported
  formula claim was introduced.
- Symbolic derivations MC-01 through MC-04: independently checked; `passed`.
- Ten counterexamples and five decision dossiers: completeness checked;
  `passed`.
- Required local links and institutional URLs: checked; `passed`.
- Trailing-whitespace and Git diff checks: `passed`.
- Scope audit: `passed`; only the six new Research files belong to this
  mission.
- No active Kernel, Governance, App, Thesis, Direction or prior Research file
  changed.

## 7. Kernel and Architecture Impact

Kernel impact: candidate

The contracts refine but do not approve the relationship among intrinsic
domain, vertical/cant construction, identity and knowledge state.

Architecture impact: candidate

They define a potential browser-independent facet/query and persistence
contract for a later Alignment Aggregate.

RefImpl impact: follow-up-required

Future Core work can use the decision dossiers and fixtures; no implementation
file was changed.

Thesis impact: follow-up-required

The parabola/circle, scalar/paired cant, zero/unknown and persistence
distinctions are suitable later explanations but are not applied here.

## 8. Conflicts, Risks, and Open Decisions

- `GAP2-D001`: choose horizontal-plan arc length, spatial arc length, or an
  abstract parameter as common coordination domain. Recommendation:
  horizontal-plan arc length.
- `GAP2-D002`: preserve vertical families or normalize to polynomial/circular
  form. Recommendation: preserve families.
- `GAP2-D003`: choose authoritative paired rail offsets, scalar cant, or cant
  angle. Recommendation: paired offsets; scalar/angle remain partial forms.
- `GAP2-D004`: native explicit-zero creation versus unknown import. Recommendation:
  select by provenance path, not globally.
- `GAP2-D005`: define persistence equivalence by versioned command-surface
  bisimulation rather than query-only equality.
- Superseded by GAP2-D003 correction: the ufAIM/AIM-Core working trajectory is
  the midpoint between governing rail edges; lower/inner-rail trajectories are
  source/rule provenance, not Core datum options.
- Risk: small-angle approximations could erase source family if stored as
  authoritative construction.
- Risk: paired cant without rail-head-distance and side conventions remains
  under-specified.
- Risk: behavioral equivalence can only cover a declared, versioned operation
  surface; it cannot quantify all future behavior.

## 9. Handover

Next safe step:

Submit `GAP2-D001` through `GAP2-D005` as one focused mathematical/engineering
decision package to Uwe/Rock, then use the selected baseline in
`APP-CORE-PRAN-001`.

The precise highest-priority questions are:

1. confirm horizontal-plan arc length as common coordination parameter;
2. confirm family-preserving vertical construction;
3. confirm paired cant as authoritative native form and select its default
   datum rule;
4. confirm provenance-dependent zero/unknown creation;
5. freeze the first versioned persistence command-equivalence surface.

No routine implementation choice requires approval.

Areas a successor may touch:

- browser-independent AIM-Core Alignment contract modules;
- Core-only conformance fixtures;
- no active Kernel or Thesis source until separately authorized.

Independent work:

- Knowledge Kernel may review identity composition and persistence decisions;
- Research may inspect organization-specific cant datum conventions;
- Thesis may prepare non-canonical explanatory figures.

Done criterion for the successor:

The five decisions are recorded; the Core contract names `σ`, vertical/cant
families, rail datum, knowledge states and persistence equivalence explicitly;
fixtures P-01 through P-09 are executable; and no approximation or migration
can silently change constructive family or unknown into known zero.
