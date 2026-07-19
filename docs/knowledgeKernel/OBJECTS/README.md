# Objects

## Domain Purpose

The Objects domain defines SpotObject and SpotObject Identity while keeping individual engineering objects distinct from SPOT as the loaded object universe, import state, representations, and runtime or workspace artifacts. Both active entries are `candidate`; neither is approved.

## Concept Index

| Active Kernel ID | Concept | Status |
|---|---|---|
| [`KC-SPOT-001`](KC-SPOT-001_SpotObject.md) | SpotObject | `candidate` |
| [`KC-SPOT-002`](KC-SPOT-002_SpotObject_Identity.md) | SpotObject Identity | `candidate` |

## Identifier Collision and Provenance Mapping

The Research and active identifier families reuse the same numbers for different meanings. Identifier similarity is not semantic equivalence.

| Research ID | Research meaning | Active correspondence | Classification |
|---|---|---|---|
| [`KC-SPOT-001`](../research/SPOT/KC-SPOT-001.md) | SPOT Object Universe | None | No equivalence; separate concept with unresolved active destination |
| [`KC-SPOT-002`](../research/SPOT/KC-SPOT-002.md) | SpotObject | [`KC-SPOT-001`](KC-SPOT-001_SpotObject.md) | Direct provenance |
| [`KC-SPOT-003`](../research/SPOT/KC-SPOT-003.md) | SpotObject Identity | [`KC-SPOT-002`](KC-SPOT-002_SpotObject_Identity.md) | Direct provenance |

No Research file is renamed or rewritten. Research `KC-SPOT-001 SPOT Object Universe` remains traceable and distinct: it describes the loaded universe of admitted objects and relations, whereas active `KC-SPOT-001 SpotObject` describes one admitted durable engineering object. Its future canonical destination is decision `K2-SPOT-001` in the SpotObject candidate.

## Package Traceability

| Active Kernel ID | Research ID | Research evidence | Governance decision | RefImpl correspondence | Thesis explanation | Status |
|---|---|---|---|---|---|---|
| KC-SPOT-001 SpotObject | Research KC-SPOT-002 | Direct provenance; boundaries from Research 001 and 005–008 | KERNEL-REPAIR-002 permits candidate preparation; approval absent | `SpotStore`, `promoteImportItems`, `createAlignmentSpotObject`, and mapper behavior; correspondence only | `foundations/kernel_glossary.tex`; `modeling/sparse.tex` | `candidate` |
| KC-SPOT-002 SpotObject Identity | Research KC-SPOT-003 | Direct provenance; general Identity and Research 005/006/008 support | KERNEL-REPAIR-002 permits candidate preparation; approval absent | ID/reference preservation and lookup behavior; incomplete identity proof | `foundations/kernel_glossary.tex`; `modeling/sparse.tex` | `candidate` |
| No active target | Research KC-SPOT-001 | SPOT Object Universe remains a distinct Research concept | `K2-SPOT-001` unresolved | `SpotStore` may correspond to a loaded universe but does not prove it | Glossary language about admission into SPOT; incomplete | Research evidence only |

## Dependencies and Boundaries

- Identity meaning comes from [`KC-ID-001`](../IDENTITY/KC-ID-001_Engineering_Object_Identity.md) and [`KC-ID-002`](../IDENTITY/KC-ID-002_Identity_Composition.md), which remain candidates.
- Governance authority and candidate preparation are controlled by the [Constitution](../KERNEL_CONSTITUTION.md), [`GOVERNANCE-001`](../GOVERNANCE/GOVERNANCE-001_Kernel_Domain_Ownership.md), [`GOVERNANCE-002`](../GOVERNANCE/GOVERNANCE-002_Kernel_Approval_Process.md), and [`KD-2026-001`](../GOVERNANCE/DECISION_LOG.md#kd-2026-001).
- Approved [`FC-001`](../FREEZES/FC-001.md) and [`FC-002`](../FREEZES/FC-002.md) prohibit representation or metric realization from becoming Identity.
- Research approval assertions are provenance claims and do not approve these active entries.
