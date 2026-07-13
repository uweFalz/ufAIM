# MIGRATION PACKAGE — CORE EQUATIONS

## Status

Completed.

## Objective

Transform `foundations/core_equations.tex` from a cross-domain collection
of research notes into a compact canonical reference chapter.

## Affected concepts

- intrinsic state and controls,
- planar reconstruction,
- cant evolution,
- foundational railway dynamics,
- track--world relations,
- representation and engineering realization,
- surface curvature,
- numerical optimization structures.

## Affected source files

- `foundations/core_equations.tex`
- `MIGRATION_BOARD.md`

## Editorial result

- all 30 `remark` environments removed,
- continuous scientific prose established,
- externally referenced labels preserved,
- definitions retained only where they provide a stable reference target,
- domain-specific theory deferred to its canonical chapters,
- equations grouped by conceptual responsibility.

## Build verification

`pdflatex -interaction=nonstopmode -halt-on-error main.tex`
completed successfully.

Generated document: 492 pages.

The container does not provide `bibtex`; the source package retains the
existing bibliography data. The LaTeX build completed without fatal
errors.

## Remaining work

- `foundations/system_layers.tex`
- `foundations/ellipsoid_geometry.tex`
- `foundations/pose3_on_ellipsoid.tex`

## Next migration package

`foundations/system_layers.tex`
