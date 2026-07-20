# GND Re-import and Conflict Findings

Status: Bounded Research recommendations; not a synchronization design.

## Recognition hierarchy

1. **Same delivery:** identical content SHA-256. Safe to recognize as the same source document regardless of filename.
2. **Likely new delivery/version of the same source scope:** different hash, corroborating route/direction context, overlapping chain endpoint/source keys, compatible LSYS/HSYS, and a high overlap of normalized constructive element signatures. Row dates/program/order and filename help but are not decisive.
3. **Likely same Alignment represented differently:** compatible route/direction and geometric overlap/continuity, but different PADs or element segmentation. This requires a proposal, never an automatic identity merge.
4. **Different Alignment:** incompatible route/track role, disjoint topology/geometry, incompatible reference context, or explicit contradictory identity evidence.

No single observed identifier is stable enough alone: filename changes; PAD can be exporter/database scoped; row index changes; route `0` is weak; generated importer IDs are positional; element segmentation can change.

## Element continuity

Continuity is supported by directed `PAD2 == next.PAD1`, source order, compatible record family/system/context, coordinate closure within tolerance, station/length continuity, direction/tangent continuity, radius continuity appropriate to type, and consistent route/direction claims. It is disproved or weakened by branch degree greater than one, self-loop, reversed edge, missing endpoint, contradictory duplicate coordinates, system change, unexplained station discontinuity, or incompatible element parameters.

Graph connectivity alone is insufficient: the format reference says record order is geometric, and a branch can share PADs without belonging to the same Alignment.

## Update and conflict rules

- Source evidence is immutable per delivery. A later delivery adds assertions; it does not rewrite earlier rows.
- An exact repeat may reuse the prior import result after parser/schema compatibility checks.
- Display/provenance properties may refresh automatically only within the same source assertion identity and when no user-authored value is displaced.
- Geometry, profile, cant, external station mapping, source-system equivalence, or canonical identity changes require a proposal or explicit user decision.
- Conflicting coordinates or metadata remain parallel source-specific claims with diagnostics. Do not average, take “latest”, or select first row silently.
- Equivalent duplicate observations can normalize to one value while retaining every source reference.
- A changed row date or producer alone is a new record assertion, not proof of a new Alignment version.
- A type/parameter change with stable endpoints is strong evidence of a revised element; a changed segmentation needs geometric equivalence testing before continuity is claimed.

## Stable matching material

Use a composite source signature, versioned with its normalization rule:

`container schema + source family + normalized route/direction + LSYS/HSYS context + directed endpoint keys + type + declared parameters + source ordinal neighborhood`

Also compute a representation-independent candidate signature from quantized coordinates and constructive geometry for proposal ranking. Never make the quantized signature the sole canonical identity.

## Decisions intentionally left open

- `GND-U01`: exact decoding of packed/compound `STATION`, `EKAKM`, and `EKEKM` values across exporters.
- `GND-U02`: tolerance policy by declared point accuracy and engineering purpose.
- `GND-U03`: whether EK kilometre-reference lines fit an existing approved SPOT object/relation or require a future Kernel candidate.
- `GND-U04`: privacy and retention policy for operator/editor and free-text provenance.
