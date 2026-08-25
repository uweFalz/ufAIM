# Research Decision Note — RPR-D001

Version: `0.3`

Recorded: 2026-08-23

Decision owner: Uwe Falz

Status: `confirmed professional input; proposed Kernel candidate; not active Kernel authority`

Review disposition: `accepted after required anchor clarification`

## Question

Which construction data are minimally required to turn the synchronized
`coordGeom`, `profile`, and `cant` bands of a railway Alignment into two
unambiguous rails, and where is the boundary to wheelset kinematics and vehicle
interaction?

The question is governed by three requirements:

1. construction must determine both rails without hidden conventions;
2. the result must support operational consumers without turning track data
   into a vehicle state;
3. primary storage must remain free of redundant derived state and its
   synchronization risks.

## Governance boundary

This note records Uwe Falz's confirmed professional decision and prepares a
Kernel candidate. It does not approve or modify active Knowledge Kernel
authority. Concrete field names, serialization shapes, native cant-law
families, tolerances, and implementation services remain later Architecture or
RefImpl decisions.

The note builds on, and reformulates the working-reference interpretation of,
[`GAP2-D003`](../RESEARCH_ALIGNMENT_GAP_002/DECISION_RECORD_GAP2_D003.md).
It does not erase that decision or its provenance.

## Confirmed professional decision

### 1. Construction bands

`coordGeom`, `profile`, and `cant` are synchronized construction bands over a
common intrinsic longitudinal parameter `s`. They are not vehicle states.

- `coordGeom` supplies the curvature-based horizontal construction in plan.
- `profile` supplies the constructive vertical zero horizon.
- `cant` supplies the rail-bound cross-section construction that `coordGeom`
  and `profile` intentionally do not contain.

### 2. Native cant basis

The native rail-bound cross-section basis is

```text
R(s) = (anchorRule(s), cL(s), cR(s), g(s))
```

where:

- `anchorRule(s)` locates the governing rail pair laterally relative to the
  horizontal Alignment reference; the AIM normal rule is midpoint where
  applicable, while named-rail or qualified-other rules remain explicit;
- `cL(s)` is the offset of the identified left governing rail reference from
  the profile zero horizon;
- `cR(s)` is the corresponding offset of the identified right governing rail
  reference;
- `g(s)` is their qualified separation law, including its measurement
  definition rather than an unqualified number called gauge.

Each component requires direction, units, validity domain, governing reference
definition, and provenance. Left and right are persistent identities under the
declared increasing-`s` convention. Inside and outside are derived curve roles
and must not replace them.

Cant therefore supplies the rail-bound cross-section construction consumed by
Rail-Pair Metric Realization. It does not denote construction or maintenance
of a physical asset. A scalar rail-height difference is a derived view, not
the native state.

### 3. Sparse zero semantics

For an admitted cant construction whose coverage is explicitly complete over
a stated domain:

```text
no offset entry for a rail at s  =>  offset = 0
```

The same rule does not apply to incomplete, imported, provisional, or merely
observed evidence:

```text
no evidence entry at s  =>  Unknown
```

Absence may mean zero only after coverage and admission make that default an
authoritative construction rule. This distinction prevents sparse storage from
turning missing evidence into invented geometry.

### 4. Derived quantities

Where their conventions and measurement definitions are complete, the
following are derived:

```text
crossLevel(s)   = cR(s) - cL(s)
commonOffset(s) = 0.5 * (cL(s) + cR(s))
```

Roll is derived from the complete rail-pair geometry and its qualified
separation. The simplified relation

```text
roll(s) = atan(crossLevel(s) / gHorizontal(s))
```

is valid only when `gHorizontal` is in fact the matching horizontal separation
under the declared reference convention. Nominal gauge, running-edge distance,
rail-centre distance, contact distance, horizontal projection, and spatial
point distance are not interchangeable.

Also derived are:

- left and right spatial rail trajectories;
- the rail-pair midpoint trajectory;
- the cant-aware track frame;
- runtime `pose3`;
- twist or offset derivatives when the constructive laws support them.

These values may be evaluated, observed, exchanged, or cached with explicit
status. They are not additional equal-ranking constructive truth.

### 5. Rail-Pair Realization

The construction bands are consumed by an explicit realization operator:

```text
Rrail :
  (coordGeom, profile, cant, anchorRule, metricRealization)
  -> RailPairGeometry
```

The result contains, at the requested `s` and qualification level, at least:

```text
RailPairGeometry(s) =
  (PL(s), PR(s), TL(s), TR(s), Ftrack(s))
```

where `PL` and `PR` are the realized governing left and right rail references,
`TL` and `TR` their tangential states, and `Ftrack` the derived track frame.
The operator retains the identity, datum, measurement definition, realization,
and provenance of every required input.

The exact spatial formula is realization-dependent. A convenient local
explanation with profile zero-horizon origin `G0`, lateral direction `l0`, and
vertical direction `z0` is:

```text
PL(s) = G0(s) + yL(s) l0(s) + cL(s) z0(s)
PR(s) = G0(s) + yR(s) l0(s) + cR(s) z0(s)
```

The qualified separation contract determines `yL`, `yR`, and any necessary
nonlinear spatial realization. The displayed formula is not permission to
substitute nominal gauge silently.

### 5a. Derived rail-pair anchor

The preferred kinematic reference is the geometric midpoint of the realized
governing rail pair:

```text
Arp(s) = 0.5 * (PL(s) + PR(s))
```

Together with its height, the qualified cross-section orientation, and the
qualified separation, this anchor gives a compact kinematic projection for
runtime `pose3`, an idealized wheelset, and later vehicle consumers. It is an
output of Rail-Pair Realization, not a second persistent construction truth.

The construction remains native in the profile zero horizon and sparse
`cL/cR` laws. Persisting both that basis and independent anchor-height,
cross-level, rail trajectories, or `pose3` as equal-ranking truth would create
redundancy.

The relation between `coordGeom` and the rail pair must be explicit. A
qualified cross-section anchor rule shall state whether the horizontal
Alignment reference is the rail-pair midpoint, a named rail reference, or
another identified construction line. A separation value alone does not
determine both lateral rail positions because it omits their common lateral
offset. The AIM normal case may use a midpoint rule, but imported or
project-specific references require an explicit provenance-bearing
transformation.

### 6. Operational boundary

`RailPairGeometry` is a construction-derived infrastructure condition. It is
not a wheelset or vehicle state.

An explicitly idealized wheelset operator may consume it:

```text
KwheelsetIdeal :
  (RailPairGeometry, traversal s(t), idealWheelsetModel)
  -> IdealWheelsetState(t)
```

The model must state its assumptions, for example centred placement,
right-angle axle orientation, rigid binding, nominal rolling radius, and no
creep or flange contact. Those assumptions are not supplied by the Alignment.

Real wheel--rail interaction is a separate operator:

```text
IwheelRail :
  (RailPairGeometry,
   wheelAndRailProfiles,
   wheelsetState,
   contactModel,
   traversal,
   operatingConditions)
  -> contacts, constraints, forces, moments
```

Vehicle dynamics then additionally requires vehicle identity, masses,
inertias, suspension, loading, degrees of freedom, and an identified response
model. Track construction, idealized wheelset kinematics, contact mechanics,
and vehicle dynamics must remain distinct.

## Primary and derived information matrix

| Information | Status | Reason |
|---|---|---|
| horizontal curvature laws and start state | primary `coordGeom` | determine plan construction by integration |
| profile zero-horizon law and vertical datum | primary `profile` | construction datum for both rail offsets |
| persistent left/right governing rail identity | primary `cant` | cannot be recovered at zero curvature or reversal |
| cross-section anchor rule | primary construction relation | separation alone does not locate both rails relative to `coordGeom` |
| `cL(s)`, `cR(s)` | primary `cant` | preserve differential and common vertical modes |
| qualified `g(s)` or separation law | primary `cant` | required to realize the cross-section unambiguously |
| coverage/admission status | primary epistemic contract | distinguishes sparse zero from missing evidence |
| cross-level | derived | `cR-cL` loses common offset |
| common offset | derived | `0.5(cL+cR)` |
| inside/outside rail role | derived and partial | undefined at `kappa=0`; changes at reversal |
| roll | derived | depends on both offsets and qualified separation |
| left/right spatial rail trajectories | derived realization | require all three bands and metric realization |
| rail-pair midpoint trajectory | derived realization | `0.5(PL+PR)` after governing pair is known |
| track frame and `pose3` | derived runtime state | persistence beside construction creates synchronization risk |
| ideal wheelset pose | model-derived operational state | requires traversal and ideal wheelset assumptions |
| contact points and forces | interaction-derived | require profiles, state, contact model, and operation |
| vehicle response | vehicle-model-derived | not infrastructure construction data |

## Redundancy rule

The pair `(cL,cR)` contains two independent vertical modes:

```text
common mode       a = 0.5(cL + cR)
differential mode u = cR - cL
```

Storing only `u` is not redundancy reduction; it is information loss. Storing
`cL`, `cR`, `u`, `a`, roll, midpoint, rail trajectories, and `pose3` as
independent truths creates redundancy and synchronization failure.

The native construction stores one sufficient basis. Derived values carry a
declared status such as runtime evaluation, cache, source evidence,
observation, or representation. A cache or observation never silently becomes
the constructive source of truth.

## Required counterexamples

### RPR-CE-001 — Equal cross-level, different rail-pair position

```text
(cL,cR) = (0.00,0.15)
(cL,cR) = (0.10,0.25)
```

Both yield `crossLevel=0.15`; their common offsets and spatial rail positions
differ. Scalar cross-level cannot reconstruct either pair uniquely.

### RPR-CE-002 — Zero cross-level with common offset

```text
cL = cR = 0.08
crossLevel = 0
```

The rail pair is not on the profile zero horizon. Zero cross-level is not zero
rail offset.

### RPR-CE-003 — Standard cant

If the admitted construction keeps the left rail on the zero horizon and
raises the right rail, the sparse state needs only a right-rail offset entry.
The absent left entry evaluates to zero because coverage is complete. This is
an outcome of the admitted construction, not a universal lower-rail rule.

### RPR-CE-004 — Track scissors

A constrained curve-to-countercurve construction may use overlapping offset
laws:

```text
cR(s) = outgoingRamp(s)
cL(s) = incomingRamp(s)
```

The ordinary `clothoid == cant ramp` correspondence does not hold. At a
crossing station, `cL=cR` may be non-zero. A single cross-level law loses both
the common offset and the two constructive ramp contributions.

The scissors are therefore a cant construction problem. Their historical GRA
overhead is evidence of the information lost when horizontal TRA and vertical
or cant-related GRA projections are stored separately.

### RPR-CE-005 — Undertiefung at a curved switch

A negative offset of an identified rail is representable without changing the
mathematics. Its engineering meaning requires explicit switch, branch,
direction, reference-side, validity, provenance, and justification. A negative
cross-level sign alone does not establish undertiefung.

### RPR-CE-006 — Curvature zero and reversal

At `kappa=0`, inside and outside are not geometrically defined. Across a
curvature reversal their roles exchange. Persistent left/right rail identities
and their offset laws remain usable without guessing or identity exchange.

### RPR-CE-007 — Gauge qualification

The same number can denote nominal track gauge, running-edge separation,
rail-centre distance, horizontal projection, or spatial distance between
reference points. These produce different cross-sections under cant. A usable
separation law therefore includes its measurement definition.

### RPR-CE-008 — Ideal wheelset versus real contact

The same realized rail pair permits multiple real wheelset states with
different lateral displacement, yaw, contact points, rolling radii, and creep.
A track `pose3` may orient an idealized wheelset but cannot determine real
wheel--rail interaction.

### RPR-CE-009 — Equal separation, different lateral common mode

```text
(yL,yR) = (-g/2,+g/2)
(yL,yR) = (0,+g)
(yL,yR) = (d-g/2,d+g/2)
```

All three pairs may have the same qualified separation `g` but occupy
different lateral positions relative to `coordGeom`. A primary cross-section
anchor rule is therefore required and must not be confused with the derived
realized midpoint anchor.

## Resolution of GAP2-D003 working-reference wording

[`GAP2-D003`](../RESEARCH_ALIGNMENT_GAP_002/DECISION_RECORD_GAP2_D003.md)
correctly established that a scalar cant difference cannot replace paired rail
positions and that source lower-rail conventions must not become silent Core
anchors. Its phrase `working reference trajectory = midpoint between governing
rail edges` is retained at the realization/runtime boundary and made more
precise:

1. `profile` supplies the persistent constructive vertical zero horizon;
2. `cant` supplies both rail offsets and qualified separation relative to that
   construction;
3. `Rrail` derives both rail trajectories;
4. their midpoint is the derived rail-pair runtime working trajectory;
5. source-specific lower-, inner-, outer-, axis-, or midpoint references remain
   provenance-bearing adapter inputs;
6. no source reference silently replaces the profile zero horizon or the
   derived runtime midpoint.

This is a reformulation and scope separation, not a claim that the earlier
Research record was active Kernel authority. A future Governance package shall
record the relationship explicitly if it promotes the candidate.

## Proposed Kernel candidate wording

> **Rail-Pair Realization and Vehicle-Interaction Boundary**
>
> A railway Alignment's horizontal geometry and vertical profile do not by
> themselves determine a two-rail track. The cant construction identifies the
> governing left and right rail references and supplies their sparse offsets
> from the profile's constructive vertical zero horizon together with a
> qualified separation law. Absence of an offset entry means zero only within
> an explicitly complete and admitted construction domain; otherwise absence
> means unknown.
>
> Horizontal geometry, profile, cant, and metric realization jointly determine
> a Rail-Pair Realization. Cross-level, common offset, roll, spatial rail
> trajectories, their midpoint, the track frame, and pose3 are derived states
> and shall not become independent constructive truths.
> The derived geometric midpoint of the governing rail pair is the preferred
> kinematic anchor for track-frame, pose3, ideal-wheelset, and vehicle
> consumers. Its relation to the horizontal Alignment reference shall be
> explicit; qualified separation without an anchor rule does not determine
> both lateral rail positions.
>
> The Rail-Pair Realization is an infrastructure condition. An idealized
> wheelset state additionally requires an explicit traversal and wheelset
> model. Real wheel--rail interaction and vehicle response additionally require
> contact geometry, operating state, and identified physical models. Alignment
> construction, rail-pair realization, wheelset kinematics, contact interaction,
> and vehicle dynamics remain distinct responsibilities.

## Follow-up impact

### Thesis

After Governance review, Thesis work should:

- replace the general claim that cant always follows the same normalized
  curvature family as `cGeom`;
- present scalar cross-level as derived rather than complete native cant;
- distinguish profile zero horizon from derived rail-pair midpoint;
- qualify the pose3 reconstruction claim with paired offsets and separation;
- use track scissors, common-offset zero cross-level, undertiefung, and
  curvature reversal as counterexamples;
- retain the existing separation between track state and vehicle state.

### Reference Implementation

After Architecture authorization, a later Cant Core version should support:

- two persistent governing rail identities;
- sparse `cL` and `cR` offset laws;
- explicit complete versus incomplete coverage;
- qualified separation laws;
- overlapping laws for different rails;
- non-linear constructive families without assuming cGeom identity;
- direction reversal and curvature-zero-safe semantics;
- derived scalar cross-level and common offset;
- a separate Rail-Pair Realization service;
- no persistent pose3 or spatial rail cache as equal-ranking truth.

The existing `CantConstructiveState v0.1` remains implementation evidence and
is not changed by this note.

## Confidence and remaining research

Confidence is high that scalar cross-level is insufficient and that the
construction/realization/vehicle boundary is necessary. Confidence is medium
on the eventual Core naming and exact governing rail-reference type because
switches, crossings, rail profiles, multi-rail systems, and gauge-changing
track require their own contracts.

Remaining Research:

- governing rail-edge/reference taxonomy;
- qualified gauge/separation measurement contract;
- multi-rail and route-dependent pair selection;
- admissible native cant-law families and continuity;
- exact relationship between design offsets and constructed/observed rail
  states;
- reduced ideal-wheelset models appropriate for operational evaluation.
