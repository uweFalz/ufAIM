# Diagrams

## Purpose

This directory provides visual aids for Kernel relations. Diagrams explain and navigate concepts; they do not independently define canonical Kernel meaning.

## Inventory

| Artifact | Type | Intended semantic role | Authority level |
|---|---|---|---|
| [`kernel-stack.puml`](kernel-stack.puml) | source (PlantUML) | Shows high-level relation among Research, Knowledge Kernel, Thesis, and Reference Implementation | Explanatory only |
| [`layers.puml`](layers.puml) | source (PlantUML) | Shows conceptual dependency layering from Identity through Realization and Representation toward workflow context | Explanatory only |
| [`overview1.png`](overview1.png) | rendered output | Visual rendering of diagram content for quick reading | Non-authoritative rendering |
| [`overview2.png`](overview2.png) | rendered output | Visual rendering of diagram content for quick reading | Non-authoritative rendering |

## Source vs Rendered Outputs

- `.puml` files are maintained sources.
- `.png` files are rendered views for communication convenience.
- If a rendered output diverges from source or from active Kernel text, source and active Kernel text control interpretation.

## Authority Limitations

- Diagrams do not create, approve, or change Kernel concepts.
- Diagrams cannot override concept files, freezes, Constitution, or Governance decisions.
- Semantic authority remains in active Kernel concept files plus explicit Governance decisions.

## Maintenance and Generation Notes

- This mission does not regenerate diagrams.
- No repository-local automated generation pipeline is evidenced in this directory.
- Maintenance expectation: update `.puml` sources when canonical relationships change, then regenerate rendered outputs in a separately authorized maintenance step.

## Related Canonical References

- [`../KERNEL_CONSTITUTION.md`](../KERNEL_CONSTITUTION.md)
- [`../FREEZES/FC-001.md`](../FREEZES/FC-001.md)
- [`../FREEZES/FC-002.md`](../FREEZES/FC-002.md)
- [`../GOVERNANCE/DECISION_LOG.md`](../GOVERNANCE/DECISION_LOG.md)
