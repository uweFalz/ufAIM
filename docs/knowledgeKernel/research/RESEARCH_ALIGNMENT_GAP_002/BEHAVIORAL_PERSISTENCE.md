# Behavioral Persistence Contract

## 1. Problem

Persistence is not proven by:

- successful JSON parsing;
- byte equality after formatting;
- equal sampled coordinates;
- equal endpoint values;
- equal rendered appearance;
- successful IFC export/import;
- solver convergence after reopen.

Each can hold while constructive family, units, conventions, provenance,
unknown states, edit behavior, or identity lineage has changed.

## 2. Two required equivalence levels

### 2.1 Constructive losslessness

Snapshots `A` and `B` are constructively lossless equivalents when they
preserve:

```text
identity and revision semantics
schema and migration identity
domain/orientation
segment identities and ordering
constructive families and primary parameters
units and conventions
boundary/continuity intent
typed known/unknown/partial/ambiguous states
provenance and validity
relation identities
declared approximation policies
```

Derived caches, display meshes, sort order of unordered sets, and formatting
need not be identical.

### 2.2 Behavioral equivalence

Constructive equality is necessary but not sufficient when different
implementations or schema versions are involved.

Model a work state as a labeled transition system:

```text
W = (S, Q, C, δ, obs)
```

where:

- `S` is the set of valid aggregate states;
- `Q` is the canonical query set;
- `C` is the declared command/edit set;
- `δ(s,c)` returns an outcome and zero or one successor state;
- `obs(s,q)` returns a typed observation.

A relation `R ⊆ SA × SB` is a persistence equivalence when, for every
`(a,b) ∈ R`:

1. all canonical queries are equivalent:

   ```text
   obsA(a,q) ≈q obsB(b,q)
   ```

2. for every command `c`, outcomes match in professional meaning:

   ```text
   statusA = statusB
   ```

   including `accepted`, `rejected`, `failed`, and `cancelled`;

3. accepted commands lead to related successors:

   ```text
   δA(a,c) = (accepted,a')
   δB(b,c) = (accepted,b')
   ⇒ (a',b') ∈ R
   ```

4. rejected/failed commands do not leave a partial mutation;
5. candidate sets and residuals are equivalent under declared tolerances and
   identity/order rules;
6. no unknown or ambiguous state is promoted to known by persistence alone.

This is edit-bisimulation over the declared operation surface, not merely
output sampling.

## 3. Canonical query basis

The minimum query basis includes:

### Structural

- aggregate identity/revision lineage;
- domain and orientation;
- facet coverage;
- ordered segment identity, family and parameters;
- convention and provenance records.

### Pointwise

At every segment boundary and deterministic interior witness point:

- horizontal position, heading and curvature;
- vertical `z`, `g`, `θ`, `κv`, and spatial length relation;
- cant `cL`, `cR`, `D`, `ψ`, and derivatives where defined;
- typed state and source provenance.

### Relational

- operational address candidates;
- topology endpoint/edge relations;
- realization status and transforms;
- applicable speed/evaluation contexts.

### Change

- parameter inspection;
- fixed/free/constrained declaration;
- representative accepted edit;
- representative rejected continuity violation;
- cancellation;
- recomputation and affected-set report.

## 4. Witness points are not a proof by themselves

For a segment with known analytic family, compare:

- family and primary coefficients exactly after unit normalization;
- declared domain exactly after canonical numeric decoding;
- derived witness values within a specified tolerance.

Sampling alone cannot distinguish functions that coincide at all chosen
witness points but differ elsewhere. For opaque functions, persistence must
retain a function/grammar identity plus conformance vectors sufficient for its
declared language version.

## 5. Numeric equivalence

Every numeric comparison shall name:

```text
quantityRole
unit normalization
absolute tolerance
relative tolerance
angular wrap rule
domain tolerance
source precision
```

A single global epsilon is prohibited.

Exact decimal or rational source values should be retained where their textual
precision or rule-table identity matters. Binary floating values may be derived
for computation.

## 6. Migration contract

A schema migration is a typed transformation:

```text
M_v→w : Snapshot_v → Result<Snapshot_w, MigrationError>
```

It shall be:

- deterministic;
- version-addressed;
- provenance-preserving;
- explicit about defaults;
- rejecting when required semantics cannot be reconstructed;
- idempotent at the target version;
- followed by constructive and behavioral equivalence tests.

A migration may map a missing legacy cant field only to `Unknown`, never to
`Known(0)`, unless source semantics prove the old omission meant zero.

## 7. Revision and identity

Persistence shall distinguish:

```text
alignmentId
revisionId
parentRevisionId(s)
snapshotId/contentDigest
elementId
relationId
```

Open research/Governance remains on when a constructive edit preserves
`alignmentId`. Regardless of that decision:

- a changed accepted snapshot gets a new `revisionId`;
- derived caches do not get engineering revision identity;
- rejected/failed/cancelled edits do not create a committed successor;
- import source identifiers remain provenance, not automatic engineering
  identity.

## 8. Persistence layers

### Authoritative working snapshot

Preserves full constructive and epistemic state.

### Exchange projection

Maps supported meaning into IFC, InfraGML, GND, or another format and records
what is omitted, approximated, or externalized.

### View/cache projection

Contains sampled/rendered/accelerated data and is always reproducible or
discardable.

No lower layer may overwrite the authoritative snapshot solely because it is
more convenient to serialize.

## 9. Required conformance fixtures

### P-01 Zero versus unknown

Two geometrically identical views:

- A: `Known(cant=0)` over all `Σ`;
- B: `Unknown(cant missing)` over all `Σ`.

They must remain distinguishable after reopen and after IFC/export projection.

### P-02 Parabola versus circular vertical arc

Construct segments with matching endpoints and endpoint gradients. They shall
retain different families and show different interior curvature/edits.

### P-03 Scalar versus paired cant

Two paired rail laws with equal `D` but different common offsets. Reduced cant
query may match; rail realization must differ.

### P-04 Approximation boundary

Persist a circular vertical arc with a small-angle preview. Reopen shall retain
the circular primary law, not the preview parabola.

### P-05 Reversal

Reverse twice. The resulting state shall be equivalent to the original,
including left/right, signs, domain mapping, topology ports, and provenance.

### P-06 Partial domain

Known vertical profile on `[σ0,σm]`, unknown on `(σm,σ1]`. Reopen must preserve
boundary ownership and unknown reason.

### P-07 Rejected edit

An edit violating declared continuity returns `rejected`, preserves the prior
revision, and produces no partial successor.

### P-08 Cross-language

Two implementations load the same fixture and satisfy the canonical query and
command basis. Runtime object shape and cache layout may differ.

### P-09 Exchange loss declaration

Export to a format unable to carry one cant family or unknown-state provenance.
The projection must report the loss; re-import must not claim authoritative
roundtrip equivalence.

## 10. Result contract

Persistence operations return:

```text
{
  status: accepted | rejected | failed | cancelled,
  snapshotId?,
  revisionId?,
  migratedFrom?,
  losses: [],
  approximations: [],
  warnings: [],
  diagnostics: []
}
```

`accepted` means the authoritative snapshot passed structural validation. It
does not mean engineering approval.

## 11. Done criterion for a future implementation

The persistence port is complete for the first Alignment Aggregate when:

1. all P-01 through P-09 fixtures pass;
2. constructively authoritative fields survive exactly or through declared
   canonical normalization;
3. derived queries satisfy quantity-specific tolerances;
4. command outcomes satisfy edit-bisimulation for the declared command set;
5. unknown and ambiguity never become numeric defaults;
6. exchange losses are explicit;
7. no UI, browser, or storage-engine type appears in the Core contract.
