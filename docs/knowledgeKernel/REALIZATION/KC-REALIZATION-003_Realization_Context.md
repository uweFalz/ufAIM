# KC-REALIZATION-003 Realization Context

## Status

`candidate`

## Canonical Question

Which dependencies are required to evaluate a particular Metric Realization?

## Candidate Canonical Answer

A Realization Context is the explicit set of metric, reference, convention, and applicability dependencies required to interpret an intrinsic engineering definition as a particular measurable spatial state.

## Normative Meaning

- The context identifies the Metric Space and any reference system, surface, frame, conventions, rules, precision, or applicability information needed for evaluation.
- Only dependencies that affect metric interpretation belong to the Realization Context.
- Different contexts may yield different realizations of the same engineering object.
- Context must be explicit enough to make realized quantities interpretable and reproducible within stated limits.

## Boundaries

- Realization Context is not Engineering Context, project/workflow context, runtime session, viewer state, or representation configuration.
- A CRS may be one dependency but is not synonymous with the complete context.
- Contextual metadata does not become intrinsic identity merely because evaluation requires it.
- This entry does not prescribe storage schema, lifecycle, or UI selection behavior.

## Relations to Other Kernel Concepts

- Qualifies [`KC-REALIZATION-001 Metric Realization`](KC-REALIZATION-001_Metric_Realization.md) and selects [`KC-REALIZATION-002 Metric Space`](KC-REALIZATION-002_Metric_Space.md).
- Supplies applicability dependencies to [`KC-REALIZATION-004 Spatial Operators`](KC-REALIZATION-004_Spatial_Operators.md).
- Remains distinct from workflow/project context under [`KC-FOUND-009`](../research/FOUNDATIONS/KC-FOUND-009_Workflow_Project_Context.md).
- Cannot define Identity under [`FC-002`](../FREEZES/FC-002.md).

## Consequences for Reference Implementation

- Operator calls should receive or resolve an explicit context rather than depend on hidden global viewer or session state.
- CRS status, metric backend, frames, and tolerances may correspond to context fields; current shapes are not canonical.
- Missing or incompatible dependencies should produce an explicit applicability outcome.

## Consequences for Thesis

- The Thesis should separate realization dependencies from engineering meaning and organizational context.
- CRS examples should be presented as context components, not complete definitions.

## Evidence and Origin

- Partial Research correspondence: [`KC-FOUND-007`](../research/FOUNDATIONS/KC-FOUND-007_Metric_Realization.md) names CRS and realization rules; [`KC-FOUND-009`](../research/FOUNDATIONS/KC-FOUND-009_Workflow_Project_Context.md) supplies the organizational boundary.
- Draft evidence: [`CoreBoundary`](../_draft/30-boundaries/CoreBoundary.md).
- RefImpl correspondence: [`CoordAgent.js`](../../../src/domain/coord/CoordAgent.js), [`CoordCompatibility.js`](../../../src/domain/coord/CoordCompatibility.js), and metric-space factory behavior.
- Thesis explanation: [`foundations/metric_realization.tex`](../../thesis/AIM/foundations/metric_realization.tex) and [`kernel/engineering_context.tex`](../../thesis/AIM/kernel/engineering_context.tex).

Principal correspondence classification: partial correspondence; Research establishes contextual realization dependencies without a separate canonical context definition.

## Open Decisions

- Required versus optional context fields and context-compatibility rules require focused Research.
