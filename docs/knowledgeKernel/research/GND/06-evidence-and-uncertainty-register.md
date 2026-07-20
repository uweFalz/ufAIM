# Evidence and Uncertainty Register

Status: Research register; non-canonical.

| ID | Claim | Evidence | Class | Confidence / disposition |
|---|---|---|---|---|
| GND-E01 | Seven point/element record families and their fields/types are defined in the bundled VermEsn reference. | `src/import/parsers/technet/manual2000/VERM_ESN_2000-11-03.pdf.json`; `sharedTechnet.js` | E | high; explicit reference, not a complete modern GND XLSX specification |
| GND-E02 | `Y` is easting/right value, `X` northing/high value, metres. | same reference and current CRS resolver | E | high |
| GND-E03 | Element families are delivered in geometric order; family ordering is also documented. | bundled reference, “Reihenfolge der Satzarten” | E | high for source reference; exporter deviations still possible |
| GND-E04 | EL/EK types 0–8 have the documented meanings; EK type 6 is a kilometre jump. | bundled reference and shared semantic map | E | high |
| GND-E05 | EU parameters 2/3 are cant endpoints in metres; EH parameters 2/3 are gradients in per mille. | bundled reference | E | high |
| GND-E06 | Point and element provenance/status/accuracy fields have defined meanings and appear populated. | bundled reference + inspected workbook | E/O | high |
| GND-O01 | Real XLSX sheets use stable `X_ASC..` names and may place headers after blank leading columns. | local current/legacy workbook inspection | O | high in corpus, not universal |
| GND-O02 | Multiple systems, programs, dates, route/direction contexts and point records coexist within a workbook. | local workbook inspection | O | high |
| GND-O03 | Current and legacy holdings contain XLSX revisions/re-exports and MDB companions with different hashes. | path/hash inventory | O | high; semantic equivalence untested |
| GND-I01 | Current reader ignores all unknown/extra sheets and requires exact relevant sheet names. | `readGndXlsxTables.js` | I | high |
| GND-I02 | Duplicate coordinate/elevation selection is first-match and contradiction-blind. | `resolvePadCoordFromPadNode`, `resolveElevationFromPadNode` | I | high |
| GND-I03 | External PP station is mapped to metre `staStart`; EK jumps are not emitted. | `convertSequenceToTraLikeRecords`; `staEquations: null` | I | high |
| GND-I04 | EH interiors/gradients are lost and EU values are replaced by zero placeholders. | `buildProfileFromSequence`; `buildCantFromSequence` | I | high |
| GND-I05 | Direction fallback produces radians under gon semantics. | `Math.atan2` fallback + GND semantic map | I | high |
| GND-A01 | Duplicate numeric observations equal within a purpose-specific tolerance may normalize to one claim. | engineering recommendation | A | reasonable; tolerance decision required |
| GND-A02 | Route/direction + topology + geometry can rank re-import identity candidates. | engineering recommendation | A | medium; requires regression corpus |
| GND-U01 | The exact numeric encoding and unit boundary of all observed `STATION`/`EKAKM`/`EKEKM` variants. | mixed corpus magnitudes; reference calls values “km” | U | unresolved; do not map blindly to internal metres |
| GND-U02 | Signed-radius orientation convention for every exporter and special type, including type 5’s `+200 gon` convention. | reference plus shared map | U | partially explicit; synthetic sign/orientation fixtures required |
| GND-U03 | EH profile domain (`internal s` vs external km) in each delivery. | architecture note identifies both possibilities | U | unresolved per source/delivery |
| GND-U04 | Meaning of nonzero reserve parameters or exporter-specific extra sheets/columns. | reserved fields/extra content | U | retain and warn; no semantic admission |
| GND-U05 | Whether PAD survives database revision/export stably enough for cross-delivery matching. | no explicit stability guarantee found | U | treat as source-scoped evidence only |
| GND-U06 | Full modern version/exporter deviation matrix. | corpus has mixed program fields but no authoritative XLSX version spec | U | expand with provenance-cleared deliveries |
| GND-U07 | Graphical vs calculation fitness for every LSYS/HSYS variant. | resolver covers selected horizontal cases; vertical unresolved | U | use explicit usability classification, not boolean CRS-present |

## Counterexamples and tests

- Synthetic importer tests show multiple LSYS contexts should yield distinct items rather than merge; this supports system-scoped sequences.
- Synthetic missing endpoint records produce rejected seeds/no items; this confirms current all-or-nothing construction for affected records.
- A real workbook contains large compound-looking and small numeric station values in the same PP field, countering a universal “STATION is internal metres” interpretation.
- Type-6 EK records exist in the real corpus, countering an Alignment-only interpretation of GND.
- Multiple PL records per PAD/system context and current first-match selection counter the assumption that one PAD implies one coordinate.

## Research limitations

- Workbooks were inspected structurally and statistically; sensitive row content was not copied into Research.
- The legacy MDB files were identified but not decoded; current App behavior classifies MDB as unsupported.
- The bundled 2000 VermEsn reference is strong field evidence, not proof that every modern GND exporter follows it exactly.
- No external/private dataset or vendor specification was used.
