# RESEARCH-GND-EH-EU-CONSTRUCTIVE-DECODING-003

Status: completed Research candidate; non-canonical; implementation-oriented.

## Question

Which GND height (`EH`) and cant (`EU`) element types can be decoded without
inventing a formula, longitudinal domain, rail reference, sign convention, or
engineering exception?

## Outcome

`survives with strict layering`

The bundled VERM.ESN reference establishes record families, type names,
parameters, and units. Together with the existing vertical and cant Research
contracts, this is sufficient to decode:

- `EHTYP=0` as a constant-gradient source segment, conditionally;
- `EHTYP=1` as a constant-gradient-rate parabolic source segment,
  conditionally;
- `EUTYP=0` as a constant **scalar source-cant** segment, conditionally.

“Conditionally” means that the local segment law is mathematically unique but
may be related to an Alignment only after its source segment has an explicit,
reviewable mapping to the common intrinsic domain. Scalar source cant remains
partial evidence until the GND-specific sign, side, and rail-reference
convention permits the reversible GAP2-D003 midpoint transformation.

The reference names, but does not define enough mathematics to construct,
`EHTYP=2` or `EUTYP=2/3/4/7/8`. Those records remain source evidence. Familiar
clothoid, S-form, or Bloss formulae are not a licence to choose a particular
cant interpolation without a GND rule or professionally owned decision.

## Deliverables

- [EVIDENCE.md](EVIDENCE.md)
- [DECODING_MATRIX.md](DECODING_MATRIX.md)
- [DOMAIN_REFERENCE_AND_CONTINUITY.md](DOMAIN_REFERENCE_AND_CONTINUITY.md)
- [FIXTURES_AND_REJECT_RULES.md](FIXTURES_AND_REJECT_RULES.md)
- [MISSION_REPORT.md](MISSION_REPORT.md)

## Boundaries

This package changes no active Knowledge Kernel concept, importer, App,
TransitionDB, SPOT contract, or Thesis. It authorizes no silent admission of
source evidence as canonical constructive state.
