# Counterexamples and Decision Dossiers

## 1. Counterexamples

### CE-001 — Parabola is not a vertical circle

Take a parabolic vertical law:

```text
g(σ) = g0 + qσ
```

Its spatial curvature is:

```text
κv(σ) = q/(1+g(σ)²)^(3/2)
```

Unless `g` is constant, `κv` varies. A vertical circular arc requires constant
`κv`. Matching endpoints and gradients does not make the interiors or edit
degrees of freedom equal.

Failure prevented: family-erasing import/persistence.

### CE-002 — Horizontal length is not spatial length

For constant gradient `g=0.04` over `σ=1000 m`:

```text
ℓ = 1000 sqrt(1+0.04²) ≈ 1000.79968 m
```

The difference is about `0.80 m`. Small does not mean identical, and repeated
substitution can corrupt domain joins or operational addresses.

Failure prevented: unqualified `length` fields.

### CE-003 — Equal cant difference, different rails

At one location:

```text
A: (cL,cR) = (0, 0.150 m)
B: (cL,cR) = (-0.075 m, 0.075 m)
```

Both have `D=0.150 m`, but their rail elevations and track reference placement
differ.

Failure prevented: deriving unique 3D rail geometry from scalar cant.

### CE-004 — Equal cant endpoints, different ramp

A linear and a Bloss cant ramp can have the same start/end values and length.
Their interior derivatives differ. Rate/comfort evaluation and the effect of a
length edit differ.

Failure prevented: endpoint-only persistence.

### CE-005 — Zero is not missing

```text
A = Known(0 mm, source explicitly says uncanted)
B = Unknown(missing cant records)
```

Both may render flat under a defensive viewer fallback. Only A supports a claim
of zero cant.

Failure prevented: UI fallback becoming engineering truth.

### CE-006 — Zero cant difference is not zero rail offset

```text
cL = 0.050 m
cR = 0.050 m
D  = 0
```

The track is uncanted but both rails are vertically offset relative to the
chosen reference.

Failure prevented: confusing cant state with vertical placement.

### CE-007 — C0 difference does not prove C0 rails

Across a boundary, both sides may have `D=0.100 m` while `(cL,cR)` jumps by a
common vertical offset. Cant difference is continuous; rail geometry is not.

Failure prevented: insufficient continuity checks.

### CE-008 — Sample equality is not behavioral equality

Two curve families can be fitted to the same finite witness points. Editing
their length or endpoint gradient produces different successors.

Failure prevented: sampling-only roundtrip certification.

### CE-009 — Migration default changes knowledge

A legacy record lacks cant. A migration inserts `cant: 0`.

The geometry becomes easier to draw but the epistemic claim changed from
unknown to known without evidence.

Failure prevented: non-conservative migration.

### CE-010 — Reversal changes side semantics

Reversing an Alignment without swapping left/right and transforming signs can
leave coordinates visually similar while cant and topology meaning becomes
wrong.

Failure prevented: direction treated as display order.

## 2. Genuine decision dossiers

Only these items represent choices between non-equivalent mathematical models.

### GAP2-D001 — Common coordination parameter

Question:

What is the Alignment Aggregate’s common intrinsic coordination parameter?

Option A — horizontal-plan arc length `σ`:

- matches IFC/EN distance-along semantics for H/V/cant;
- naturally coordinates plan, profile, cant and chainage;
- spatial length remains derived;
- recommended.

Option B — spatial centreline arc length `ℓ`:

- geometrically intrinsic to the 3D trajectory;
- requires horizontal, vertical and potentially cant realization before the
  common parameter exists;
- conflicts with common railway profile/cant stationing practice;
- may make a horizontal-only Alignment incomplete.

Option C — abstract monotone parameter:

- mathematically general;
- every physical rate needs a metric mapping;
- weakens immediate engineering meaning and implementation interoperability.

Recommended decision: A.

Exact decision needed from Uwe/Rock:

Confirm `σ` as directed horizontal-plan arc length for the first Aggregate
contract, with `ℓ` and operational kilometre as separate mappings.

### GAP2-D002 — Vertical constructive families

Question:

May the Core normalize all vertical curves to one family?

Option A — preserve constant-gradient, parabolic, circular, and declared
higher-order families:

- truthful to standards and source intent;
- keeps correct edit behavior;
- requires family-aware evaluators;
- recommended.

Option B — normalize to `z(σ)` polynomial pieces:

- simpler computation;
- may approximate circular arcs;
- loses source family and changes constraints/edit behavior.

Option C — normalize to constant spatial-curvature pieces:

- elegant differential geometry;
- changes parabolic railway construction and rate-of-gradient semantics.

Recommended decision: A.

Exact decision needed:

Approve family preservation as a contract invariant; allow explicit derived
approximations only as projections.

### GAP2-D003 — Cant primary representation

Status:

`corrected and decided by Uwe Falz`

Binding Research input:
[GAP2-D003 Cant reference/datum decision](DECISION_RECORD_GAP2_D003.md)

Question:

What is sufficient authoritative cant construction?

Option A — paired rail offsets `(cL,cR)` plus rail-head distance and convention:

- uniquely supports rail realization;
- derives `D` and `ψ`;
- maps well to IFC;
- recommended authoritative form.

Option B — scalar cant difference `D`:

- sufficient for many reduced dynamics calculations;
- insufficient for unique rail/axis realization;
- acceptable only as partial evidence.

Option C — cant angle `ψ`:

- compact spatial orientation;
- depends on rail-head distance and loses original height-difference quantity.

Decision:

- authoritative construction uses paired rail positions;
- scalar cant and cant angle remain qualified derived/partial forms;
- the ufAIM/AIM-Core working trajectory is the midpoint between governing rail
  edges;
- lower, typically curve-inner rail trajectory is a source/rule convention,
  not the Core norm;
- the only currently recognized exception is explicitly justified undertiefung
  at a Bogenweiche within the source/engineering model;
- adapters transform source reference to midpoint work reference explicitly,
  deterministically, reversibly, and with roundtrip provenance;
- special, incomplete, or contradictory cases return explicit typed states.

### GAP2-D004 — Native zero-profile creation

Question:

When creating an empty native Alignment, are vertical and cant facets known
zero or unknown?

Option A — explicit user/product action creates level and uncanted laws:

- immediately work-capable;
- truthful only if UI/API communicates the defaults as design intent;
- recommended for deliberate native creation.

Option B — unknown until entered:

- epistemically conservative;
- blocks complete 3D/dynamic claims;
- recommended for incomplete import.

These options apply to different provenance paths and should coexist rather
than be globally selected.

Recommended decision:

Native creation command may assert `Known(0)` with `defaultedByDesignIntent`
provenance; import omission always yields `Unknown`.

### GAP2-D005 — Persistence equivalence surface

Question:

How much edit behavior must a roundtrip preserve?

Option A — declared operation-surface bisimulation:

- decision-ready and testable;
- expands as Core capability expands;
- recommended.

Option B — all conceivable future operations:

- theoretically strong;
- untestable and blocks delivery.

Option C — query equality only:

- easy;
- misses family/constraint differences exposed by edits.

Recommended decision: A.

Exact decision needed:

Freeze the first conformance command set with the first Aggregate service
package and version it thereafter.

## 3. Items that do not require escalation

These follow from the selected semantics and are routine contract consequences:

- use quantity-specific tolerances;
- preserve units and conventions;
- use deterministic segment-boundary ownership;
- never use truthiness for professional state;
- migrations map missing legacy values to unknown;
- derived caches are non-authoritative;
- rejected/failed/cancelled edits do not commit partial revisions;
- exchange loss is reported rather than hidden.
