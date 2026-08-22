# Domain, Reference, State, and Continuity Gates

Status: Research contract for an adapter implementation; non-canonical.

## Domain gate

Each decoded source segment owns only:

```text
sourceDomain = {
  parameter: localDirectedDistance,
  interval: [0,L],
  unit: m,
  endpoints: [PAD1,PAD2],
  provenance
}
```

Attachment to an Alignment requires a separate relation:

```text
domainRelation = {
  sourceDomainId,
  targetAlignmentId,
  targetIntrinsicInterval,
  orientation,
  mapping,
  evidence,
  decisionProvenance,
  revision
}
```

The relation must be explicit and reversible. Filename, drop order, equal
lengths, shared route labels, and endpoint proximity may nominate candidates;
they do not confirm one. External kilometre addresses remain a separate
mapping and never replace intrinsic distance.

This closes the implementation question without deciding the still open
format question “Does this delivery define EH/EU on track distance or kilometre
line?”: the adapter accepts either only through an explicit relation.

## Continuity gate

For adjacent EH source segments `a,b`:

```text
C0-height:   z0,a + DeltaZa(La) ≈ z0,b
C1-gradient: ga(La) ≈ gb(0)
family:      preserved independently of continuity
```

The `C0-height` test is valid only when `z0,a` and `z0,b` are qualified height
anchors in the same `EHSYS`, with compatible vertical-reference provenance.
`DeltaZa(La)` is a relative height change and is never compared directly with
the absolute anchor `z0,b`. If either anchor or the common qualified `EHSYS` is
missing, contradictory, or unresolved, the result is
`C0-height=not-checkable`; it is not a continuity pass or failure. In that
case only `C1-gradient` can be tested from the EH parameters. A checked height
or gradient mismatch is not repaired silently.

For adjacent EU scalar source segments:

```text
C0D: Da(La) ≈ Db(0)
C1D: only testable after each type's interpolation law is established
```

Scalar `C0D` does not prove continuity of both rail trajectories. Paired-rail
continuity remains unknown until reference transformation is possible.

Tolerances are inputs to validation with purpose and provenance. This Research
does not prescribe universal numeric tolerances.

## Explicit zero versus unknown

The parser must test presence before numeric conversion.

```text
cell contains numeric 0 or explicit numeric text "0"
  -> Known(0, source-cell provenance)

cell blank/whitespace/null/unparseable
  -> Unknown(missing-or-invalid-source-value)
```

Consequences:

- `EHPAR2=0` is a known level gradient, not missing.
- `EUPAR2=EUPAR3=0` under `EUTYP=0` is known scalar zero cant.
- absent EU rows are `OutsideCoverage` or `Unknown`, according to declared
  source scope; never zero.
- a missing endpoint may not be filled from the other endpoint merely because
  the type name says constant.

## GAP2-D003 reference gate

The target working reference is:

```text
M = 0.5*(PL+PR)
```

GND EU supplies a scalar named `Überhöhung`, but the inspected reference does
not establish all of:

```text
alignmentDirection
leftRightConvention
positiveCantConvention
governingRailReferenceKind
sourceReference
verticalDatum
```

Therefore a source scalar is preserved as source-scoped partial evidence. If a
future GND-specific convention record supplies the missing information, the
adapter may construct paired rail positions and records:

```text
sourceConvention
targetConvention = midpointGoverningRailEdges
transformationId
assumptions
input/output provenance
residualOrUncertainty
```

At zero curvature, reversal, contradictory direction, missing governing pair,
or switch/scissor context, the result remains `Unknown`, `Ambiguous`, or
`requiresProfessionalReview`. Negative cant never implies undertiefung.

## Precise remaining professional decisions

### `GND-EH-DOMAIN-001`

No universal format decision is needed for safe implementation because the
explicit domain relation can carry delivery-specific evidence. A professional
decision is needed only if the product intends to auto-confirm a relation.
The current Research recommends **no auto-confirmation**.

### `GND-EU-REFERENCE-001`

Question for Uwe/source authority:

> In the relevant DB GND exporters, what exact signed quantity do `EUPAR2/3`
> represent: which governing rail edges, which positive direction and
> left/right ordering, and which source height anchor are assumed?

Known inputs: values are metres; type and directed PAD endpoints are retained;
the Core target is the GAP2-D003 midpoint. Missing inputs are the convention
fields listed above.

Options and consequences:

1. retain scalar source-cant only — immediately truthful, no 3D paired rails;
2. apply a documented exporter/version convention — permits reversible paired
   construction only for matching provenance;
3. apply one project-wide convention — simplest, but unsafe unless Uwe confirms
   it is valid across the admitted corpus.

Recommended current disposition: option 1. No implementation may choose 2 or
3 without the exact convention decision and applicability evidence.
