# The Positive Railway Alignment Nucleus

## 1. Research question and test

The mission tests a positive completeness claim:

> A Railway Alignment is work-capable when an engineer can understand what is
> constructed, locate it intrinsically and in its qualified contexts, change it
> with calculable consequences, relate it to a railway network, evaluate it for
> a stated operational purpose, and recover the same engineering meaning later.

The test is functional rather than taxonomic. A candidate nucleus must support:

1. creation or faithful import;
2. constructive inspection;
3. a local edit with connected recalculation;
4. plan/profile/cant interpretation at the same intrinsic location;
5. operational address lookup without confusing address and distance;
6. explicit standalone or connected network state;
7. local or qualified world realization;
8. speed-qualified evaluation;
9. save, reopen, and semantic comparison.

If one responsibility is absent, the counterexample must show which user action
fails. If a responsibility can be explicit but unresolved, the model must retain
that state without fabricating certainty.

## 2. Result in one sentence

The minimum complete unit is **not a curve and not a record**: it is a
versioned, constructively editable railway Alignment aggregate whose intrinsic
longitudinal spine coordinates horizontal geometry, vertical geometry, cant,
operational addressing, topology, world realization, qualified evaluation, and
reproducible change.

## 3. The four-part positive nucleus

### N1 — Constructive spine

The constructive spine answers: **what line is intended and how is it built?**

Mandatory responsibilities:

- stable Alignment identity distinct from any one file, view, or coordinate
  sample;
- directed intrinsic longitudinal domain `s ∈ [s0, s1]`;
- ordered constructive segmentation and element identity;
- horizontal curvature law `κ_h(s)` plus the boundary data needed for its
  realization;
- vertical law, expressible through height `z(s)`, gradient `g(s)`, or vertical
  curvature `κ_v(s)` with explicit convention;
- cant/cross-level law `u(s)` with track-axis, rail-side, sign, and gauge
  conventions;
- common domain or explicit mappings between the three laws;
- boundary and continuity conditions, units, tolerances, and provenance.

The three laws are distinct but coupled. Horizontal geometry cannot absorb
vertical geometry or cant without losing their independent construction and
evaluation roles.

Minimal-value rule:

- horizontal construction is required;
- a level profile may be represented by an explicit zero-gradient vertical law;
- an uncanted track may be represented by an explicit zero-cant law;
- “not supplied” is not equivalent to zero;
- a truncated domain or unknown continuation must remain explicit.

Why this is railway-specific: tangent/circle construction is inherited civil
engineering, but the coordinated development of curvature, cant, and
speed-dependent consequence is a defining railway pattern.

Classification:

- intrinsic domain, constructive sequence, horizontal/vertical/cant separation:
  `U`;
- curvature-primary identity language and one aggregate coordinating all three
  laws: `S`;
- exact canonical identity persistence after law-changing edits: `G`.

### N2 — Reference and context envelope

The envelope answers: **where does the Alignment participate and how is a
location addressed?**

It contains three separate relations.

#### N2.1 Operational addressing

- mapping between intrinsic `s` and one or more qualified chainage/kilometre
  addresses;
- kilometre-line identity, direction, origin, units, station equations/jumps,
  missing or excess lengths;
- incoming/outgoing or otherwise multi-valued addresses;
- provenance and validity interval;
- explicit partial, ambiguous, or unresolved result.

Operational kilometre is not intrinsic distance. ISO 19148 independently
supports location as measure along a one-dimensional object; German railway
practice adds historically persistent discontinuities and line-specific
addressing.

Classification: separation of measure and address `U`; strict bidirectional,
potentially multi-valued railway mapping in one workbench `S`; complete
cross-administration rule coverage `G`.

#### N2.2 Network participation

- stable endpoint/port identity and Alignment orientation;
- explicit state: standalone, connected, branch-participating, or unresolved;
- nodes and directed Alignment edges;
- geometric connection conditions kept distinct from topological connection
  and operational traversability;
- switch/branch relationships and applicable detail level when present.

A standalone design Alignment is allowed, but “not yet connected” must be a
positive state. Removing topology entirely makes connection, route, switch, and
multi-Alignment work undefined.

Classification: network topology and multi-level referencing `U`; treating
Alignment endpoints as explicit constructive ports across geometry and topology
`S`; switch-internal constructive coupling and route semantics `G`.

#### N2.3 Real-world realization

- an engineering-local metric context is always available;
- horizontal and vertical reference status are separate;
- CRS identifiers, transforms, epoch/grid dependencies, origins, units, and
  provenance are qualified when known;
- World-to-Track and Track-to-World operations return quality and multiplicity;
- local-cartesian fallback is explicit and does not masquerade as geography.

CRS is neither Alignment identity nor the whole realization context. A missing
CRS does not make local design impossible, but an application must preserve the
absence and prevent false world placement.

Classification: separation of engineering geometry and CRS realization `U`;
mandatory explicit realization status including local fallback `S`; robust
vertical-reference and transformation provenance across imported estates `G`.

### N3 — Purpose and evaluation envelope

This envelope answers: **for what railway use is the construction sufficient?**

Mandatory responsibilities:

- one or more qualified speed profiles or design-speed assumptions;
- vehicle/gauge/application class and rule-set identity where relevant;
- cant equilibrium, cant deficiency/excess, rates and other derived quantities;
- applicability domain, thresholds, units, tolerances, residuals, and warnings;
- distinction among calculated candidate, evaluated result, proposal, and
  accountable decision.

Speed is not intrinsic Alignment identity. It is nevertheless required for a
work-capable railway design because EN 13803 makes alignment limits functions of
speed and inversely derives permissible speed from an existing alignment.

Minimal-value rule:

- an unevaluated imported Alignment may exist;
- its state must explicitly say that no speed-qualified railway sufficiency has
  been established;
- a design action that claims railway fitness requires at least one declared
  purpose/evaluation context.

Classification: speed–radius–cant reciprocity `U`; speed external to identity
but required in the working aggregate `S`; complete vehicle–track dynamics and
rule applicability model `G`.

### N4 — Change and continuity contract

This contract answers: **can the object be changed and recovered as engineering
knowledge?**

Mandatory responsibilities:

- editable source intent, not only sampled coordinates;
- problem declaration with fixed, free, and constrained parameters;
- boundary/continuity conditions and dependency graph;
- solver/candidate generation separated from applicability, evaluation, and
  decision;
- atomic accepted change or explicit rejected/failed/cancelled outcome;
- affected-result and residual reporting;
- stable object and element identifiers under declared lifecycle rules;
- immutable revision lineage, provenance, schema/version identity, units, and
  lossless serialization;
- reopen-and-recalculate equivalence test.

An exchange file may preserve substantial meaning without being the sole
working-state format. Conversely, a private serialized object graph is not
lossless merely because it can be parsed.

Classification: constructive calculation and recoverable records `U`;
AXTRAN problem declarations, alternatives, sparse recalculation, and explicit
outcome contract as one nucleus service boundary `S`; identity survival rules,
complete persistence port, and cross-language equivalence `G`.

## 4. Responsibility map

| Responsibility | Must be present in nucleus? | May its value be unresolved? | Must not be collapsed into |
|---|---:|---:|---|
| Identity and revision | yes | no identity; lifecycle criteria may be open | filename, coordinates, UI selection |
| Intrinsic domain/orientation | yes | endpoints may be provisional | kilometre labels |
| Horizontal construction | yes | partial import permitted and marked | sampled polyline |
| Vertical construction | yes | unknown permitted; zero must be explicit | world `Z` alone |
| Cant construction | yes | unknown permitted; zero must be explicit | horizontal curvature or roll rendering |
| Operational addressing | yes as a relation/status | yes | intrinsic `s` |
| Network participation | yes as a relation/status | yes/standalone | geometric coincidence |
| Realization context/CRS | yes as a status | yes/local-only | intrinsic identity |
| Speed/dynamic evaluation | yes as a purpose/status | yes/unevaluated | constructive geometry |
| Constructive change contract | yes | unavailable import may be read-only and marked | ad-hoc field mutation |
| Persistence/revision | yes | no for a work product | export appearance |
| Human/institutional authority | no, external accountable relation | yes | solver result or persisted flag |

## 5. Why the nucleus is minimal

Each removal breaks a concrete action:

| Remove | Immediate failure |
|---|---|
| intrinsic domain | horizontal, vertical, cant, address, and evaluation cannot share a stable independent variable |
| horizontal law | no constructive route geometry |
| vertical law | no gradients, height design, vertical curvature, or spatial railway path |
| cant law | no rail-level construction or truthful cant/rate evaluation |
| addressing | no operational kilometre lookup or preservation through rerouting |
| topology status | no truthful connection, switch, route, or multi-Alignment semantics |
| realization status | no safe distinction between local design and world geography |
| speed context | geometry cannot make a railway sufficiency claim |
| change contract | display/exchange object cannot support consequential design |
| persistence lineage | reopened state cannot prove semantic continuity |

Adding assets, platforms, signalling, overhead line, corridors, observations, or
maintenance condition may be essential to later applications, but these are not
required to make the Alignment nucleus itself work. They bind to it through
explicit relations.

## 6. Counterexamples

### C1 — The polyline

A precise 3D polyline may render and measure well. It does not necessarily
retain curve family, curvature law, constraints, cant, profile construction, or
edit intent. It is a realization/representation, not a complete nucleus.

### C2 — Horizontal + vertical + cant exchange

IFC 4.3 can exchange business-logic layouts and derived geometry. Without
operational kilometre semantics, topology participation, evaluation purpose,
and a revision/change contract, that file alone is not the whole working
aggregate.

### C3 — The kilometre table

A kilometre system can persist through geometry changes and locate assets. It
does not define the constructive line and may be multi-valued at jumps.

### C4 — The topological edge

A directed edge between nodes supports routing but has no necessary metric,
curvature, profile, cant, or construction law.

### C5 — The georeferenced axis

Coordinates plus an EPSG identifier locate a line in the world but do not prove
which height convention, construction, operational address, or transformation
history produced it.

### C6 — The checked design

A green compliance flag is insufficient without rule version, assumptions,
speed/vehicle context, residuals, and accountable decision. Calculation does not
create authority.

### C7 — The saved JSON

Parsing the same keys after reopening does not prove preservation of units,
semantics, dependencies, identity, or recalculation behavior.

### C8 — The universal super-object

Putting geometry, speed, CRS, approval, observation, assets, and topology into
one undifferentiated identity is not completeness. It destroys the ability to
change one context without collapsing the Alignment’s constructive identity.

## 7. Historical confrontation

The nucleus is an accumulation of problem responses:

1. surveying and levelling established route, profile, longitudinal measure,
   and constructibility;
2. tangent/circle calculus made horizontal construction executable;
3. transition curves made curvature development controllable;
4. cant and speed made railway alignment a coupled motion problem;
5. vertical curves completed the constructive spatial task;
6. tables, instruments, AXTRAN, and CAD operationalized calculation and change;
7. kilometre estates separated operational address from pure curve length;
8. measurement separated intended, realized, and observed geometry;
9. topology, GIS, BIM, and IFC connected Alignment to networks, world context,
   assets, and exchange.

No historical step licenses collapsing these distinctions. The positive
nucleus reconnects them around a shared intrinsic domain.

## 8. Contemporary standards confrontation

### IFC 4.3.2.0

Strong support:

- `IfcAlignment` distinguishes business logic from geometry definition;
- horizontal, vertical, and cant layouts are separately represented;
- design speed and cant deficiency can attach to business logic;
- composite, gradient, and segmented-reference curves express increasingly
  complete geometric realization.

Limit:

- IFC is an exchange/information standard, not by itself an application’s
  complete edit, solver, revision, operational-kilometre, or authority contract.

### OGC LandInfra / InfraGML

Strong support:

- Alignment, Railway, Survey, and linear referencing are related but separate
  requirements classes;
- alignment has horizontal and vertical element structures;
- railway cant events and kilometre connections can locate along a linear
  element;
- railway elements may use an Alignment as their spatial representation.

Limit:

- the 2016/2017 model does not prescribe the full constructive-edit and
  persistence behavior needed by the workbench.

### ISO 19148:2021

Strong support:

- location relative to a one-dimensional object is a distinct conceptual
  schema with measures and optional offsets;
- required operations belong to linear referencing, not curve identity.

Limit:

- generic linear referencing does not supply railway kilometre estate,
  constructive geometry, cant, topology, or engineering change.

### EN 13803:2017

Strong support:

- track alignment design parameters are railway-specific;
- limits are functions of speed;
- permissible speed can be determined for a given alignment;
- switches/crossings and high cant-deficiency vehicles are within scope.

Limit:

- the full normative text is not openly available in this mission, so detailed
  formulas are not restated.

### UIC RailTopoModel / RailSystemModel

Strong support:

- usage-agnostic, multi-level railway topology;
- separate positioning/location concepts;
- design, construction, operation, and maintenance ambitions.

Limit:

- UIC itself reports early RTM use cases as more asset-management-oriented than
  design/operations planning; topology is necessary but not sufficient.

## 9. ufAIM confrontation

### Already aligned

- intrinsic `s`, ordered elements, curvature law, and derived pose are already
  separated in the active Alignment identity candidate and horizontal Core;
- operational `staEq` is explicitly excluded from intrinsic identity;
- realization concepts separate CRS/context from identity;
- evaluation concepts separate candidates, constraints, proposals, decisions,
  solver independence, sufficiency, and material consequence;
- current App-Core work has a first topology module and explicit
  local-cartesian placement state;
- import research preserves uncertain CRS/cant/station evidence rather than
  silently promoting it.

### Positive synthesis proposed

The nucleus is the smallest **serviceable aggregate boundary** around these
separated concepts. It does not claim that all responsibilities are identity.
Its invariant is coordination by intrinsic location, identity, revision, and
qualified relations.

### Observed gaps

1. horizontal Core is materially ahead of vertical and cant Core;
2. common-domain composition and spatial frame transport are not complete;
3. chainage/kilometre mapping lacks a complete typed, multi-valued service;
4. topology exists as an initial module but geometric connection and
   traversability remain separate unfinished responsibilities;
5. vertical reference and mixed-CRS transformation provenance remain limited;
6. speed-qualified evaluation is not yet a complete Core service;
7. AXTRAN edit problem declarations and consequence graphs are incomplete
   across horizontal/vertical/cant;
8. lossless state, immutable revision lineage, and reopen/recalculate
   equivalence are not proven;
9. cross-language Core boundary remains to be demonstrated;
10. the Kernel has an Alignment identity candidate, not yet an approved
    complete working-aggregate concept.

## 10. Universal knowledge, ufAIM synthesis, and open gaps

| Topic | Universal/domain-established | ufAIM synthesis candidate | Open gap |
|---|---|---|---|
| constructive geometry | H/V/cant are distinct coordinated railway layouts | one curvature-aware intrinsic spine coordinates all laws | exact shared-domain and frame contract |
| chainage | linear reference differs from geometry; railway jumps exist | typed multi-valued `s ↔ address` service | full national/temporal rule evidence |
| topology | railway networks need multi-level nodes/edges/referencing | constructive endpoint ports linked without identity collapse | switches, routes, traversability |
| CRS/world | engineering geometry and georeferencing are separable | explicit local-only or qualified-world status is mandatory | vertical datum/transformation provenance |
| speed/dynamics | speed, radius, cant, deficiency, and rates are coupled | speed outside identity but inside work aggregate | rule/vehicle applicability service |
| editability | design uses parameters, conditions, calculation, alternatives | AXTRAN problem/result contract across all laws | complete dependency graph and identity survival |
| persistence | lifecycle use requires durable, interpretable records | lossless snapshot plus immutable revision and ports | proven roundtrip/cross-language equivalence |
| authority | calculation is not accountable approval | explicit non-promotion from solver/evidence to decision | workflow integration without identity leakage |

## 11. Confidence

- High: the necessity and separation of H/V/cant, operational linear
  referencing, topology, CRS realization, and speed-qualified evaluation.
- Medium-high: the four-part nucleus as the smallest usable aggregate.
- Medium: mandatory explicit zero/unknown/local/standalone states as the best
  minimal-completeness rule.
- Medium-low: exact identity persistence and revision semantics, because these
  require engineering/Governance decisions and implementation experiments.

## 12. Candidate definition

For review, not approval:

> A work-capable Railway Alignment is a versioned engineering aggregate whose
> directed intrinsic longitudinal domain coordinates horizontal, vertical, and
> cant construction; whose operational addresses, network participation, and
> world realization remain qualified relations; whose speed and dynamics are
> purpose-relative evaluations; and whose constrained changes and persistence
> preserve reviewable engineering meaning.
