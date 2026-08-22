# Evidence and Counterexample Matrix

## 1. Evidence classes

- `P`: primary historic or current institutional source;
- `N`: current normative-standard metadata or official standard text;
- `K`: active Knowledge Kernel candidate/canonical boundary;
- `R`: prior ufAIM Research;
- `I`: current RefImpl observation;
- `X`: counterexample test/inference.

Access date for web sources: `2026-07-26`.

## 2. Source ledger

| ID | Class | Source | Relevant evidence | Limitation |
|---|---|---|---|---|
| EV-01 | P/R | Simms, *A Treatise on the Principles and Practice of Levelling*, 1866, pp. 121–159; catalogued in HISTORY-003 | levelling, profile, curve setting-out and field computation formed one practical task | edition-specific page verification remains as recorded in HISTORY-003 |
| EV-02 | P/R | Talbot, *The Railway Transition Spiral*, 1904, pp. 5–54, 74–119 | curvature transition, field construction, tables, speed/cant relation | historic assumptions are not current limits |
| EV-03 | P/R | Schramm, *Der Gleisbogen*, 2nd ed., 1954, esp. pp. 1–77, 117–221 | railway synthesis of curvature, cant, transition, acceleration and setting-out | full modern applicability not claimed |
| EV-04 | P/R | ÖBB B 50 Teil 2, 2004, inspected pages recorded in HISTORY-002 | separate alignment elements, cant/speed/rate limits, computation and measurement | ÖBB, not DB; public resolver still needed |
| EV-05 | N | DIN EN 13803:2017-09 metadata, DOI `10.31030/2534083` | alignment limits depend on speed; inverse permissible-speed determination; switches/crossings included | normative text paywalled; no formula claims made here |
| EV-06 | N | [ISO 19148:2021](https://www.iso.org/standard/75150.html), ed. 2, 99 pp. | conceptual schema and operations for location as measure/offset relative to a 1D object | generic, not railway-specific |
| EV-07 | N | [OGC LandInfra 15-111r1](https://docs.ogc.org/is/15-111r1/15-111r1.html), 2016 | separate Alignment, Railway, Survey and referencing concepts; transition and vertical elements | does not prescribe full workbench behavior |
| EV-08 | N | [OGC InfraGML Part 3 Alignments](https://docs.ogc.org/is/16-103r2/16-103r2.html), 2017 | encoded horizontal/vertical alignment element structures | encoding is not constructive-edit contract |
| EV-09 | N | [OGC InfraGML Part 5 Railways](https://docs.ogc.org/is/16-105r2/16-105r2.html), 2017 | RailwayElement, CantEvent, CantSpecification, Alignment relation, kilometre example | cant event model is simpler than all railway ramp laws |
| EV-10 | N | [IFC 4.3.2.0 IfcAlignment](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignment.htm) | business logic separated from geometry; horizontal, vertical, cant layouts; design-speed/cant-deficiency anchor | exchange schema is not whole application state |
| EV-11 | N | [IFC 4.3.2.0 alignment geometry](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/concepts/Product_Shape/Product_Geometric_Representation/Alignment_Geometry/content.html) | composite, gradient, and segmented-reference curves distinguish H, H+V, H+V+C realization | representation conformance does not prove editability |
| EV-12 | N | [IFC 4.3.2.0 IfcAlignmentCant](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignmentCant.htm) | cant is a separate lateral-inclination profile along horizontal alignment; exceptions and ramp relations exist | current IFC modeling priorities/process coverage vary |
| EV-13 | N | [UIC IRS 30100 RailTopoModel](https://shop.uic.org/en/303-finance-accountancy-costs-statistics/8884-railtopomodel-railway-infrastructure-topological-model.html), ed. 1, 2016, 80 pp. | scalable topology, railway objects, referencing and positioning for lifecycle use | not a constructive geometry solver |
| EV-14 | N | [UIC RailSystemModel/RTM 1.1 archive](https://img0.uic.org/rail-system/railsystemmodel), 2017 | multi-purpose network model and published topology/location packages | historical RTM page; current RSM requires separate future review |
| EV-15 | N | [ERA RINF](https://www.era.europa.eu/da/node/1088) and [RINF system](https://rinf.data.era.europa.eu/) | operational points, sections of line, network parameters and route compatibility are network/application concerns | RINF is not an alignment design model |
| EV-16 | K | `docs/knowledgeKernel/IDENTITY/KC-ID-004_Alignment_Identity.md` | intrinsic domain, ordered sequence, curvature evolution; excludes CRS and operational kilometre | status is `candidate`; narrower than working aggregate |
| EV-17 | K | `docs/knowledgeKernel/REALIZATION/` | metric realization, context, World-to-Track and Track-to-World are distinct from identity | result schemas and ambiguity policy remain open |
| EV-18 | K | `docs/knowledgeKernel/EVALUATION/` | constraints, candidates, proposals, decisions, solver independence and sufficiency are separated | does not yet define the full Alignment service aggregate |
| EV-19 | R | `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_001/STUDY.md` | historical expansion from setting-out line to speed-dependent, referenced network object | broad international gaps remain |
| EV-20 | R | `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_002/GERMAN_RULES_STATIONING_COMPUTATION.md` | German rule/computation history and operational kilometre discontinuity | Ril genealogy/current status remains incomplete |
| EV-21 | I | `src/domain/alignment/editor/buildSparseAlignment.js` at baseline | editable horizontal sequence, AXTRAN construction, intrinsic `s`; explicitly no profile/cant/CRS | current implementation correspondence only |
| EV-22 | I | `src/domain/alignment/topology/TrackNetworkTopology.js` at baseline | first browser-independent topology boundary with nodes/edges | initial topology slice, not complete network semantics |
| EV-23 | I | `src/domain/alignment/editor/createEmptyAlignmentData.js` at baseline | stable local object ID, local-cartesian placement, editable intent | persistence/revision and full H/V/C state incomplete |

## 3. Claim matrix

| Claim | Evidence | Result | Confidence |
|---|---|---|---|
| A working railway Alignment needs a directed intrinsic longitudinal domain. | EV-01, EV-02, EV-06, EV-10, EV-16, EV-21 | supported | high |
| Horizontal, vertical, and cant must remain separate constructive laws. | EV-03–EV-05, EV-07–EV-12 | supported | high |
| Explicit zero and unknown are semantically different. | EV-04, EV-10–EV-12, X-C1/X-C2 | supported inference | medium-high |
| Operational chainage is not intrinsic distance. | EV-06, EV-09, EV-16, EV-19, EV-20 | supported | high |
| Topology is necessary to participate in a railway network but does not define geometry. | EV-07, EV-09, EV-13–EV-15, EV-22 | supported | high |
| CRS is a realization relation, not Alignment identity. | EV-07, EV-10, EV-16, EV-17, EV-23 | supported | high |
| Speed is not intrinsic geometry but is required for railway sufficiency. | EV-02–EV-05, EV-10, EV-12, EV-18 | supported | high |
| A sample or exchange geometry is insufficient for constructive editing. | EV-08, EV-10, EV-11, EV-21, X-C1/X-C2 | supported | high |
| Lossless persistence needs schema, units, lineage, provenance and behavioral equivalence. | EV-10, EV-13, EV-18, X-C7 | plausible synthesis | medium |
| The four-part PRAN is the smallest complete aggregate. | all plus removal tests | survives with reformulation | medium-high |

## 4. Counterexample tests

| ID | Candidate claimed as “Alignment” | Passes | Fails | Verdict |
|---|---|---|---|---|
| X-C1 | 3D polyline + CRS | view, approximate measure, world display | construction, cant intent, constraints, consequential edit | realization only |
| X-C2 | IFC H/V/C file | rich exchange, layouts, derived axis | necessarily complete chainage, topology, revision, solver/decision contract | major carrier, not whole nucleus |
| X-C3 | kilometre line/table | operational location | constructive geometry and dynamics | address relation only |
| X-C4 | RTM/RSM edge | connectivity and location framework | precise constructive H/V/C law | topology/reference only |
| X-C5 | horizontal AXTRAN object | curvature construction and pose | vertical, cant, chainage, network, full persistence | incomplete working slice |
| X-C6 | EN-checked parameter set | rule-relative evaluation | identity, construction, world placement, revision | evaluation only |
| X-C7 | serialized runtime graph | byte/key recovery | semantic/version/behavioral equivalence | storage is not proven persistence |
| X-C8 | one universal record | apparent completeness | role separation and independent revision | over-coupled anti-nucleus |

## 5. Negative findings

1. No inspected standard was found that alone defines the complete constructive,
   editable, persistent, topology-aware, chainage-aware, georeferenced, and
   speed-qualified railway Alignment work unit.
2. No evidence supports making speed, CRS, operational kilometre, observation,
   or approval part of intrinsic Alignment identity.
3. No evidence supports treating missing vertical geometry or cant as silently
   zero.
4. No evidence supports equating successful serialization, solver convergence,
   or standards conformance with accountable engineering approval.
5. The mission did not obtain the full EN 13803 normative text and therefore
   makes no page/formula-level normative claim beyond official metadata.

## 6. Source stability

Institutional URLs are preferred. HISTORY-003 already contains patch-ready
bibliographic records for ISO, OGC, UIC, IFC, EN 13803, historic books, and
German rules. A later Thesis package should reuse that transfer rather than
invent duplicate citation IDs.
