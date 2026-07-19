# KC-REALIZATION-002 Metric Space

## Status

`candidate`

## Canonical Question

What structure makes spatial quantities and operations measurable within a realization?

## Candidate Canonical Answer

A Metric Space supplies the metric structure and operations by which distances, directions, positions, curvature, and related spatial quantities are interpreted in a Metric Realization.

## Normative Meaning

- A Metric Space defines which metric quantities and operations are meaningful and how they are evaluated.
- It is selected or established within a Realization Context and constrains applicable spatial operators.
- Multiple Metric Spaces may realize the same intrinsic engineering object and may produce different metric evaluations.
- Metric structure belongs to realization, not to object identity.

## Boundaries

- A Metric Space is not an Engineering Object, CRS identifier, coordinate array, renderer, runtime backend, or class hierarchy.
- A CRS may contribute to a context but does not by itself exhaust the metric-space definition.
- Euclidean behavior is one possible realization, not the universal canonical model.
- This entry does not require every space to support every operation or a globally valid coordinate chart.

## Relations to Other Kernel Concepts

- Enables [`KC-REALIZATION-001 Metric Realization`](KC-REALIZATION-001_Metric_Realization.md).
- Is selected and qualified by [`KC-REALIZATION-003 Realization Context`](KC-REALIZATION-003_Realization_Context.md).
- Supplies domain structure used by [`KC-REALIZATION-004 Spatial Operators`](KC-REALIZATION-004_Spatial_Operators.md).
- Does not own Identity under [`FC-002`](../FREEZES/FC-002.md).

## Consequences for Reference Implementation

- Code should depend on explicit metric operations rather than assume raw coordinate arithmetic is universally valid.
- `MetricSpace.js` and `EuclideanMetricSpace.js` correspond to an interface and one backend; they are not the canonical definition.
- Unsupported operations and domain restrictions should be explicit rather than silently approximated.

## Consequences for Thesis

- The Thesis should distinguish abstract metric structure from CRS notation and concrete numerical implementations.
- Alternative metric models should be presented as realizations of the same engineering definition where applicable.

## Evidence and Origin

- Partial Research correspondence: [`KC-FOUND-007`](../research/FOUNDATIONS/KC-FOUND-007_Metric_Realization.md) requires measurable spatial state through CRS, metric operators, and realization rules but does not separately define Metric Space.
- RefImpl correspondence: [`MetricSpace.js`](../../../src/domain/metric/MetricSpace.js), [`EuclideanMetricSpace.js`](../../../src/domain/metric/EuclideanMetricSpace.js), and [`metricSpaceFactory.js`](../../../src/domain/metric/metricSpaceFactory.js).
- Thesis explanation: [`foundations/metric_realization.tex`](../../thesis/AIM/foundations/metric_realization.tex).

Principal correspondence classification: partial correspondence; the candidate is a bounded elaboration of the metric dependency in `KC-FOUND-007`, not a transcription of `MetricSpace.js`.

## Open Decisions

- The minimum required operation set and rules for non-Euclidean or projection-aware spaces require focused Research.
