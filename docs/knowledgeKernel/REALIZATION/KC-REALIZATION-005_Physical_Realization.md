# KC-REALIZATION-005 Physical Realization

## Status

`candidate`

## Canonical Question

How is an intended engineering state related to the physically produced or maintained asset and its time-indexed physical states?

## Candidate Canonical Answer

Physical Realization is the construction- and maintenance-mediated relation or process by which an intended engineering state is instantiated in a physical asset and gives rise to time-indexed physical states.

## Normative Meaning

- Physical Realization relates intended engineering state to physical production, maintenance, and resulting physical states.
- Construction tolerances, material behavior, environmental effects, operational effects, maintenance, and adjustment may cause a physical state to differ from the intended state.
- One constructive definition may be physically realized by multiple distinct assets, and one physical asset may pass through multiple physical states over time.
- Physical Realization does not transfer or redefine Engineering Object Identity; it records a governed relation between intent and physical outcome.
- The reformulation from Physical Realization Space is effective under [`KD-2026-007`](../GOVERNANCE/DECISION_LOG.md#kd-2026-007).

## Boundaries

- Physical Realization is not a coordinate space, Metric Space, Realization Context, or container of physical objects.
- It does not define Physical Asset Identity or the complete lifecycle and identity rules of a physical asset.
- It does not define the complete Physical State model, state history, or temporal ontology.
- A Physical State is a time-indexed condition resulting from or affected by physical processes; it is not the realization relation itself.
- Observation provides evidence about physical states but is not physical reality. Observation uncertainty belongs to evidence acquisition and interpretation; it must remain distinct from construction variability and physical-state variation.
- Representation communicates or encodes information about intent, assets, states, or observations but is none of them.
- Metric Realization makes states measurable; it does not establish that an asset was constructed or maintained.

## Relations to Other Kernel Concepts

- Presupposes an intended constructive or engineering state without redefining [`KC-ID-003 Constructive Identity`](../IDENTITY/KC-ID-003_Constructive_Identity.md).
- Remains distinct from [`KC-REALIZATION-001 Metric Realization`](KC-REALIZATION-001_Metric_Realization.md), [`KC-REALIZATION-002 Metric Space`](KC-REALIZATION-002_Metric_Space.md), and [`KC-REALIZATION-003 Realization Context`](KC-REALIZATION-003_Realization_Context.md).
- May supply physical-state subjects for later observation and evaluation concepts, which remain outside this candidate.
- Is constrained by approved [`FC-001`](../FREEZES/FC-001.md) and [`FC-002`](../FREEZES/FC-002.md).

## Consequences for Reference Implementation

- Target state, physical asset reference, physical-state records, observations, and representations must remain distinguishable in data and service boundaries.
- Implementations should not treat measured geometry as the physical state without observation provenance, uncertainty, and an explicit inference step.
- Construction variability and physical-state change should not be stored as observation uncertainty.
- This candidate defines no persistence schema, asset-identity mechanism, state-history model, or realization algorithm.

## Consequences for Thesis

- The Thesis should use Physical Realization for the target-to-physical relation or process and stop presenting it as a space.
- Physical Asset, Physical State, Observed State, Observation, and Representation should remain explicitly distinct.
- Target-versus-realized examples should separate physical variability from measurement uncertainty.

## Evidence and Origin

- Governance decision: [`KD-2026-007`](../GOVERNANCE/DECISION_LOG.md#kd-2026-007), confirmed by Uwe Falz on 2026-07-19.
- Research provenance: [`RESEARCH-REALIZATION-001 Physical Realization Space`](../research/REALIZATION/RESEARCH-REALIZATION-001_Physical_Realization_Space.md), outcome `supported with reformulation`.
- Research boundary: [`KC-FOUND-007 Metric Realization`](../research/FOUNDATIONS/KC-FOUND-007_Metric_Realization.md), which remains a different concept.
- Approved boundaries: [`FC-001`](../FREEZES/FC-001.md) and [`FC-002`](../FREEZES/FC-002.md).
- Thesis correspondence: [`reality/construction_and_realization.tex`](../../thesis/AIM/reality/construction_and_realization.tex), [`foundations/ontology.tex`](../../thesis/AIM/foundations/ontology.tex), and [`reality/measurement_and_imperfect_data.tex`](../../thesis/AIM/reality/measurement_and_imperfect_data.tex); these are explanation, not authority.

Principal correspondence classification: direct provenance from the accepted reformulation in `RESEARCH-REALIZATION-001`, governed by `KD-2026-007`.

## Open Decisions

- `KRD-001`: Ownership and identity criteria for Physical Assets require a separate Research and Governance package; this candidate does not assign them.
- `KRD-002`: The complete time-indexed Physical State and state-history model requires separate Research; this candidate states only the relation and boundary needed for Physical Realization.
- `KRD-003`: The formal model for construction variability, process uncertainty, environmental effects, and their separation from observation uncertainty remains open.
