# KC-REALIZATION-004 Spatial Operators

## Status

`candidate`

## Canonical Question

How are spatial states evaluated or mapped between defined realization domains?

## Candidate Canonical Answer

A Spatial Operator is a context-qualified mapping from a stated spatial domain to a stated codomain, with explicit applicability, uncertainty, and multiplicity conditions.

## Normative Meaning

- Every operator declares its input domain, output codomain, required Realization Context, and applicability conditions.
- Outputs may be exact, approximate, set-valued, ranked, or unavailable when the governing geometry and context require it.
- Composition is valid only when adjacent codomain/domain and context requirements are compatible.
- An inverse relationship exists only on stated restricted domains and need not be unique or total.

## Boundaries

- A Spatial Operator is not its algorithm, service, class, API, cache, or renderer.
- Operator naming does not prove compatible domains, inverse behavior, or conformance.
- Coordinate transformations, realization operators, and projections must remain distinguishable by their declared domains and codomains.
- This entry prescribes no class hierarchy or numerical method.

## Relations to Other Kernel Concepts

- Operates within [`KC-REALIZATION-002 Metric Space`](KC-REALIZATION-002_Metric_Space.md) under [`KC-REALIZATION-003 Realization Context`](KC-REALIZATION-003_Realization_Context.md).
- Includes the bounded [`KC-REALIZATION-006 World-to-Track`](KC-REALIZATION-006_World_To_Track.md) and [`KC-REALIZATION-007 Track-to-World`](KC-REALIZATION-007_Track_To_World.md) operators.
- May participate in [`KC-REALIZATION-001 Metric Realization`](KC-REALIZATION-001_Metric_Realization.md) without becoming Identity or representation.

## Consequences for Reference Implementation

- Interfaces should expose domain assumptions, context, failure, ambiguity, quality, and multiplicity rather than return an unexplained coordinate tuple.
- Forward and inverse services may use different algorithms and contracts.
- Service implementations must not silently enlarge an operator's valid domain.

## Consequences for Thesis

- Operator notation should state domain, codomain, context, and restrictions.
- Claims of inversion or composition should include compatibility and uniqueness conditions.

## Evidence and Origin

- Partial Research correspondence: [`KC-FOUND-007`](../research/FOUNDATIONS/KC-FOUND-007_Metric_Realization.md) explicitly requires metric operators but does not define their general contract.
- RefImpl correspondence: metric operator interfaces and coordinate services under `src/domain/metric/` and `src/domain/coord/`.
- Thesis explanation: [`foundations/operators.tex`](../../thesis/AIM/foundations/operators.tex), [`state/world_to_track.tex`](../../thesis/AIM/state/world_to_track.tex), and [`runtime/runtime_services.tex`](../../thesis/AIM/runtime/runtime_services.tex).

Principal correspondence classification: partial correspondence; Thesis supplies detailed notation but is not authority.

## Open Decisions

- A common result model for uncertainty, multiple solutions, and applicability remains a focused design and Research question.
