# GND Import Interpretation Matrix

Status: Research model; non-canonical. “Current” describes the importer at baseline `1ea2b3c`.

## Structures and point records

| Source | Names / type / unit | Meaning and cardinality | Validation and fallback | Current handling | Recommended handling | Confidence / provenance |
|---|---|---|---|---|---|---|
| workbook | `.xlsx`; seven exact sheet names | one delivery container; 0..n extra sheets | require readable package; recognize relevant tables by normalized headers; warn on extras | exact names; extras only listed | record SHA-256, size, filename, sheet inventory, import time, parser/schema version; classify variant | high E/O/I |
| PP | `PAD` text | source point address; 1..n records across semantic contexts | required on used element endpoints; preserve whitespace-significant raw token plus normalized token | trimmed and used as join key | retain source key and cell ref; detect normalized collisions | high E/I |
| PP | `PART`, `VERMART`, `STABIL` categorical | point role, monumentation, stability/quality | domain-check; unknown codes retained as claims | discarded | retain as source observation/quality evidence, not Alignment truth | high E/O/I |
| PP | `STATION` number/text; external km encoding, unit/encoding context-dependent | station/km claim for `(PAD, route, direction)`; 0..n | do not assume internal curve-length metres; preserve raw and parsed claim; ambiguity if >1 distinct value | coerced to number and used as Alignment station in metres | separate `sourceStationClaim` from derived internal station; decode only under validated rule | high E/I; encoding U |
| PP | `PSTRECKE` or `STRECKE`; text | route/track identifier; with direction partitions station claims | empty/`0` is weak identity, not necessarily invalid | alias handled, used in sequence identity/name | preserve raw identifier and strength; use in matching only with corroboration | high E/O/I |
| PP | `PSTRRIKZ` or `STRRIKZ`; code | route direction/track class | preserve `0`; importer currently rejects false-like missing only after string conversion | alias handled; partitions sequences | retain coded claim and documented meaning; do not treat as geometric direction | high E/I |
| PP/PL/PH | `*DATUM`, `*BEARB`, `*AUFTR`, `*PROG`, `*TEXT` | record revision/provenance; 0..1 per record | dates parsed without timezone claim; text retained verbatim in source evidence | discarded | retain source-scoped provenance; redact only at presentation/export boundary if required | high E/O/I |
| PL | `LSYS` (`LSYST` reference alias) text | horizontal system for coordinate observation | required for engineering placement; unknown/local retained but not transformed | exact `LSYS`; split/intersect; resolver handles selected DB codes | accept alias; retain raw; resolve separately; never merge conflicting systems | high E/I |
| PL | `Y`, `X` number, metres | `Y=easting`, `X=northing`; 1..n per PAD/LSYS possible | finite; plausible range; duplicate-equal collapse; duplicate-different conflict | first finite matching record wins silently | retain all observations and refs; require unique value within tolerance before construction | high E/O/I |
| PL | `LSTAT`, `LFREMD`, `MP`, `MPEXP` | status, foreign id, accuracy (`MP × 10^MPEXP` m) | retain unknown code; validate exponent and non-negative derived uncertainty | discarded | retain as observation quality and identifier evidence | high E/O/I |
| PH | `HSYS` (`HSYST` alias), `H` m | vertical system and elevation observation | finite; vertical transformation unresolved; conflicting values explicit | endpoints selected by HSYS; only selected value used | retain all observations; preserve vertical source system without equivalence claim | high E/I |
| PH | `HSTAT`, `HFREMD`, `MH`, `MHEXP` | status, foreign id, vertical accuracy | same quality treatment as PL | discarded | retain as source observation/quality evidence | high E/O/I |

## Element records

| Source | Names / type / unit | Meaning and relation | Validation and fallback | Current handling | Recommended handling | Confidence / provenance |
|---|---|---|---|---|---|---|
| EL/EH/EU/EK | `PAD1`, `PAD2` text | directed source element endpoints; ordered chain | both required; referenced point records must exist for needed domains; self-loop suspicious | rows without endpoints dropped; missing refs reject seed | preserve rejected row as unresolved claim with source ref and reason | high E/I |
| EL | `ELSYS`; text | direction-angle coordinate system; must agree with chosen PL records | mismatch is conflict; no cross-system inference | required; sequence split by exact value | retain both edge and coordinate claims; explicit mismatch diagnostic | high E/I |
| EL | `ELTYP` integer 0,1,2,3,4,5,7,8 | line, circle, transition variants, kink | known code required for constructive geometry; unknown recoverable as unsupported element claim | unknown becomes generic Spiral; type 5 emits line plus kink | reject construction for unknown code; retain claim; verify type-5 parameter convention | high E/I; type-5 detail medium |
| EL | `ELPAR1` m | element length | finite and normally non-negative; compare chord and station change; no silent fallback | falls back to station delta | distinguish declared vs derived length; warn on contradiction; fatal for constructive geometry if neither reliable | high E/I |
| EL | `ELPAR2`, `ELPAR3` m | signed start/end radius; zero denotes infinite/straight endpoint in transition conventions | preserve sign; type-specific requiredness; equal transition radii suspicious | copied as radius; equal endpoints coerced to Curve | retain raw; type-aware validation; do not coerce without an explicit supported rule | medium E/I/A |
| EL | `ELARIWI` gon | start direction, clockwise from north | finite; normalize modulo 400 only for comparison; recompute from geometry as check | copied; if missing, computes radians but labels value as gon | either keep missing with warning or convert computed radians to gon and mark derived | high E/I |
| EH | `EHTYP`; 0,1,2 | grade line, quadratic parabola, switch branch | supported-code and domain checks | type and parameters ignored | decode complete profile elements; retain unsupported claims | high E/I |
| EH | `EHPAR1` m; `EHPAR2/3` per mille | length; start/end gradient | compare length; preserve gradient sign | only chain endpoints become two PVIs; interior and parameters lost | retain constructive vertical elements and raw gradients; decide internal-vs-external domain explicitly | high E/I; domain U |
| EU | `EUTYP`; 0,2,3,4,7,8 | constant/transition cant forms | supported-code and length/endpoint checks | ignored after chaining | decode only validated forms; retain source form code | high E/I |
| EU | `EUPAR1` m; `EUPAR2/3` m | length; start/end cant | finite; compare continuity and plausible magnitude | replaces source cant with two `0 m` placeholders | never create declared zero; retain actual values or unresolved attachment | high E/I |
| EK | `EKSYS`, `EKTYP`, `EKPAR1..3`, `EKARIWI` | constructive kilometre-reference line; type 6 is km jump | validate like EL plus type-6 event semantics | non-type-6 EK may become another Alignment; type 6 excluded | represent EK separately from track geometry; decode type 6 to source stationing event candidate | high E/I |
| EK | `EKAKM`, `EKEKM`; external km encoding | incoming/outgoing kilometre claims | preserve raw; decode under validated convention; type 6 difference is material | stored in edge extras, not emitted as station equation | expose explicit stationing evidence/event with row trace | high E/I; encoding U |
| all element sheets | `*PAR4` reserve; `*DATUM/*BEARB/*AUFTR/*PROG/*TEXT` | reserved parameter and record provenance | nonzero reserve must not be silently ignored; provenance optional | discarded | retain; warn on nonzero unknown reserve | high E/I |

## Ordering, missing values, and defect policy

- The reference states element record families arrive in geometric order. Preserve source ordinal even when graph chaining succeeds. **E**
- Blank/whitespace cells are missing. Numeric zero is data and must never be treated as missing. Locale decimal comma is accepted only for an otherwise numeric token. **I**
- Duplicate-equal observations are recoverable and should retain all refs. Duplicate-contradictory observations are unresolved claims; selecting the first is unsafe. **A/I**
- Missing optional provenance is recoverable. Missing endpoint, required coordinate, required source system, or undecodable constructive type is fatal only for the affected constructed object—not for retaining the source claim. **A**
- A mismatch among declared length, endpoint geometry, direction, radii, and station change is recoverable as evidence but blocks silent admission as calculation-capable geometry above a defined tolerance. **A**
