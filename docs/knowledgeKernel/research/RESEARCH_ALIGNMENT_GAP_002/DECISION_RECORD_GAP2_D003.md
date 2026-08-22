# RESEARCH DECISION RECORD — GAP2-D003

## Status

`corrected — binding professional input for later Alignment Aggregate and Cant Core work`

Decision owner: Uwe Falz

Recorded: 2026-07-26

Scope: Research-level professional and mathematical input.

Governance boundary: this record is **not** Knowledge Kernel approval and does
not modify an active Kernel concept.

Supersession:
[GAP2-D003 Supersession Notice](SUPERSESSION_GAP2_D003.md)

## Decision

### 1. ufAIM/AIM-Core working reference

The working reference trajectory is the midpoint between the two governing
rail-edge trajectories:

```text
M(σ) = 0.5 (PL(σ) + PR(σ))
```

where `PL` and `PR` identify the complete positions of the left and right
governing rail edges under the declared directed-Alignment convention.

Equivalently, with the paired half-separation vector:

```text
Q(σ)  = 0.5 (PR(σ) - PL(σ))
PL(σ) = M(σ) - Q(σ)
PR(σ) = M(σ) + Q(σ)
```

This is ufAIM’s constructive working representation. It is deliberately
independent of whether a source or rule describes height along the lower rail.

The governing rail edges and their separation must identify the actual
professional reference. They must not be silently replaced by nominal track
gauge, rail-centre distance, wheel-contact distance, or another width measure.

### 2. Authoritative cant construction

Cant shall be represented by the paired position of both rails relative to the
midpoint working trajectory:

```text
C(σ) = (cL(σ), cR(σ))
```

Each component requires:

- the referenced rail and governing edge/contact definition;
- lateral coordinate relative to `M`;
- vertical coordinate relative to the declared vertical datum;
- direction and left/right convention;
- domain, units, constructive family, and provenance.

A scalar cant difference

```text
D(σ) = cR,z(σ) - cL,z(σ)
```

or a cant angle derived using a qualified rail-edge distance is a
derived/partial representation. It cannot replace the paired authoritative
construction because common vertical translation of both rails leaves `D`
unchanged.

### 3. Source and rule reference

The trajectory on the lower, typically curve-inner rail is a widespread source
and rule convention, including DB practice as identified by Uwe Falz:

```text
sourceReferenceTrajectory = lowerRail
```

This is **not** the ufAIM/AIM-Core working reference.

The adapter preserves this source convention and transforms it to the midpoint
working trajectory. For a simple vertical-difference representation:

```text
zM = 0.5 (zL + zR)
zL = zM - 0.5 D
zR = zM + 0.5 D
```

with signs, left/right roles, direction, and `D` definition supplied by the
source convention. General spatial rail-edge positions use `M` and `Q`, not
this simplified height-only formula.

At a straight, curvature zero, or curvature reversal point, the adapter shall
not guess which rail a source meant by “inner”. Missing role information
produces `Unknown` or `Ambiguous`.

### 4. Sole currently known professional exception

The only exception currently identified by Uwe Falz is:

```text
Undertiefung bei Bogenweichen
```

and only as an explicitly justified exception case.

An undertiefung record requires:

```text
exceptionType = undertiefungBogenweiche
status
switchIdOrContext
curveContext
referenceSide
amount
unit
validityDomain
alignmentDirection
provenance
justification
```

It shall never be inferred from a negative cant sign, curvature, rail-height
ordering, switch geometry, or a branch identifier. Missing required fields
produce `Unknown`; contradictory candidate interpretations produce
`Ambiguous`.

### 5. Source-specific references are preserved

A historical, regulatory, imported, or project-specific source may use:

- outer rail as height reference;
- inner rail as height reference;
- track-axis or midpoint height;
- a rail-centre, rail-edge, running-edge, contact-point, or other width
  definition;
- a direction or sign convention different from the native convention.

Such a source reference shall be preserved as identified evidence. It does not
change the Core working reference. If the source convention is complete, an
adapter may transform it to the midpoint representation; otherwise it remains
`Unknown`, `Ambiguous`, or `requiresProfessionalReview`.

Any conversion must be an explicit, provenance-bearing transformation with:

```text
sourceConvention
targetConvention = midpointGoverningRailEdges
transformationId
assumptions
inputProvenance
outputProvenance
residualOrUncertainty
```

If required information is absent or contradictory, conversion is rejected or
returns `Unknown`/`Ambiguous`; it does not guess.

The inverse adapter must restore the original source convention and values
within their declared precision and semantics.

## Required convention record

Every authoritative or imported cant law shall identify:

```text
alignmentDirection
leftRightConvention
curveInsideOutsideStatus
governingRailReferenceKind
governingRailDistance
distanceMeasurementDefinition
verticalDatum
workingReference = midpointGoverningRailEdges
sourceReference
sourceReferenceStatus
engineeringException = none | undertiefungBogenweiche
positiveCantConvention
positiveVerticalDirection
units
validityDomain
provenance
```

`curveInsideOutsideStatus` is derived only where the horizontal curvature and
the applicable curve-role convention make it determinate. It is never a
replacement for persistent left/right rail identity.

## Special-case classification

The following conditions require an explicit classification result.

### Straight or curvature zero

When:

```text
κh(σ) = 0
```

there is no geometrically defined curve-inside or curve-outside rail.

Allowed result:

```text
curveInsideOutsideStatus = notDefinedAtZeroCurvature
```

Left/right rail identity remains available.

### Curvature zero crossing or reversal

At a curvature sign change, inside/outside roles may exchange. The exact zero
point has no inside rail. A domain-spanning label such as “inner rail” may not
cross the zero point without segmentation and explicit role reassignment.

### Negative cant

A negative sign does not prove undertiefung. It triggers a classification
request against the explicit exception record or remains
`sourceReferenceUnresolved`.

### Equal rail heights

For:

```text
cL,z(σ) = cR,z(σ)
```

neither rail is lower or higher. An implementation may report:

```text
heightOrder = equal
```

It shall not arbitrarily select a lower rail.

### Reported changing height anchor

If the source changes its reference along the Alignment, the evidence and
adapter mapping must be segmented. Each segment records the source reference,
mapping, and boundary continuity. The Core working reference remains the
midpoint trajectory throughout its valid domain.

### Multiple tracks and special construction

Parallel tracks, shared/slab structures, switches, crossings, gauge-changing
track, three-rail arrangements, or other special constructions require an
explicit pair selection and rail-reference definition. “The two rails” may not
be inferred solely from spatial proximity. The midpoint is formed only after
the governing pair is identified. If the pair or source convention cannot be
established, the result remains review-required.

### Incomplete or contradictory evidence

Examples:

- cant scalar without side convention;
- stated inner rail at zero curvature;
- width value without measurement definition;
- paired heights with unknown vertical datum;
- source direction contradicting topology orientation;
- two sources naming different height anchors.

Required result:

```text
Unknown(reason, evidence)
```

or:

```text
Ambiguous(candidates, reason, evidence)
```

The condition is surfaced for professional clarification.

## Direction reversal

Reversing Alignment direction swaps left/right roles. Curvature-relative
inside/outside must be recomputed from the transformed curvature and domain.

A reversal operation shall transform:

- domain coordinate;
- rail identities under the new direction;
- paired rail law ordering;
- cant sign under the selected sign convention;
- segment order and derivatives;
- topology ports;
- all role/provenance annotations.

Applying the reversal twice must be behaviorally equivalent to the original
state.

## Consequences for GAP-002 contracts

`GAP2-D003` is closed for these questions:

- authoritative cant is paired, not scalar;
- the ufAIM/AIM-Core working trajectory is the midpoint between governing rail
  edges;
- lower/inner-rail trajectories are source/rule references, not Core anchors;
- source-specific conventions remain explicit;
- incomplete or contradictory cases remain `Unknown`/`Ambiguous`;
- the only currently recognized exception is explicitly justified undertiefung
  at a Bogenweiche in the source/engineering model;
- adapters preserve and reversibly transform the original reference.

Still open outside this decision:

- the exact data type and naming of governing rail edges;
- rule/practice research for any further exception;
- organization-specific transformations after an exception is professionally
  established;
- switch/crossing and multi-rail topology contracts;
- identity composition and Governance approval;
- permitted native cant families and continuity requirements.

## Binding handover rule

Later Alignment Aggregate and Cant Core Research/implementation packages shall
use this record as binding professional input unless Uwe/Rock explicitly revise
the decision.

They shall not cite the record as canonical Kernel approval.
