# fullTransEd — Transition Editor

fullTransEd is an engineering editor for transition families.

It focuses on curvature evolution,
not on spatial geometry.

fullTransEd ist ein ingenieurtechnischer Editor
für Übergangsbogen-Familien.

Im Mittelpunkt steht die Krümmungsentwicklung,
nicht die räumliche Geometrie.

Purpose
	•	edit transition families in normalized space
	•	inspect curvature and derivatives
	•	validate continuity and bounds
	•	generate lookup tables for runtime use

Relation to SparseAlignment

fullTransEd does not edit alignments directly.

Instead, it produces transition family definitions
that are referenced by transition elements
within sparse alignments.

Visualization
	•	κ(u) and derivative plots
	•	normalized domain [0, 1]
	•	no absolute coordinates

Non-Goals
	•	direct 3D editing
	•	station-based manipulation
	•	alignment-level operations

fullTransEd is a tool for defining reusable,
solver-compatible transition behavior.
