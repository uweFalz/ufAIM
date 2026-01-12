# ufAIM — Alignment Engineering for Infrastructure & BIM

ufAIM is an engineering-focused framework and reference application
for alignment-based infrastructure planning.

Unlike conventional BIM tools, ufAIM treats alignments
(track geometry, transitions, gradients, cant)
as first-class, deterministic engineering objects —
not as derived geometry.

ufAIM ist ein ingenieurzentriertes Framework mit Referenzanwendung
für trassierungsbasierte Infrastrukturplanung.

Im Gegensatz zu klassischen BIM-Werkzeugen werden Achsen und
Übergangsbögen nicht als abgeleitete Geometrie,
sondern als explizite, deterministische Engineering-Objekte behandelt.

## Why Alignments?

In railway and road infrastructure projects,
the alignment is the governing design element.
It defines geometry, kinematics, comfort, and feasibility.

However, most BIM tools treat alignments as secondary artifacts,
often losing semantic information such as curvature continuity,
transition logic, or design intent.

ufAIM addresses this gap by introducing a sparse, parametric
alignment core designed for engineering-grade analysis and optimization.

## Tool and Framework

ufAIM serves two roles:

- An **alignment core framework** (sparse alignment, transition families, math & geometry utilities)
- A **reference application** demonstrating import, visualization, and workflow integration

The application is intentionally kept lightweight.
Its primary purpose is to validate and expose the underlying alignment core.

## BIM and IFC

ufAIM currently treats IFC models primarily as contextual geometry
(e.g. terrain, structures, existing assets).

Support for IFC-based alignment entities is planned,
but deliberately postponed until the sparse alignment core
and validation workflows are stable.

This avoids premature coupling between representation and engineering logic.
