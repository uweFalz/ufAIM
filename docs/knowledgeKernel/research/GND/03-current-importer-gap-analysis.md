# Current GND Importer Gap Analysis

Status: Research finding; non-canonical. Inspected implementation at `1ea2b3c`.

## What the importer preserves well

- Resolves tables by header names rather than physical column positions, so leading blank columns are tolerated.
- Joins point and element records through `PAD`, partitions PP by route/direction and PL/PH by reference-system identifier, and keeps selected row references.
- Splits sequences when required LSYS/HSYS or candidate contexts cannot be intersected.
- Preserves signed radius values, element type codes, source edge order, source filename, sheet inventory, sequence diagnostics, and selected CRS evidence in the intermediate LandFAT result.
- Rejects sequences without unique endpoint station claims or required placement context instead of constructing every row unconditionally.

## Material gaps

| Priority | Observed behavior | Consequence | Evidence classification | Correction |
|---|---|---|---|---|
| P0 | EU source values are replaced with two `appliedCant: 0 m` placeholders and described as declared attachments. | Fabricated zero cant can be mistaken for source engineering knowledge. | direct code observation **I** | Stop creating cant until decoded, or emit actual source observations with unresolved constructive status. |
| P0 | PP `STATION` is emitted as metric `staStart`; EK `EKAKM/EKEKM` and type-6 jumps are not emitted (`staEquations: null`). | External kilometre reference is conflated with internal alignment curve-length stationing; jumps disappear. | format evidence + code **E/I** | Separate raw external station claims, internal derived `s`, and EK stationing events. |
| P0 | EH sequences become only start/end PVIs; `EHTYP`, lengths, intermediate endpoints, and gradients are ignored. | Profile shape and provenance are lost; the result can be geometrically wrong while appearing complete. | direct code **I** | Decode every EH edge or keep the profile unresolved; do not label a lossy endpoint chord as the declared profile. |
| P0 | Missing `ELARIWI/EKARIWI` falls back to `atan2` radians, while GND semantic metadata labels the number as gon. | Direction is wrong by unit factor and may silently corrupt geometry semantics. | direct code **I** | Convert radians to gon and mark derived, or reject constructive interpretation when direction is required. |
| P1 | The first finite PL/PH record matching a context wins; contradictory duplicates are not compared. | Row order decides coordinates/elevation. | direct code **I** | Group observations; collapse only equal-within-tolerance values; report conflicts with every cell ref. |
| P1 | Unknown EL/EK type defaults to generic Spiral; equal transition radii are coerced to Curve. | Unsupported semantics are converted into plausible but unproven geometry. | direct code **I** | Unknown or contradictory types remain unresolved source elements; coercion requires an explicit rule and diagnostic. |
| P1 | `ELPAR1/EKPAR1` falls back to endpoint station difference without marking derivation; no consistency tests compare declared length, station delta, chord, direction, or radii. | Constructive and observed geometry are conflated; contradictions remain silent. | direct code **I** | Track value origin and run element-level closure/continuity checks. |
| P1 | Source identity is filename plus generated sequence index; generated IDs depend on sorting/partitioning. | Re-import matching and row-to-object traceability are unstable. | direct code **I** | Add document fingerprint, table/row locators, raw keys, source ordinal, and a deterministic source-object signature. |
| P1 | Row provenance/quality fields (`*DATUM`, `*PROG`, `*AUFTR`, status, accuracy, comments) are discarded. | Delivery age, producer, uncertainty, and audit trail are lost. | corpus + code **O/I** | Preserve compact source-record evidence; admit only user-relevant normalized projections. |
| P1 | Workbook reader accepts only exact sheet and field names; reference/workbook alias divergence is not normalized systematically. | Useful deliveries can produce empty tables with no targeted diagnosis. | reference + code **E/I** | Detect schema by normalized header signatures; report missing/aliased columns and variant classification. |
| P2 | Document metadata declares `angularUnit: radian`, while GND element angles are stored as gon. | Container metadata contradicts element metadata. | direct code **I** | Make document and element units consistent or omit unsafe document-wide angular claim. |
| P2 | XLSX-only support rejects companion/original MDB and standalone ASCII tables. | Useful source data requires an external export step. | tests/corpus **O/I** | Keep as explicit non-goal initially; surface a precise unsupported-container message and provenance slot for converted-from identity. |
| P2 | Greedy sequence merging uses row order and endpoint equality without explicit branch/loop diagnostics. | Branches, reversed edges, repeated endpoints, or non-geometric order may split or merge unpredictably. | code + documented ordering **E/I** | Validate declared order first; graph-check degree, reversal, loops, gaps, and competing chains. |

## Silent inference and conflation inventory

- **Silent inference:** missing element length from station delta; missing direction from endpoint coordinates; curve coercion from equal spiral radii; attachment matching from route/direction/LSYS and rounded endpoints.
- **Conflation:** PP external station with internal `s`; EL track geometry with EK kilometre-reference geometry; declared source coordinate with calculation-capable georeference; source attachment existence with decoded/correct attachment.
- **Unnecessary rejection:** an affected constructed Alignment is rejected when unique PP station is absent even if constructive EL length and coordinates could still yield geometry; the raw source element and coordinate observations are not returned as useful unresolved evidence.
- **Unsafe acceptance:** weak route `0`, unsupported/local LSYS, contradictory duplicate observations, and placeholder cant can remain inside apparently valid import output without a user-facing conflict object.

## Information currently lost

Point role and monumentation; stability/status; coordinate/elevation accuracy; foreign identifiers; all record edit dates, authors, orders, producer programs and comments; reserve parameters; full EH and EU parameters and types; EK kilometre events as usable stationing evidence; unused alternative point observations; rejected record payloads; workbook fingerprint/properties; exact cell coordinates; source ordinal; unsupported extra sheets; and the distinction between declared, observed, derived, and assumed values.
