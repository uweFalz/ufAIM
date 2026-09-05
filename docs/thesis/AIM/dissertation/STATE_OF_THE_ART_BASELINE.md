# AIM Dissertation State-of-the-Art Baseline

## Purpose and method

This DISS-03 working document tests the research and contribution contract in
`RESEARCH_QUESTIONS_AND_CONTRIBUTIONS.md` against primary sources: official
standards, normative specifications and original research publications. It is
not a systematic-review claim. Searches were directed at the strongest known
counterexamples to each novelty claim. Absence from this bounded baseline is
not evidence of absence.

The result labels mean:

- `survives`: no located source defeats the stated novelty boundary;
- `survives with reformulation`: prior art defeats the broad wording, but a
  narrower, testable integration claim remains;
- `eliminated`: the item is not defensible as an independent novelty claim.

## Primary-source register

| ID | Primary or official source | Established capability relevant to AIM |
|---|---|---|
| S01 | W3C, [PROV-O: The PROV Ontology](https://www.w3.org/TR/2013/REC-prov-o-20130430/), Recommendation, 30 April 2013 | Interoperable provenance through entities, activities, agents and qualified relations. |
| S02 | W3C, [Shapes Constraint Language (SHACL)](https://www.w3.org/TR/shacl/), Recommendation, 20 July 2017 | Machine-executable constraints over data and shapes graphs, with conformance and validation reports. |
| S03 | buildingSMART, [Information Delivery Specification 1.0](https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/), approved standard, 1 June 2024 | Machine-interpretable information requirements and automated IFC compliance checking. |
| S04 | buildingSMART, [IfcAlignment](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignment.htm), IFC 4.3.2.0 | Horizontal, vertical and cant layouts; distance-along organization; referents for station or mileage. |
| S05 | buildingSMART, [IfcAlignmentCantSegment](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignmentCantSegment.htm), IFC 4.3.2.0 | Cant segments parameterized by distance along horizontal alignment and rail-height quantities. |
| S06 | OGC, [Land and Infrastructure Conceptual Model Standard 1.0](https://docs.ogc.org/is/15-111r1/15-111r1.html), OGC 15-111r1, 2016 | Alignment positioning, linear referencing, horizontal/vertical segment models and explicit CRS context. |
| S07 | OGC, [InfraGML Part 3 — Alignments](https://docs.ogc.org/is/16-103r2/16-103r2.html), OGC 16-103r2, 2017 | XML encoding of the LandInfra alignment model. |
| S08 | ISO, [ISO 19148:2021 Geographic information — Linear referencing](https://www.iso.org/standard/75150.html), 2nd ed., April 2021 | Conceptual schema for positions measured along a one-dimensional object, optionally with offset. |
| S09 | ISO, [ISO 23054-1:2022 Railway applications — Track geometry quality — Part 1](https://www.iso.org/standard/74457.html), 2022 | Track-geometry parameters, measurement requirements and evaluation methods. |
| S10 | W. Koc, [Design of Rail-Track Geometric Systems by Satellite Measurement](https://doi.org/10.1061/(ASCE)TE.1943-5436.0000303), *Journal of Transportation Engineering* 138(1), 2012, 114–122 | Original reconstruction/design method using measured railway geometry. |
| S11 | W. Koc, [Analytical Method of Modelling the Geometric System of Communication Route](https://doi.org/10.1155/2014/679817), *Mathematical Problems in Engineering*, 2014, Article 679817 | Curvature-based route modelling and analogous modelling of rail superelevation ramps. |
| S12 | K. Zboinski and P. Woznica, [Combined use of dynamical simulation and optimisation to form railway transition curves](https://doi.org/10.1080/00423114.2017.1421315), *Vehicle System Dynamics* 56(9), 2018, 1394–1450 | Transition-curve candidate formation by coupled vehicle-track simulation and optimisation. |
| S13 | A. R. Hevner, S. T. March, J. Park and S. Ram, [Design Science in Information Systems Research](https://aisel.aisnet.org/misq/vol28/iss1/6/), *MIS Quarterly* 28(1), 2004, 75–105, DOI 10.2307/25148625 | Construction and evaluation of purposeful artefacts as an established research method. |
| S14 | ACM, [Artifact Review and Badging](https://www.acm.org/publications/policies/artifact-review-and-badging-current) | Established criteria for available, functional and reusable artefacts and independently validated results. |

## Research-question baseline

| Research question | Strongest prior capability and counterevidence | Remaining research gap that may be tested | Baseline consequence |
|---|---|---|---|
| RQ1 — identity and responsibility | PROV-O already distinguishes entities, activities and agents and qualifies derivation and attribution (S01). IFC already gives Alignment objects identity, decomposition and typed relations (S04). | An Alignment-specific operational separation of durable identity/revision from construction, realization, representation, observation, evaluation and decision, demonstrated across consequential change and semantic reopen. | Do not claim general identity or provenance theory. Test the narrower responsibility boundary and continuity trace. |
| RQ2 — executable bounded knowledge | SHACL executes constraints and produces explicit conformance reports (S02); IDS makes IFC information requirements machine-interpretable and checkable (S03). Optimisation already generates transition candidates (S12). | An Alignment-wide contract that combines applicability, assumptions, residuals and explicit non-authority, and prevents candidate generation or evaluation from becoming admission, approval or persistence. | Do not claim executable constraints, rule checking or solvers as new. Test the authority boundary and terminal outcomes. |
| RQ3 — intrinsic composition and realization | IFC 4.3 already combines horizontal, vertical and cant layouts by distance along the horizontal alignment (S04–S05). LandInfra and ISO 19148 provide alignment positioning and linear referencing (S06–S08). Koc models route curvature and rail superelevation ramps (S11). | Separately authoritative left/right rail laws; strictly derived midpoint, cross-level and common offset; explicit separation of intrinsic position, operational chainage and qualified realization; meaning-preserving reopen of the combined state. | The broad shared-longitudinal-reference claim is prior art. Test only the narrower responsibility-preserving composition. |
| RQ4 — epistemic preservation | PROV represents provenance (S01); SHACL and IDS preserve validation results rather than merely parsing data (S02–S03); IFC supplies exchange structures (S04–S05). | An end-to-end railway workflow that retains accepted, rejected, ambiguous and unsupported evidence status through admission, consequential edit, review, persistence and semantic reopen without silent promotion. | Do not claim provenance, validation reports or exchange alone as new. Test preservation across the complete workflow. |

## Novelty stress test

### C1 — Alignment-specific responsibility and identity model

**Counterevidence.** PROV-O already supplies typed provenance relations and IFC
already supplies identified Alignment objects and decomposition (S01, S04).
Those sources eliminate any claim to general typed identity, lineage or
provenance.

**Result: `survives with reformulation`.** The candidate novelty is the
Alignment-specific, executable separation of identity/revision from six
engineering responsibilities, plus evidence that the distinction survives a
consequential edit and semantic reopen. It survives only if comparison and the
case study show that this exact responsibility partition and preservation
contract are not merely a relabelling of PROV and IFC.

### C2 — Executable knowledge-contract method

**Counterevidence.** SHACL already makes constraints executable and emits
validation results; IDS already supports automated compliance checking of
machine-readable information requirements; transition optimisation already
produces numerical candidates (S02, S03, S12).

**Result: `survives with reformulation`.** Remove generic novelty language
about executable knowledge, rules or solvers. The remaining candidate is a
domain-specific contract combining applicability, declared assumptions,
residuals, terminal outcomes and non-authority, with an enforceable separation
between candidate, evaluation, governed decision, apply and persistence.

### C3 — Intrinsic multi-band constructive model

**Counterevidence.** IFC 4.3 explicitly coordinates horizontal, vertical and
cant layouts along a horizontal distance parameter; LandInfra and ISO 19148
already establish alignment positioning and linear referencing; Koc already
uses curvature and models superelevation as rail-height difference (S04–S08,
S11). These sources defeat the broad claim that a shared longitudinal parameter
or combined horizontal/vertical/cant model is new.

**Result: `survives with further reformulation` — decided (`DISS-04-DECISION-001`, Option A, approved by Uwe Falz on 2026-09-05).** C3 is
retained as a responsibility-and-preservation claim: explicit authoritative
left/right rail laws, derived-only midpoint/cross-level/common-offset
quantities, and strict boundaries between intrinsic position, chainage,
identity and qualified realization, including lossless semantic reopen. IFC
4.3.2 already stores explicit left/right cant endpoints per segment, so no
novelty is claimed for the data model itself. Each component and the
integration must be evidenced in DISS-05; otherwise C3 is reduced to
implementation synthesis (`DISS-04-RISK-001`).

### C4 — Fail-closed admission and epistemic-state workflow

**Counterevidence.** PROV already records provenance; SHACL distinguishes
conformance, violations and validation failure; IDS supports automated
information compliance (S01–S03). Fail-visible validation is therefore not a
new general technique.

**Result: `survives with reformulation`.** The remaining candidate is the
preservation of railway evidence status through the whole causal chain:
source inventory, admission, consequential Alignment change, synchronized
review, persistence and reopen. The claim fails if any rejected, unresolved or
unsupported item disappears or is silently promoted.

### C5 — Reproducible reference realization and validation protocol

**Counterevidence.** Design-science research already treats artefact construction
and evaluation as its core method (S13). ACM artefact review already defines
availability, functionality, reusability and results-validation criteria (S14).

**Result: `eliminated`.** C5 is not an independent scientific novelty claim.
It remains mandatory as the dissertation's research method and evidence
protocol: a versioned implementation, executable tests, real-data case,
negative cases and reproducible semantic comparison. It may support C1–C4 but
must not be counted as a fifth novelty contribution.

## Revised contribution set after DISS-03

The defensible provisional contribution set contains four conditional claims:

1. Alignment-specific responsibility and identity preservation;
2. authority-bounded Alignment knowledge contracts;
3. responsibility-preserving intrinsic composition with explicit rail-pair
   authority and qualified realization;
4. end-to-end preservation of epistemic state in Alignment knowledge work.

All four remain conditional on DISS-04 mathematical closure, the real-data
validation case and a critical discussion of generalizability. C5 becomes the
cross-cutting validation method. None of these results changes approved Kernel
meaning.

## Coverage limits and next search obligations

- This is a targeted primary-source baseline, not a complete systematic review.
- DISS-04 or a dedicated related-work package must search original digital-twin,
  model-based systems engineering, railway asset-information and semantic
  roundtrip work for closer responsibility-model counterexamples.
- Full standard texts behind licensed ISO access were not reproduced; only
  official catalogue scope and metadata were used for S08 and S09.
- The dissertation bibliography must be updated only after the currently
  foreign-owned `references.bib` is released and each entry is checked against
  the source register.
