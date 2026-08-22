# Evidence Basis

Status: Research evidence ledger; non-canonical.

## Provenance-cleared sources

| ID | Source | Supported claim | Strength |
|---|---|---|---|
| `EH-EU-E01` | `src/import/parsers/technet/manual2000/VERM_ESN_2000-11-03.pdf.json`, Satzarten 22/23 | EH/EU field identities, units, type labels, database family order | direct bundled reference |
| `EH-EU-E02` | `docs/knowledgeKernel/research/GND/01-corpus-and-variants.md` | 17-workbook read-only corpus lineage; repeated seven-sheet family; provenance and variants | consolidated observation |
| `EH-EU-E03` | `docs/knowledgeKernel/research/GND/02-import-interpretation-matrix.md` | EH/EU parameters, current loss, domain uncertainty, preservation rules | Research synthesis |
| `EH-EU-E04` | `docs/knowledgeKernel/research/GND/03-current-importer-gap-analysis.md` | endpoint-only EH is lossy; fabricated zero cant is false; full EH/EU decoding remains open | implementation observation |
| `EH-EU-E05` | `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/MATHEMATICAL_CONTRACTS.md` | intrinsic domain, vertical family preservation, scalar-versus-paired cant, explicit-zero state | mathematical Research contract |
| `EH-EU-E06` | `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/SUPERSESSION_GAP2_D003.md` and `DECISION_RECORD_GAP2_D003.md` | midpoint of governing rail edges is the working reference; source reference requires explicit reversible transformation | binding professional Research input |
| `EH-EU-E07` | `docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_002/COUNTEREXAMPLES_AND_DECISIONS.md` | equal endpoints do not identify a ramp family; scalar cant does not identify both rails; zero differs from missing | counterexamples |

The bundled spreadsheet dependency runtime was unavailable during this pass,
so no new direct workbook extraction is claimed. Corpus-dependent statements
are limited to the already consolidated, checksum-identified GND Research
record. No private cell content is reproduced here.

## Direct format facts

### EH

```text
PAD1, PAD2                     directed source endpoints
EHSYS                          source height system
EHTYP                          0 Gerade; 1 quadratische Parabel;
                               2 überhöhter Weichenabzweig
EHPAR1                         length [m]
EHPAR2, EHPAR3                 start/end gradient [per mille]
EHPAR4                         reserve, semantics unspecified
```

### EU

```text
PAD1, PAD2                     directed source endpoints
EUTYP                          0 constant cant; 2 clothoid;
                               3 S-shaped ramp; 4 Bloss ramp;
                               7 track-scissor S-form;
                               8 track-scissor Bloss
EUPAR1                         length [m]
EUPAR2, EUPAR3                 start/end cant [m]
EUPAR4                         reserve, semantics unspecified
```

## What the evidence does not establish

1. Whether EH/EU source length is already the target Alignment's intrinsic
   horizontal-plan arc length, or how it maps to external kilometre addressing.
2. A GND-specific positive cant convention, left/right ordering, governing
   rail-edge definition, or source height anchor.
3. The exact normalized interpolation formula for EU types 2, 3, 4, 7, or 8.
4. The construction law and required switch context for EH type 2.
5. The semantics of non-zero `EHPAR4` or `EUPAR4`.
6. A tolerance valid for all exporters and engineering purposes.

These are absence-of-evidence boundaries, not invitations to reuse a similarly
named formula from another format.
