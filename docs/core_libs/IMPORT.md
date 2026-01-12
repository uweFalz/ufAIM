# SevenLines and Import Pipeline

The SevenLines model describes an intermediate representation
used during data import and validation.

It exists to bridge the gap between heterogeneous real-world data sources
and the strict requirements of the sparse alignment core.

# SevenLines und Import-Pipeline

Das SevenLines-Modell beschreibt eine Zwischenrepräsentation
für Import, Sortierung und Validierung von Trassierungsdaten.

Es bildet die Brücke zwischen heterogenen Realweltdaten
und den strengen Anforderungen des Sparse-Alignment-Kerns.

## Why SevenLines?

Infrastructure alignment data rarely arrives in a clean,
self-contained form.

Different sources provide partial information:
- horizontal geometry without stationing
- gradients without a clear reference line
- cant data referring to different track assumptions

SevenLines provides a controlled workspace
to reconcile, validate, and assemble these inputs
before committing them to a deterministic alignment model.

## The SevenLines Model

SevenLines organizes imported data into a fixed structural pattern:

- a kilometer line (stationing reference)
- a right track (horizontal, vertical, cant)
- an optional left track
- optional auxiliary or derived tracks

Each line may carry horizontal geometry, vertical geometry, and cant information.
Not all information must be present at once.

## SevenLines as a Working Space

SevenLines is intentionally not a final data model.

It acts as a temporary working space where:
- imported datasets can be inspected
- inconsistencies can be identified
- assignments can be corrected manually
- engineering assumptions become explicit

Only validated and complete configurations
are converted into sparse alignment objects.

## Import Pipeline Overview

The import pipeline follows a deliberate multi-stage process:

1. File ingestion and format-specific parsing
2. Extraction of partial datasets (horizontal, vertical, cant, stationing)
3. Assignment into a SevenLines working set
4. Validation and user-guided correction
5. Conversion into sparse alignment representations

## From SevenLines to Sparse Alignment

SevenLines does not replace the sparse alignment core.

Instead, it serves as a controlled preprocessing stage.
Once a SevenLines configuration is validated,
it is converted into one or more sparse alignment instances.

This conversion step enforces strict continuity,
parametric consistency, and engineering invariants.

## Handling Special Cases

SevenLines explicitly accounts for real-world special cases, including:

- single-track alignments with outer stationing
- shared kilometer lines across multiple tracks
- switches and branching geometries
- partial or missing datasets

These cases are resolved within the SevenLines workspace,
not deferred to the alignment core.

