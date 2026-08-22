# Decision-Ready Mathematical Contracts

## 1. Notation and orientation

Let an Alignment have a directed, closed coordination domain

```text
Σ = [σ0, σ1] ⊂ ℝ
```

increasing from the Alignment start toward its end.

Recommended interpretation:

```text
σ = signed distance along the horizontal Alignment projection
```

For a regular horizontal plan curve

```text
r_h(σ) = (x(σ), y(σ))
```

the parameter is arc length:

```text
||dr_h/dσ|| = 1
```

and horizontal heading and curvature obey

```text
t_h(σ) = dr_h/dσ = (cos α(σ), sin α(σ))
κ_h(σ) = dα/dσ
```

This matches the contemporary IFC/EN framing in which vertical and cant
segments use distance along the horizontal Alignment.

All signs are relative to the directed Alignment. Reversing direction is an
explicit transformation, not a relabeling:

```text
σ' = σ0 + σ1 - σ
t'_h = -t_h
left' = right
right' = left
```

The transformation of curvature, gradient, and cant depends on the adopted
sign conventions and must be tested, not inferred field by field.

## 2. Why the common domain is a real choice

Three longitudinal quantities must remain distinct:

```text
σ   horizontal-plan arc length
ℓ   spatial centreline arc length
k   operational chainage/kilometre address
```

For vertical profile `z(σ)` and gradient `g(σ)=dz/dσ`,

```text
dℓ/dσ = sqrt(1 + g(σ)^2)
```

before any separate choice of canted reference trajectory.

Consequently:

- `σ = ℓ` only for zero gradient, or approximately under a declared
  small-gradient approximation;
- `k = σ` only under a particular continuous address mapping;
- using any one of the three as an unqualified field named `station` is
  inadmissible.

### Contract DOM-001 — Coordination domain

An Alignment aggregate shall declare:

```text
domain.id
domain.orientation
domain.parameterKind = horizontalPlanArcLength
domain.interval = [σ0, σ1]
domain.lengthUnit
domain.tolerance
```

Every horizontal, vertical, cant, address, speed, and evaluation facet shall
either:

1. use `Σ` directly;
2. provide an explicit monotone mapping to `Σ`;
3. expose a typed partial/unknown state over a stated subdomain.

No facet may silently substitute spatial length or operational address.

### Contract DOM-002 — Domain coverage

Facet coverage is a set of non-overlapping intervals with boundary ownership:

```text
coverage(F) = ⋃ Ii ⊆ Σ
```

Each point query returns one of:

```text
Known(value, convention, provenance)
Unknown(reason, provenance?)
OutsideCoverage
Ambiguous(candidates, reason)
```

`OutsideCoverage` differs from `Unknown`: the former asserts that the facet
does not claim this part of the domain; the latter asserts that the requested
part is in scope but its value is unresolved.

### Contract DOM-003 — Boundary determinism

At a shared segment boundary `σb`, a query must not depend on container order.
The contract shall define:

- half-open internal intervals and a closed final interval; or
- an equivalent canonical boundary-selection rule;
- continuity assertions independent of that selection;
- a tolerance policy for imported near-coincident boundaries.

Recommended convention:

```text
[σi, σi+1) for internal segments
[σn-1, σn] for the final segment
```

## 3. Vertical geometry

### 3.1 Common query quantities

For a vertical profile in the `(σ,z)` plane:

```text
z(σ)     height relative to a declared vertical datum/context
g(σ)     dz/dσ
θ(σ)     atan(g(σ))
ℓ(σ)     ∫ sqrt(1+g²) dσ
κv(σ)    dθ/dℓ
```

Using the chain rule:

```text
κv = (dg/dσ) / (1+g²)^(3/2)
```

These formulas show why “constant rate of gradient” and “constant spatial
vertical curvature” are not equivalent except under approximation.

### 3.2 Supported constructive families

#### Constant gradient

```text
g(σ) = g0
z(σ) = z0 + g0(σ-σ0)
κv(σ) = 0
```

#### Parabolic vertical arc

Primary law:

```text
q = dg/dσ = constant
g(σ) = g0 + qΔσ
z(σ) = z0 + g0Δσ + 0.5qΔσ²
```

Its spatial vertical curvature is:

```text
κv(σ) = q / (1+g(σ)²)^(3/2)
```

and therefore is not constant when `g` varies.

#### Circular vertical arc

Primary law:

```text
κv = dθ/dℓ = 1/Rv = constant
```

It is a circular arc in the vertical plane. Its gradient-rate with respect to
`σ` is:

```text
dg/dσ = κv(1+g²)^(3/2)
```

and therefore is not constant.

#### Higher-order/transition vertical law

Any clothoid or polynomial vertical family shall state its actual primary law,
parameter and coefficients. It must not be stored merely as “smooth curve”.

### Contract VERT-001 — Family-preserving segment

Every vertical segment shall preserve:

```text
segmentId
domainInterval
family
primaryParameters
startBoundary = {z, g or θ as required}
lengthInterpretation
continuityIntent
units
verticalReference
provenance
```

Derived `z`, `g`, `θ`, `ℓ`, and `κv` may be queried, but redundant derived
values shall not silently override primary parameters.

### Contract VERT-002 — Vertical reference

`z=0` is meaningful only with:

```text
referenceKind
datumOrLocalOrigin
axisOrRailReference
unit
positiveDirection
transformProvenance
```

Unknown vertical datum with known relative gradients is a valid partial state.
It must not be converted into an absolute-height claim.

### Contract VERT-003 — Continuity

At an internal boundary `σb`, the contract shall separately report:

```text
C0z:  z-(σb) = z+(σb)
C1z:  g-(σb) = g+(σb)
C2z:  dg-/dσ = dg+/dσ
G2z:  κv-(σb) = κv+(σb)
```

`C2z` and `G2z` are not generally equivalent. A rule or design intent must name
which continuity is required. Tolerance-bearing satisfaction is a result, not
the definition of the condition.

### Contract VERT-004 — Small-angle approximation

The approximation

```text
θ ≈ g
σ ≈ ℓ
κv ≈ dg/dσ
```

may be used only when the snapshot records:

```text
approximationId
validityBound
errorMetric
purpose
```

The approximation may not erase the originating segment family.

## 4. Cant and rail reference

### 4.1 Common quantities

Let:

```text
cL(σ)   signed left rail-head/contact-reference offset
cR(σ)   signed right rail-head/contact-reference offset
b(σ)    positive rail-head distance used for cant evaluation
D(σ)    cR(σ) - cL(σ) under the chosen right-minus-left convention
ψ(σ)    asin(D(σ)/b(σ))
```

The precise sign of `D` is a project decision; this document’s formula is only
a candidate convention. The stored convention must say:

- directed Alignment;
- left/right definition;
- positive vertical direction;
- `D` ordering;
- rail-head/contact reference;
- gauge versus rail-head-distance interpretation.

The small-angle relation

```text
ψ ≈ D/b
```

is derived and approximate. It is not a persistence substitution.

### 4.2 Why scalar cant is insufficient for realization

The transformation

```text
(cL,cR) → (cL+a,cR+a)
```

leaves `D` and `ψ` unchanged for any common offset `a`, but moves both rails
vertically. Therefore `D` is sufficient for reduced cant dynamics but not for
unique rail realization.

A realization needs either:

- both `cL` and `cR`; or
- `D` plus a complete source-reference rule from which both rail positions can
  be reconstructed.

For ufAIM/AIM-Core, the working reference is fixed by GAP2-D003 as the midpoint
trajectory between governing rail edges. Lower/inner-rail source trajectories
are adapter provenance, not alternative Core datum choices.

### Contract CANT-001 — Paired law

The lossless constructive cant facet shall preserve:

```text
segmentId
domainInterval
family
cL law
cR law
railHeadDistance law or qualified constant
side/sign/reference convention
continuityIntent
units
provenance
```

An import containing only `D` shall remain a scalar-cant partial state until a
datum rule is supplied. It must not invent paired offsets.

### Contract CANT-002 — Family preservation

The following are distinct constructive families:

- constant cant;
- linear transition;
- Bloss;
- cosine;
- sine;
- Helmert;
- Viennese or other coupled/high-performance transition.

Matching endpoints does not make their interior behavior equivalent. Family and
parameters must survive persistence and exchange where known.

### Contract CANT-003 — Continuity

At `σb`, test separately:

```text
C0L/C0R: rail offsets continuous
C1L/C1R: dcL/dσ and dcR/dσ continuous
C0D:     cant difference continuous
C1D:     dD/dσ continuous
C0ψ:     cant angle continuous
C1ψ:     dψ/dσ continuous
```

Equal `D` continuity does not prove both rail trajectories are continuous.

### Contract CANT-004 — Coupling without identity collapse

Horizontal curvature and cant may share boundaries or dependencies, but their
segmentations are not required to be identical. A cant ramp may be shortened,
offset, overlapping, or otherwise separately constructed where professionally
permitted.

Coupling is expressed through constraints such as:

```text
start/end relation
rate limits
equilibrium/deficiency evaluation
shared free parameters
applicability rule
```

It is not expressed by copying horizontal segment IDs into cant identity.

## 5. Explicit zero, unknown, and partial knowledge

### 5.1 State algebra

For a facet value type `T`, use:

```text
Knowledge<T> =
    Known<T>
  | Unknown
  | OutsideCoverage
  | Ambiguous<T>
```

with:

```text
Known<T> = {
  value,
  convention,
  provenance,
  validityDomain,
  tolerance?
}
```

Zero is:

```text
Known(value = zero_T, ...)
```

not a separate null-like state.

### 5.2 Why explicit zero still needs provenance

These claims are different:

- design specifies zero cant;
- source explicitly records zero cant;
- zero is derived from a constant-level paired rail law;
- importer defaulted a missing field to zero.

Only the first three may produce `Known(0)`, with distinct provenance. The
fourth must remain `Unknown(missingSourceValue)`.

### Contract STATE-001 — No truthiness semantics

No API may use generic truthiness to distinguish state:

```text
0
null
undefined
NaN
""
[]
```

are not a professional knowledge model.

### Contract STATE-002 — Domain-specific zero

`Known(0)` requires:

- a quantity type;
- a unit;
- a sign/reference convention;
- a validity domain;
- provenance.

Examples:

- zero gradient is not zero height;
- zero cant difference is not proof of both rail offsets being zero;
- zero curvature is a straight law, not absence of horizontal construction.

### Contract STATE-003 — Unknown propagation

A derived query shall propagate unknown dependencies unless the result is
mathematically independent of them.

Example:

- known `D=0` and unknown common rail offset allows known cant angle `ψ=0`;
- it does not allow known absolute rail heights;
- known relative gradient with unknown vertical datum allows height difference,
  not absolute height.

### Contract STATE-004 — Partial and ambiguous state

Unknown may be localized by domain and reason. Ambiguity preserves candidates:

```text
Unknown(reason, domain, sourceRef?)
Ambiguous([{value, provenance, residual}], reason)
```

Neither may be serialized as a selected numeric default.

## 6. Cross-facet synchronized query

### Contract SYNC-001 — One location, qualified facets

For any `σq ∈ Σ`, a synchronized query returns:

```text
{
  sigma,
  horizontal,
  vertical,
  cant,
  spatialFrame,
  operationalAddresses,
  topologyContext,
  realizationContext,
  speedEvaluations,
  revision
}
```

Each field carries its own `Knowledge<T>` state. The response has no aggregate
“valid” boolean that erases partiality.

### Contract SYNC-002 — Derived spatial trajectory

The spatial track reference trajectory is derived from:

- horizontal plan law;
- vertical law;
- declared axis/reference convention;
- optionally cant when the chosen reference trajectory depends on it.

It must name whether its longitudinal parameter is `σ` or spatial `ℓ`.

### Contract SYNC-003 — Candidate multiplicity

Projection or inversion operations may return multiple candidates. Candidate
ordering is not authority. Selection needs an explicit applicability context or
human/institutional decision.

## 7. Decision-ready recommended baseline

For the first Alignment Aggregate contract:

1. use directed horizontal-plan arc length `σ` as coordination parameter;
2. preserve vertical family, with `z(σ)`/`g(σ)` as common query interface;
3. support constant-gradient, parabolic and circular vertical segments without
   converting one into another;
4. preserve paired rail-edge positions around the midpoint working trajectory
   and their governing separation;
5. accept scalar `D` as partial cant evidence, not complete rail realization;
6. represent zero as `Known(0)` and unknown as a tagged state;
7. use half-open internal segment domains;
8. keep all approximation policies explicit and versioned.

This baseline is implementation-ready except for the genuine non-equivalent
choices listed in `COUNTEREXAMPLES_AND_DECISIONS.md`.
