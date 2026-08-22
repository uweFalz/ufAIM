# Evidence Ledger

Access date for web sources: `2026-07-26`.

## 1. Primary institutional sources

### EV2-01 — IFC vertical segments

Source:
[buildingSMART, IfcAlignmentVerticalSegment](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignmentVerticalSegment.htm),
IFC 4.3.2.0.

Verified support:

- vertical segments are defined in distance-along/height space;
- distance along and segment length refer to horizontal Alignment length;
- start height, start gradient and family parameters are primary;
- line, circular, parabolic and clothoid families are distinguished;
- derived endpoint information is intentionally not redundantly exchanged.

Limitation:

IFC exchange semantics do not by themselves define ufAIM edit or identity
policy.

### EV2-02 — IFC vertical family mathematics

Source:
[buildingSMART, IfcAlignmentVerticalSegmentTypeEnum](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignmentVerticalSegmentTypeEnum.htm),
IFC 4.3.2.

Verified support:

- parabolic vertical curve: constant derivative of gradient with respect to
  horizontal distance along;
- circular vertical curve: constant derivative of vertical angle with respect
  to 3D arc length;
- chainage is described as longitudinal distance along the horizontal
  projection;
- small-angle practice is noted, but the definitions remain distinct.

This is direct evidence that parabolic and circular vertical laws are
non-equivalent mathematical models.

### EV2-03 — IFC cant segment

Source:
[buildingSMART, IfcAlignmentCantSegment](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignmentCantSegment.htm),
IFC 4.3.2.

Verified support:

- cant is defined along distance on the horizontal Alignment;
- left and right start/end cant values are separately represented relative to
  the vertical Alignment;
- continuity information is explicit;
- Bloss, constant, cosine, Helmert, linear, sine and Viennese families are
  distinguished.

### EV2-04 — IFC cant and rail-head distance

Sources:

- [IfcAlignmentCant](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignmentCant.htm)
- [IfcAlignmentCantSegmentTypeEnum](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignmentCantSegmentTypeEnum.htm)

Verified support:

- cant is a lateral inclination profile;
- rail-head distance is the distance between nominal contact-patch centres;
- cant angle is related to cant difference and rail-head distance;
- higher-performance cant transition families have distinct interior laws.

### EV2-05 — OGC LandInfra cant

Source:
[OGC 15-111r1 LandInfra Conceptual Model](https://docs.ogc.org/is/15-111r1/15-111r1.html),
2016, clauses 7.7.5.1–7.7.5.2.

Verified support:

- a CantSpecification belongs along one linear element;
- it has gauge and ordered CantEvents;
- applied cant is rail elevation difference;
- cant side is defined relative to the positive direction of the linear
  element;
- equal/different successive event values create constant/linear intervals.

Limitation:

The event model does not cover every advanced cant family.

### EV2-06 — IFC common Alignment structure

Source:
[buildingSMART, IfcAlignment](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignment.htm),
IFC 4.3.2.0.

Verified support:

- horizontal, vertical and cant layouts are separate;
- vertical and cant layouts are defined along the horizontal layout;
- business logic and geometry are separable;
- legacy and approximate geometry require qualified interpretation.

### EV2-07 — EN 13803 metadata

Source:
[DIN EN 13803:2017-09 metadata](https://www.dinmedia.de/en/standard/din-en-13803/256505017).

Verified support:

- standard scope is railway track alignment parameters;
- speed and permissible-speed reciprocity;
- current metadata and 103-page extent.

Limitation:

Full normative text was not lawfully accessible in this mission. Detailed
formula claims rely only on the buildingSMART page’s explicit attribution to EN
13803 and are not presented as independent normative verification.

## 2. ufAIM evidence

### EV2-08 — GAP-001

`docs/knowledgeKernel/research/RESEARCH_ALIGNMENT_GAP_001/`

Supports the positive nucleus, zero/unknown distinction, common domain need,
and persistence gap.

### EV2-09 — Active Alignment identity candidate

`docs/knowledgeKernel/IDENTITY/KC-ID-004_Alignment_Identity.md`

Supports intrinsic longitudinal parameterization, ordered construction and
curvature evolution while excluding operational kilometre and CRS.

Status limitation: `candidate`.

### EV2-10 — Current horizontal Core correspondence

`src/domain/alignment/editor/buildSparseAlignment.js` at baseline
`5c7a99be086fdf38ce189035a61553239c242ae6`.

Observed:

- ordered horizontal elements and intrinsic `s`;
- start pose and curvature-family construction;
- explicit statement that profile and cant are unsupported.

This is implementation-gap evidence, not architectural authority.

### EV2-11 — History packages

- `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_001/`
- `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_002/`
- `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_003/`

Support the historical coexistence of vertical profiles, cant/ramp families,
speed evaluation, calculation aids and operational addressing.

## 3. Derived mathematical checks

### MC-01

From `g=dz/dσ`, `θ=atan g`, and `dℓ/dσ=sqrt(1+g²)`:

```text
dθ/dℓ = (dg/dσ)/(1+g²)^(3/2)
```

Result: parabolic constant `dg/dσ` does not imply constant spatial curvature.

### MC-02

For cant pair:

```text
D = cR-cL
```

Adding the same offset to both rails leaves `D` invariant.

Result: scalar cant cannot uniquely realize both rail elevations.

### MC-03

For finite query witness set, two different analytic functions can interpolate
the same witnesses.

Result: sample equality cannot prove constructive or edit equivalence.

### MC-04

If a migration maps missing to zero, a query changes from `Unknown` to
`Known(0)` without source evidence.

Result: parse success can coincide with semantic loss.

## 4. Evidence limitations

- No proprietary DB Ril 800 formulas were copied or inferred.
- No full EN 13803 text was obtained.
- Rail reference/datum practice varies by organization and remains a genuine
  decision for native ufAIM creation.
- Persistence bisimulation is a Research contract derived from software
  semantics; it is not claimed as an existing railway standard.
