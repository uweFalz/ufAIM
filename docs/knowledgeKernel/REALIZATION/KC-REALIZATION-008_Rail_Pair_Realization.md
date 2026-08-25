# KC-REALIZATION-008 Rail-Pair Realization

## Status

`candidate`

## Canonical Question

How does a railway Alignment construction determine a qualified pair of
spatial rail references without turning derived rail geometry into independent
constructive truth or vehicle state?

## Candidate Canonical Answer

Rail-Pair Realization is the context-qualified spatial operator by which
horizontal Alignment geometry, a local non-canted profile reference, a
rail-bound cross-section construction, and Metric Realization jointly derive
the governing left and right rail references. The cross-section construction
contains a primary rule locating the rail pair relative to the horizontal
Alignment reference, sparse offsets for both persistent rail identities, and
a qualified separation law.

The geometric midpoint of the realized governing rail pair is the preferred
derived kinematic anchor. Cross-level, common offset, roll, spatial rail
trajectories, track frame, and pose3 remain derived states rather than
additional equal-ranking constructive truths.

## Normative Meaning

- `coordGeom`, `profile`, and `cant` are synchronized construction inputs over
  a common intrinsic longitudinal parameter; they are not vehicle states.
- Within this railway construction, `profile` supplies the vertical law of the
  local non-canted reference frame along the horizontal Alignment reference.
  Zero means zero rail offset in that local cross-section, not global zero
  elevation, a horizontal plane, a named rail, or the rail-pair midpoint.
- The native rail-bound cross-section contract is

  ```text
  R(s) = (anchorRule(s), cL(s), cR(s), g(s))
  ```

  where `anchorRule` locates the governing rail pair laterally relative to the
  horizontal Alignment reference, `cL` and `cR` are offsets of persistent left
  and right governing rail references from the profile reference, and `g` is a
  qualified separation law with an explicit measurement definition.
- The AIM normal anchor rule may locate the horizontal Alignment reference at
  the rail-pair midpoint. A named-rail or qualified-other source rule requires
  an explicit provenance-bearing transformation. Separation alone never
  determines both lateral rail positions.
- Left and right persist under the declared increasing-`s` convention. Inside
  and outside are derived roles, undefined at zero curvature and exchanged at
  curvature reversal without exchanging rail identity.
- For an admitted construction with explicitly complete coverage, absence of
  an offset entry for a rail means zero. In incomplete, imported, provisional,
  or observed evidence, absence means `Unknown`.
- Where the complete qualified construction permits it,

  ```text
  crossLevel(s) = cR(s) - cL(s)
  commonOffset(s) = 0.5 * (cL(s) + cR(s))
  ```

  are derived. Roll additionally depends on the qualified separation and
  reference convention.
- The operator contract is

  ```text
  Rrail :
    (coordGeom, profile, cant, anchorRule, metricRealization)
    -> RailPairGeometry
  ```

  and declares domain, codomain, Realization Context, applicability,
  provenance, ambiguity, and unavailable results.
- `RailPairGeometry` provides qualified left and right spatial rail references,
  their tangential states, and a derived track frame. Its geometric midpoint
  is the preferred kinematic anchor for runtime pose3 and idealized wheelset or
  vehicle consumers.
- Rail-Pair Realization describes intended metric geometry. It is not Physical
  Realization, an observation, a contact state, or a vehicle response.

## Boundaries

- Scalar cross-level is an incomplete view: it loses the common vertical mode.
- Qualified separation without `anchorRule` loses the common lateral mode.
- The derived midpoint anchor is not the primary `anchorRule`; the former is an
  operator result, while the latter is a construction input.
- Sparse absence is not zero without complete admitted coverage.
- RailPairGeometry, its rails, midpoint, frame, and pose3 do not establish
  Alignment or SpotObject Identity and do not automatically create a separate
  SpotObject.
- A future concept may govern rail assets or route-dependent governing pairs;
  this candidate does not admit them by implication.
- An idealized wheelset additionally requires traversal and an explicit
  wheelset model. Real wheel--rail interaction additionally requires wheel and
  rail profiles, contact state and model, operating conditions, and vehicle
  degrees of freedom.
- This entry prescribes no serialization, universal gauge measure, rail
  profile, cant-law family, numerical algorithm, or vehicle model.

## Relations to Other Kernel Concepts

- Specializes [`KC-REALIZATION-001 Metric Realization`](KC-REALIZATION-001_Metric_Realization.md)
  through a railway-domain operator governed by
  [`KC-REALIZATION-003 Realization Context`](KC-REALIZATION-003_Realization_Context.md)
  and [`KC-REALIZATION-004 Spatial Operators`](KC-REALIZATION-004_Spatial_Operators.md).
- Remains distinct from
  [`KC-REALIZATION-005 Physical Realization`](KC-REALIZATION-005_Physical_Realization.md).
- Preserves intrinsic Alignment construction under
  [`KC-ID-003 Constructive Identity`](../IDENTITY/KC-ID-003_Constructive_Identity.md)
  and [`KC-ID-004 Alignment Identity`](../IDENTITY/KC-ID-004_Alignment_Identity.md)
  without making realization constitutive of identity.
- Preserves the object/representation boundary of
  [`KC-SPOT-001 SpotObject`](../OBJECTS/KC-SPOT-001_SpotObject.md).
- Is constrained by approved [`FC-001`](../FREEZES/FC-001.md) and
  [`FC-002`](../FREEZES/FC-002.md).

## Consequences for Reference Implementation

- A later Cant Core must preserve governing left/right identities, sparse
  paired offset laws, complete versus incomplete coverage, qualified
  separation, the primary anchor rule, and overlapping laws for different
  rails.
- Scalar cross-level, common offset, midpoint, pose3, and sampled rail
  trajectories are evaluations, projections, caches, observations, or source
  evidence; they do not become equal-ranking persistence truth.
- A Rail-Pair Realization service must fail explicitly for missing anchor,
  separation, context, coverage, or ambiguous governing-pair inputs.
- Current scalar `CantConstructiveState v0.1` is correspondence evidence only
  and does not conform to the complete candidate.

## Consequences for Thesis

- Explain the profile reference as a local non-canted constructive frame, not
  a global horizon or automatically a rail trajectory.
- Present scalar cant and pose3 as derived from a complete rail-bound
  cross-section construction.
- Remove any universal assertion that a cant law follows the same normalized
  family or domain partition as `coordGeom`.
- Use track scissors, common-offset zero cross-level, undertiefung, curvature
  reversal, and lateral anchor ambiguity as counterexamples.
- Keep track construction, Rail-Pair Realization, idealized wheelset
  kinematics, contact interaction, and vehicle dynamics distinct.

## Evidence and Origin

- Direct Research provenance:
  [`RPR-D001 version 0.3`](../research/RAIL_PAIR_REALIZATION/DECISION_NOTE_RPR_D001.md).
- Prior paired-rail Research:
  [`GAP2-D003`](../research/RESEARCH_ALIGNMENT_GAP_002/DECISION_RECORD_GAP2_D003.md)
  and its [`supersession notice`](../research/RESEARCH_ALIGNMENT_GAP_002/SUPERSESSION_GAP2_D003.md).
- Governance disposition: [`KD-2026-018`](../GOVERNANCE/DECISION_LOG.md#kd-2026-018).
- Independent review: `RPR-D001-REVIEW-001`, which found no active Kernel
  conflict and required the primary horizontal anchor rule now included here.
- RefImpl correspondence: scalar Cant Core and synchronized profile projection;
  correspondence is incomplete and is not authority.
- Thesis correspondence: sparse bands, pose3, frames, and vehicle-space
  chapters; explanatory correspondence is not authority.

## Open Decisions

- Exact governing rail-reference and qualified separation taxonomy.
- Route- and domain-dependent governing-pair selection in switches, crossings,
  multi-rail, and gauge-changing systems.
- Native nonlinear cant-law families, continuity, and admissibility.
- Relationship between intended offsets and constructed, maintained, or
  observed rail states.
- Reduced ideal-wheelset models appropriate for operational evaluation.
