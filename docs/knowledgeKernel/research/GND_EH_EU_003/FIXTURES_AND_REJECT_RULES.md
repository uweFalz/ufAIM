# Minimal Fixtures and Reject Rules

Status: implementation handover; non-canonical.

Fixtures are synthetic and contain no private corpus content. Every fixture
retains sheet, row, cells, raw values, parsed values, type, endpoints, source
ordinal, and parser/version provenance.

## EH fixtures

### `EH0-LEVEL-EXPLICIT-ZERO`

```text
PAD1=A, PAD2=B, EHSYS=H1, EHTYP=0
EHPAR1=100, EHPAR2=0, EHPAR3="0", EHPAR4=0
```

Expected: source-local constant-gradient segment; `Delta z(100)=0`; both zeros
remain explicit source values; no target Alignment attachment without a domain
relation.

### `EH0-CONTRADICTORY-GRADIENTS`

Same as above with `EHPAR3=1` per mille.

Expected: `construction-withheld`, code `constant-gradient-endpoints-disagree`.

### `EH1-PARABOLA`

```text
L=100 m, g0=-10 per mille, g1=10 per mille
```

Expected local witnesses:

```text
q=0.0002 1/m
g(0)=-0.01; g(50)=0; g(100)=0.01
Delta z(0)=0; Delta z(50)=-0.25 m; Delta z(100)=0
```

Family must remain parabolic; a circular vertical arc is not equivalent.

### `EH2-SWITCH-BRANCH`

Expected: full evidence retention, `unsupported-special-profile-type`, no
constructive profile.

## EU fixtures

### `EU0-CONSTANT-ZERO`

```text
PAD1=A, PAD2=B, EUTYP=0
EUPAR1=100, EUPAR2=0, EUPAR3="0", EUPAR4=0
```

Expected: known scalar source-cant `D=0`; paired rail law unknown; not a
missing-cant state.

### `EU0-CONSTANT-NONZERO`

```text
L=80, D0=0.120, D1=0.120
```

Expected: known constant scalar source law. No automatic assignment such as
`cL=0,cR=0.120` or `cL=-0.060,cR=0.060`.

### `EU0-CONTRADICTORY-ENDPOINTS`

```text
L=80, D0=0, D1=0.120
```

Expected: `construction-withheld`, code `constant-cant-endpoints-disagree`.

### `EU2/EU3/EU4-NAMED-RAMP`

For each type use `L=100, D0=0, D1=0.150`.

Expected: endpoints and type visible; no sampled interior values; disposition
`decision-required-formula`. A renderer may connect witnesses only if clearly
labelled representation, never calculated source truth.

### `EU7/EU8-TRACK-SCISSOR`

Expected: `evidence-only-special-context`; no relation inferred from filename,
spatial proximity, or record order; require explicit switch/scissor identity
and branch/reference context.

## Cross-segment fixtures

1. EH adjacent boundary with qualified anchors `z0,a=100 m` and `z0,b=101 m`
   in the same `EHSYS`, where `DeltaZa(La)=1 m`: `C0-height=pass`. Change
   `z0,b` to `101.2 m`: `C0-height=fail` with
   `height-continuity-mismatch`. Matching and mismatching gradients test C1
   independently.
2. The same EH boundary with either height anchor absent, or with anchors in
   different/unresolved `EHSYS`: `C0-height=not-checkable`; no C0 reject code
   is emitted, while C1-gradient remains independently testable.
3. EU scalar `C0D` match/mismatch while paired-rail continuity remains unknown.
4. Reversed target relation: explicit orientation transform required; no
   field-by-field sign guess.
5. Same numeric length but no relation: source segment remains unattached.
6. One source segment with two candidate target intervals: `Ambiguous`, no
   first-match selection.
7. Non-zero `PAR4`: retain raw value and withhold construction for every type.
8. Missing, whitespace, malformed, and explicit zero separately for every
   numeric field.
9. Type 999: evidence retained, unsupported outcome, no generic fallback.

## Common reject codes

```text
missing-or-invalid-length
non-positive-length
missing-or-invalid-end-value
nonzero-unknown-reserve
unsupported-type
constant-gradient-endpoints-disagree
constant-cant-endpoints-disagree
domain-relation-missing
domain-relation-ambiguous
formula-decision-required
gnd-cant-reference-convention-missing
switch-context-missing
continuity-mismatch
height-continuity-mismatch
```

Every rejected constructive interpretation must retain the source claim and
terminate visibly. Rejection of construction is not rejection of evidence.
