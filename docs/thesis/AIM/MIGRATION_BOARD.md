# THESIS MIGRATION BOARD

## Status

Working editorial refactoring board.

## Governing rule

Each chapter has one primary explanatory responsibility. Material that
belongs elsewhere is removed from the active chapter only after its
canonical destination has been identified. The board records destination
responsibility; the source text remains available through version
history and the original baseline archive.

## Completed foundation package

| File | Responsibility | Status |
|---|---|---|
| `main.tex` | Thesis structure and chapter order | migrated |
| `macros.tex` | Technical and mathematical LaTeX helpers | migrated |
| `foundations/kernel_glossary.tex` | Concise Kernel vocabulary | migrated, subject to Kernel synchronization |
| `foundations/axioms.tex` | Mathematical axioms of intrinsic planar geometry | migrated |
| `foundations/principles.tex` | Architectural principles | migrated |
| `foundations/notation.tex` | Symbols and writing conventions only | migrated |
| `foundations/state_model.tex` | Foundational engineering-state model | migrated |
| `foundations/core_equations.tex` | Shared canonical reference equations | migrated |
| `foundations/operators.tex` | Canonical operator concept and operator families | migrated |
| `foundations/metric_realization.tex` | Metric interpretation of intrinsic engineering descriptions | migrated |
| `foundations/ontology.tex` | Conceptual categories and responsibility boundaries | migrated |

## Harvest destinations created by this package

Material formerly mixed into `notation.tex` and `state_model.tex` has
been assigned as follows:

| Material | Canonical destination | State |
|---|---|---|
| architectural separation and ambiguity rules | `foundations/principles.tex` | integrated |
| pose, pose2, foundational pose3, controls | `foundations/state_model.tex` | integrated |
| target and physically realized geometry | `foundations/metric_realization.tex` / reality chapters | pending destination migration |
| runtime-evaluated quantities and runtime services | `runtime/runtime_operators.tex` | pending destination migration |
| sparse and hybrid representations | `modeling/sparse.tex` | pending destination migration |
| optimization variables and realization-aware objectives | optimization chapters | pending destination migration |
| geodesic and normal curvature theory | `foundations/ellipsoid_geometry.tex` | pending destination migration |
| vehicle space and operational geometry | `dynamics/vehicle_space.tex` | pending destination migration |

## Next foundation files

1. `foundations/system_layers.tex`
2. `foundations/ellipsoid_geometry.tex`
3. `foundations/pose3_on_ellipsoid.tex`

Each is to be harvested and rewritten against the responsibilities fixed
by the completed package.
