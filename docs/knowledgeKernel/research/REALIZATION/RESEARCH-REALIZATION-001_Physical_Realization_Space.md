# RESEARCH-REALIZATION-001 Physical Realization Space

## Status

Research finding; not approved Kernel content.

## Research Question

What enduring engineering question, if any, requires a concept named or currently represented as `Physical Realization Space`?

## Outcome

`supported with reformulation`

The enduring concept is **Physical Realization**, a relational/process concept connecting an intended engineering state to a physically produced or maintained asset state. The evidence does not support **Physical Realization Space** as a fundamental space, container, metric domain, or coordinate domain.

If promoted by a later Governance mission, the concept should be reformulated and renamed rather than defining the current target name by force. It survives as a relational concept, not as Identity, a context, a representation, or a state container.

## Strongest Defensible Definition

Physical Realization is the construction- and maintenance-mediated relation or process by which an intended engineering state is instantiated in a physical asset and gives rise to time-indexed physical states subject to material, construction, environmental, operational, and maintenance effects.

This is a Research candidate definition. It does not approve a Kernel entry.

## Canonical Question Candidate

How is an intended engineering state related to the physically produced or maintained asset and its time-indexed physical states?

## Definition Test

### Search method

Case-insensitive exact-term and adjacent-term searches were run over `research/`, `_draft/`, Thesis, App, and `src/` for:

- `Physical Realization Space`
- `physical realization`
- `realized asset`
- `realized state`
- `observed state`
- `physical state`

Generated Thesis index files and vendored/minified code were excluded from semantic interpretation.

### Observed uses

| Source group | Observed wording | Intended meaning | Assessment |
|---|---|---|---|
| [`foundations/kernel_glossary.tex`](../../../thesis/AIM/foundations/kernel_glossary.tex) | “Physical Realization Space” | physical space in which an object is materially or geometrically realized | Isolated glossary assertion; does not distinguish physical existence from metric or coordinate space |
| [`reality/construction_and_realization.tex`](../../../thesis/AIM/reality/construction_and_realization.tex) | physical realization, realized state, realization operator | process/relation from target state to physically built state under construction and maintenance constraints | Coherent relational/process meaning |
| [`foundations/ontology.tex`](../../../thesis/AIM/foundations/ontology.tex) | engineering intent becomes physical infrastructure | construction reality, distinct from metric realization and Identity | Coherent relational meaning |
| [`foundations/system_layers.tex`](../../../thesis/AIM/foundations/system_layers.tex), [`foundations/operators.tex`](../../../thesis/AIM/foundations/operators.tex) | target state to realized state | operator/layer | Coherent derived-process model |
| [`foundations/state_model.tex`](../../../thesis/AIM/foundations/state_model.tex), [`state/state_taxonomy.tex`](../../../thesis/AIM/state/state_taxonomy.tex) | realized state | state description or runtime state based on physically realized geometry | State meaning, not a space |
| [`reality/measurement_and_imperfect_data.tex`](../../../thesis/AIM/reality/measurement_and_imperfect_data.tex) | observations as evidence for realized infrastructure/state | observation and uncertainty | Observation is evidence, not physical state or asset |
| Research, drafts, App, and `src/` | no substantive principal-term occurrence found | none | No independent definition or implementation contract |

### Finding

Observed Thesis usage supports a Physical Realization relation and realized physical states. Only the glossary supports the exact “Space” name, and it supplies no independent responsibility that is not already Metric Space, world/coordinate domain, Physical Asset, or Physical State. The glossary is explanatory evidence, not authority.

## Required Distinctions

| Term | Responsibility retained in this analysis |
|---|---|
| Engineering Object Identity | Durable sameness of the engineering object; not created by construction, coordinates, or observation |
| Constructive Definition | Intended engineering structure and state to be physically instantiated |
| Metric Realization | Measurable spatial interpretation of an intrinsic definition |
| Physical Asset | The materially existing bearer produced, modified, or maintained |
| Physical State | Time-indexed condition of a physical asset |
| Observed State | State estimate or record obtained through observation and interpretation |
| Observation | Evidence-producing act or record with provenance and uncertainty |
| Representation | Encoded, displayed, or exchanged form of information |
| Metric Space | Structure enabling metric quantities and operations |
| Realization Context | Dependencies needed to interpret a metric realization |
| World Coordinates | Coordinate expression of realized or observed spatial information |

Physical Realization relates Constructive Definition, Physical Asset, and Physical State. It owns none of their identities and does not absorb Observation, Representation, Metric Space, Realization Context, or coordinates.

## Independence Test

| Attempted reduction | What it preserves | What is lost |
|---|---|---|
| Metric Realization | measurable interpretation of intended and physical states | material existence, construction/maintenance causation, and target-to-built deviation |
| Metric Space | quantitative comparison and distance | which asset exists, how it was produced, and how its state changes |
| Realization Context | dependencies for interpreting metric quantities | physical production and the target-to-asset/state relation |
| Engineering Observation | evidence about an asset or state | unobserved physical existence and the construction/maintenance process |
| State | a condition at one time | relation from intent to asset, causal process, and state history |
| Representation | communication or encoding of a state | physical existence, truth, causation, and representation-independent state |
| Physical Asset | enduring material bearer | target-to-built relation and time-indexed conditions of that bearer |

### Independence finding

The concept cannot be reduced without loss to any single existing responsibility. The irreducible capability is the relation/process connecting intended state to physically produced or maintained asset states. No independent “space” responsibility survives.

## Subtraction Test

### Remove Physical Realization Space

No engineering question becomes unanswerable if the word **Space** is removed. Metric Space, Realization Context, world coordinates, Physical Asset, and Physical State already cover the plausible meanings of a space or domain.

### Remove Physical Realization entirely

The following questions lose an explicit owner and require reintroducing an equivalent relation:

- How did an intended state become a built or maintained asset state?
- Which construction, material, environmental, operational, or maintenance effects explain target-to-physical deviation?
- How can multiple physical instantiations relate to one constructive definition without sharing one physical identity?
- How do physical states evolve while the asset remains the same asset?

### Subtraction finding

`Physical Realization Space` is unnecessary; `Physical Realization` is necessary as a relational/process concept unless another later concept explicitly assumes that responsibility.

## Counterexample Test

1. **One constructive definition, multiple physical realizations.** Two bridge spans or manufactured rails built from the same design are distinct physical assets with differing tolerances. Constructive Definition and Metric Realization alone do not express their production relation or distinct material existence. The reformulated concept survives.
2. **One physical asset, changing states.** A track alignment settles, wears, is tamped, and changes temperature while remaining the same asset. Asset Identity cannot be equated with any one Physical State. The reformulated concept survives as the relation and history of produced/maintained states.
3. **One physical state, multiple observations.** Total station, laser scan, inertial measurement, and inspection records may observe the same state with different uncertainty and bias. Observation cannot replace Physical State. The reformulated concept survives.
4. **One observation, multiple representations.** A survey observation may be stored as source records, transformed coordinates, a point cloud, a report, and a rendered overlay. FC-001 prevents these forms from becoming Identity or physical reality. The reformulated concept survives.
5. **Metric realization without a constructed asset.** A proposed tunnel alignment can be metrically evaluated before construction. Therefore Metric Realization does not imply Physical Realization or Physical Asset existence. The reformulated concept survives.
6. **Constructed asset differs from intended geometry.** A built track contains tolerances, settlement, and maintenance corrections. Intended and observed geometry cannot be collapsed into one state. The reformulated concept survives.
7. **One asset represented in multiple coordinate systems.** The same bridge or track can be expressed in engineering CRS, national CRS, local frames, and display coordinates. World coordinates and Metric Space do not own Physical Asset Identity. The reformulated concept survives.

### Failed counterexamples

None of the required counterexamples defeats the Physical Realization relation. All defeat at least one interpretation of `Physical Realization Space` as a metric space, coordinate domain, state container, or synonym for Physical Asset.

## Boundary Test

| Candidate responsibility | Owned intrinsically? | Reason |
|---|---|---|
| Identity | No | Identity precedes and survives changes in realization under FC-002 |
| Existence | No | Physical Asset owns material existence; realization relates production/maintenance to it |
| Physical state | No | Physical State is a time-indexed result or condition, not the relation itself |
| Spatial extent | No | Extent is a property of a state under metric interpretation |
| Metric coordinates | No | Metric Realization, Metric Space, context, and representation govern coordinate expression |
| Uncertainty | No | Construction variability may influence results; observation uncertainty belongs to Observation |
| Time | No | Time indexes state and process; it is not owned exclusively by realization |
| Observation | No | Observation provides evidence about physical state |

The concept intrinsically owns only the target-to-physical production or maintenance relation/process and its stated applicability.

## Cross-Domain Test

- **Buildings:** one design can yield multiple buildings; each building changes state and has many surveys or BIM representations.
- **Machines:** one specification can yield multiple machines whose wear and calibration histories differ.
- **Manufactured components:** nominal CAD geometry relates to produced components with tolerances and material deviations.
- **Infrastructure assets:** roads, bridges, tunnels, and utilities distinguish intended, as-built, maintained, and observed states.
- **Scientific measurement:** a prepared physical specimen has states that observations estimate through multiple instruments and representations.

The target-to-physical relation transfers across domains. Railway stationing or alignment geometry is not required, so the surviving concept is not railway-specific.

## Naming Test

| Name | Assessment |
|---|---|
| Physical Realization Space | Reject; “space” suggests a container, Metric Space, or coordinate domain not supported by evidence |
| Physical Realization | Preferred; matches the enduring process/relation and dominant Thesis usage |
| Realized Asset | Useful adjacent concept, but names the material bearer rather than the target-to-physical relation |
| Physical State | Useful adjacent concept, but names a time-indexed condition rather than the process/relation |
| Realization Domain | Too ambiguous; could mean applicability domain, codomain, or repository area |
| Physical Existence | Too broad; collapses existence and realization |

The recommendation to rename is evidence-driven: the exact current name is isolated, while “Physical Realization” is repeatedly used for the coherent relation/process.

## Relations to Existing Concepts

- Must remain distinct from [`KC-REALIZATION-001 Metric Realization`](../../REALIZATION/KC-REALIZATION-001_Metric_Realization.md) and [`KC-REALIZATION-002 Metric Space`](../../REALIZATION/KC-REALIZATION-002_Metric_Space.md).
- Consumes an intended Constructive Definition without redefining [`Engineering Object Identity`](../../IDENTITY/KC-ID-001_Engineering_Object_Identity.md).
- Relates to a Physical Asset and its Physical States; those concepts require independent ownership if promoted.
- Observation supplies evidence about Physical State and must not be collapsed into the state.
- Representation remains downstream and separate under approved [`FC-001`](../../FREEZES/FC-001.md).
- Metric realization remains separate from Identity under approved [`FC-002`](../../FREEZES/FC-002.md).

## Findings Versus Inference

### Findings

- No Research, draft, App, or `src/` definition of the principal concept was found.
- The exact “Physical Realization Space” term occurs only in the Thesis glossary among searched semantic sources.
- Broader Thesis usage consistently distinguishes metric realization, physical realization, realized state, observation, and representation.
- Required counterexamples demonstrate that asset, state, observation, representation, and metric domain are not interchangeable.

### Inference

- The recurring target-to-built-state distinction identifies a cross-domain engineering responsibility worth retaining.
- That responsibility is best modeled as relational/process meaning rather than a space.
- Physical Asset and Physical State likely require explicit adjacent ownership, but this Research mission does not promote or place them.

Confidence: **moderate**. Counterexample support is strong and Thesis usage is consistent, but independent Research and implementation contracts are absent.

## Unresolved Questions

- Does Physical Realization denote the causal process, the relation between target and physical state, or both with separately named views?
- Which concept owns Physical Asset Identity and lifecycle?
- Which concept owns time-indexed Physical State and state history?
- How are construction variability and model uncertainty separated from observation uncertainty?
- What evidence establishes that a physical state corresponds to a particular intended object when multiple assets share a definition?

## Recommendation for KC-REALIZATION-005

Do not promote the current `Physical Realization Space` wording.

A separately authorized Kernel mission should:

1. reformulate the target as **Physical Realization**;
2. use the canonical question candidate above;
3. define it as a relational/process concept from intended engineering state to physically produced or maintained asset states;
4. keep Physical Asset, Physical State, Observation, Representation, Metric Space, Realization Context, and coordinates distinct;
5. leave the entry `candidate` until Governance review and avoid implying that this Research result approves a rename.

If renaming is not authorized, `KC-REALIZATION-005` should remain `evidence-missing` rather than retain the misleading “Space” semantics.
