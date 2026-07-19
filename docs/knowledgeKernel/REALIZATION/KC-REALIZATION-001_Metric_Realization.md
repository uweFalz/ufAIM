# KC-REALIZATION-001 Metric Realization

## Status

`candidate`

## Canonical Question

How does an intrinsic engineering definition acquire measurable spatial meaning?

## Candidate Canonical Answer

Metric Realization interprets an intrinsic engineering definition as measurable spatial state under an explicit metric space, realization context, and applicable realization rules.

## Normative Meaning

- The realized input is an intrinsic constructive or object definition; the output is metric state in which spatial quantities can be evaluated.
- Metric Realization supplies measurable interpretation without owning or replacing Engineering Object Identity.
- Its result depends on the chosen metric space, context, rules, and applicability conditions.
- The same engineering object may admit multiple valid realizations whose metric quantities differ while identity remains stable.

## Boundaries

- Metric Realization is not identity, constructive definition, coordinate conversion, rendering, serialization, or physical construction.
- Coordinates and geometry are realized quantities, not automatic identity criteria.
- A representation may expose a realization but cannot create missing realization semantics.
- This entry does not prescribe a particular algorithm, CRS, dimensionality, or service class.

## Relations to Other Kernel Concepts

- Consumes intrinsic definitions governed by [`KC-ID-001`](../IDENTITY/KC-ID-001_Engineering_Object_Identity.md) and [`KC-ID-003`](../IDENTITY/KC-ID-003_Constructive_Identity.md).
- Uses [`KC-REALIZATION-002 Metric Space`](KC-REALIZATION-002_Metric_Space.md), [`KC-REALIZATION-003 Realization Context`](KC-REALIZATION-003_Realization_Context.md), and applicable [`KC-REALIZATION-004 Spatial Operators`](KC-REALIZATION-004_Spatial_Operators.md).
- Is constrained by approved [`FC-001`](../FREEZES/FC-001.md) and [`FC-002`](../FREEZES/FC-002.md).
- Physical realization and representation remain distinct downstream concerns.

## Consequences for Reference Implementation

- Realization services should take intrinsic information and explicit context rather than infer identity from coordinates.
- Metric backends and coordinate services are correspondence evidence; no current class alone defines the realization contract.
- Alternative metric realizations must remain traceable to the same source object when engineering sameness is preserved.

## Consequences for Thesis

- The Thesis should explain the transition from intrinsic definition to metric interpretation and keep it separate from CRS transformation, rendering, and physical realization.
- Examples of Euclidean or projection-aware realization should not be presented as the only valid metric model.

## Evidence and Origin

- Direct Research provenance: [`KC-FOUND-007 Metric Realization`](../research/FOUNDATIONS/KC-FOUND-007_Metric_Realization.md).
- Research boundaries: [`KC-FOUND-003 Constructive Identity`](../research/FOUNDATIONS/KC-FOUND-003_Constructive_Identity.md) and [`KC-FOUND-008 Representation`](../research/FOUNDATIONS/KC-FOUND-008_Representation.md).
- Draft evidence: [`PR-002`](../_draft/00-principles/PR-002-realization.md), [`MetricRealizationService`](../_draft/20-services/MetricRealizationService.md), and [`CoreBoundary`](../_draft/30-boundaries/CoreBoundary.md).
- RefImpl correspondence: [`MetricSpace.js`](../../../src/domain/metric/MetricSpace.js), [`metricSpaceFactory.js`](../../../src/domain/metric/metricSpaceFactory.js), and coordinate-context services under `src/domain/coord/`.
- Thesis explanation: [`foundations/metric_realization.tex`](../../thesis/AIM/foundations/metric_realization.tex) and [`reality/construction_and_realization.tex`](../../thesis/AIM/reality/construction_and_realization.tex).

Principal correspondence classification: direct provenance from `KC-FOUND-007`; implementation and Thesis are explanatory correspondence only.

## Open Decisions

- Applicability and equivalence criteria for comparing multiple valid realizations require later governed elaboration.
