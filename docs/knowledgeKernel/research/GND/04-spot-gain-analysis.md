# SPOT Gain from GND

Status: Research candidates; non-canonical. This classifies value beyond an editable Alignment and does not propose one SPOT object per source field.

| Potential gain | Classification | User value / evidence | Persistence and identity | Re-import / conflict | Preserved now? |
|---|---|---|---|---|---|
| source delivery document | source/provenance evidence | audit, reproduce, compare; filename + hash + sheet inventory **O/I** | persist fingerprint, filename, size, parser/schema version; document-scoped identity | same bytes = same delivery; different bytes are a new delivery, not automatically a new Alignment | filename/sheets only |
| delivery/version identity | source/provenance evidence | distinguish revision and exporter state; row dates/programs/orders **O** | persist source fields and delivery timestamp separately | never overwrite prior source evidence; link supersession only with corroboration | no |
| source Alignment identity evidence | property of Alignment SPOT object | route/direction, source chain endpoints and constructive signature aid recognition **E/I** | persist as source-scoped aliases/signatures, not canonical ID | matching is weighted; conflicts require proposal | partial name only |
| route/track identifiers | property of Alignment SPOT object | recognizable network context **E** | preserve raw + normalized token + role-strength | update only the same source assertion; incompatible claim coexists as conflict | partial |
| PAD and element source keys/ordinal | source/provenance evidence | stable trace back and element continuity checks **E** | persist source document + sheet + row/cell + raw endpoint keys | row number alone is not stable; match on endpoint/type/parameters with ordinal as evidence | partial refs in intermediate output |
| constructive EL geometry | direct SPOT object or Alignment property | editable line/curve/transition sequence **E** | canonical geometry identity remains Kernel-governed; source signature persists | geometry change is a proposal unless exact source assertion refresh | yes, with gaps |
| EH vertical alignment | direct SPOT object / relation to Alignment | engineering profile, not just drawing **E** | separate identity and relation to source domain | conflicting profile versions coexist until resolved | lossy partial |
| EU cant | direct SPOT object / relation to Alignment | operational/design knowledge **E** | separate identity; retain form and units | never overwrite with placeholder; conflicts explicit | incorrect placeholder |
| EK kilometre reference line | direct SPOT object or relation, subject to Kernel fit | separates reference line from track geometry **E/A** | needs identity distinct from track Alignment | source-specific; relation can be proposed from route/context | sometimes conflated as Alignment |
| external stationing and jumps | relation/property plus source evidence | preserves real route referencing and discontinuities **E** | persist raw incoming/outgoing values, event locator, decoding rule | update same source claim only; incompatible mapping unresolved | no usable event |
| PL/PH coordinate observations | observation | compare deliveries, survey quality, reconstruct source intent **E/O** | observation identity = delivery + row/cell; retain raw system and value | immutable source evidence; newer observation does not erase older | only selected values |
| CRS/LSYS/HSYS evidence | representation metadata + unresolved claim when needed | map placement and usability classification **E** | source identifier, decoded class, resolver/version, transform provenance | conflicting identifiers remain source-specific; no implicit equivalence | partial horizontal; vertical weak |
| calculation vs graphical usability | representation metadata / quality indicator | prevents overclaiming precision and transformations **E** | persist assessment, purpose, rule version and warnings | recomputable assessment; source identifier immutable | partial CRS status |
| record quality (`status`, errors) | observation / quality indicator | judge fitness and compare candidates **E/O** | normalized value plus raw fields and derivation formula | never promotes automatically to object truth | no |
| source edit metadata and comments | source/provenance evidence | audit, troubleshooting and domain clues **O** | persist compactly with privacy/access policy | immutable per delivery; conflicting text is not merged | no |
| conflicts and rejected records | import warning or unresolved claim | makes loss and uncertainty visible **I** | persist at least with import session/source delivery; promote only by decision | resolved status may update; original evidence retained | diagnostics only, incompletely |
| relation among EL/EH/EU/EK chains | relation between SPOT objects | makes attachments and shared station/reference context explicit **E/A** | relation identity includes source and endpoint objects | inferred relation is proposed; exact source topology may be declared | partial heuristic |
| workbook formatting, empty reserve fields, editor layout | not worth retaining | little engineering value | no persistence beyond optional diagnostic fingerprint | n/a | no |
| nonzero unknown reserve/extra tables | inconclusive / warning | may carry exporter-specific meaning **U** | retain raw evidence until decoded | no automatic update | no |

## Minimum source trace

Every retained claim should be able to answer: delivery fingerprint, workbook sheet/table, source row, source field/cell where material, raw source keys, parser/schema version, normalized value, value origin (`declared`, `observed`, `derived`, `assumed`), and diagnostics. Cell coordinates are locators within a delivery, not globally stable identifiers.

## Admission boundary

Direct admission is defensible only for decoded constructive records with unique context and passed validation. Alternative coordinates, row metadata, weak identifiers, inferred attachments, contradictions, unknown type codes, and graphical-only CRS claims remain evidence or proposals. This avoids expanding SPOT merely because the workbook has many columns.
