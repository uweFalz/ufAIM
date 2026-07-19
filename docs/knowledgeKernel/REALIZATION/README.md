# Realization

## Domain Purpose

Realization defines how intrinsic engineering definitions acquire measurable spatial interpretation through explicit metric structures, contexts, and operators. It preserves the approved boundaries that Representation is never Identity and Metric Realization is not Identity.

## Concept Index

| Kernel ID | Concept | Status | Principal Research correspondence |
|---|---|---|---|
| [`KC-REALIZATION-001`](KC-REALIZATION-001_Metric_Realization.md) | Metric Realization | `candidate` | `KC-FOUND-007`: direct provenance |
| [`KC-REALIZATION-002`](KC-REALIZATION-002_Metric_Space.md) | Metric Space | `candidate` | `KC-FOUND-007`: partial correspondence |
| [`KC-REALIZATION-003`](KC-REALIZATION-003_Realization_Context.md) | Realization Context | `candidate` | `KC-FOUND-007/009`: partial correspondence |
| [`KC-REALIZATION-004`](KC-REALIZATION-004_Spatial_Operators.md) | Spatial Operators | `candidate` | `KC-FOUND-007`: partial correspondence |
| [`KC-REALIZATION-005`](KC-REALIZATION-005_Physical_Realization.md) | Physical Realization | `candidate` | `RESEARCH-REALIZATION-001`: supported with reformulation; accepted by `KD-2026-007` |
| [`KC-REALIZATION-006`](KC-REALIZATION-006_World_To_Track.md) | World-to-Track | `candidate` | `KC-FOUND-007`: partial correspondence |
| [`KC-REALIZATION-007`](KC-REALIZATION-007_Track_To_World.md) | Track-to-World | `candidate` | `KC-FOUND-007`: partial correspondence |

No entry is approved by KERNEL-REPAIR-003.

## Principal Dependencies and Constraints

- Identity remains intrinsic under [`KC-ID-001`](../IDENTITY/KC-ID-001_Engineering_Object_Identity.md), [`KC-ID-003`](../IDENTITY/KC-ID-003_Constructive_Identity.md), and [`KC-ID-004`](../IDENTITY/KC-ID-004_Alignment_Identity.md).
- SpotObjects remain durable engineering objects rather than realized or represented products under [`KC-SPOT-001`](../OBJECTS/KC-SPOT-001_SpotObject.md).
- Approved [`FC-001`](../FREEZES/FC-001.md) prohibits Representation from becoming Identity.
- Approved [`FC-002`](../FREEZES/FC-002.md) prohibits Metric Realization from becoming Identity.
- `KD-2026-006` fixes alignment “stationing” to intrinsic longitudinal parameterization; operational addressing remains external.

## Compact Traceability

| Kernel ID | Research evidence | Governance decision or Freeze | RefImpl correspondence | Thesis explanation | Status |
|---|---|---|---|---|---|
| KC-REALIZATION-001 | `KC-FOUND-007` direct | FC-001, FC-002 | metric and coordinate services | `foundations/metric_realization.tex` | `candidate` |
| KC-REALIZATION-002 | `KC-FOUND-007` partial | FC-002 | `MetricSpace`, Euclidean backend, factory | `foundations/metric_realization.tex` | `candidate` |
| KC-REALIZATION-003 | `KC-FOUND-007/009` partial | FC-002 | coordinate context and compatibility | metric realization; engineering context | `candidate` |
| KC-REALIZATION-004 | `KC-FOUND-007` partial | FC-001, FC-002 | metric interfaces and coordinate services | `foundations/operators.tex` | `candidate` |
| KC-REALIZATION-005 | `RESEARCH-REALIZATION-001` direct reformulation provenance | `KD-2026-007`, FC-001, FC-002 | target/physical/observed separation required; conformance unverified | construction/realization and observation chapters | `candidate` |
| KC-REALIZATION-006 | `KC-FOUND-007` partial; `KC-FOUND-004` boundary | `KD-2026-006`, FC-001, FC-002 | incomplete projection correspondence | world-to-track and runtime chapters | `candidate` |
| KC-REALIZATION-007 | `KC-FOUND-007` partial; `KC-FOUND-004` boundary | `KD-2026-006`, FC-001, FC-002 | coordinate helpers; incomplete | world-to-track and operator chapters | `candidate` |

Implementation and Thesis matches are correspondence evidence, not authority or demonstrated conformance.

## Unresolved Work

- `K3-REAL-001` is resolved by `KD-2026-007`: the stable ID now names the relational/process concept Physical Realization.
- Physical Asset Identity (`KRD-001`), the complete Physical State model (`KRD-002`), and variability/uncertainty semantics (`KRD-003`) remain separate follow-up work.
- Metric-space operation minima, Realization Context compatibility, operator result semantics, and directional projection contracts require later Research and conformance packages.
- World-to-Track is potentially multivalued; Track-to-World is only conditionally paired with it. Neither is declared a global inverse.
