# KC-ID-001 Engineering Object Identity

## Status

`candidate`

## Canonical Question

What makes a durable engineering object remain distinguishable as the same object?

## Candidate Canonical Answer

Engineering Object Identity is the stable basis by which an engineering object remains distinguishable across changes of realization, representation, workflow, and project context.

## Normative Meaning

- Identity belongs to the engineering object, not to a description, view, file, software instance, or coordinate realization of it.
- Changes of representation, realization, workflow, or project context do not by themselves create a different engineering object.
- Numerical or geometric equality does not by itself establish shared identity.
- Whether a change preserves or replaces an object requires explicit engineering authority; it is not decided by identifier equality alone.

## Boundaries

- A database key, file name, label, coordinate value, or software object ID may reference identity but is not Engineering Object Identity itself.
- Identity is not metric realization, representation, observation, workflow state, or project membership.
- This concept defines durable distinguishability; it does not define the identity aspects of a particular object type.

## Relations to Other Kernel Concepts

- [`KC-ID-002 Identity Composition`](KC-ID-002_Identity_Composition.md) describes how identity aspects contribute to durable distinguishability.
- [`KC-ID-003 Constructive Identity`](KC-ID-003_Constructive_Identity.md) is one identity aspect concerned with intrinsic construction.
- [`KC-ID-004 Alignment Identity`](KC-ID-004_Alignment_Identity.md) specializes identity for an alignment.
- Governance authority and admission are defined by [`GOVERNANCE-001`](../GOVERNANCE/GOVERNANCE-001_Kernel_Domain_Ownership.md) and [`GOVERNANCE-002`](../GOVERNANCE/GOVERNANCE-002_Kernel_Approval_Process.md).

## Consequences for Reference Implementation

- Persisted or runtime IDs may correspond to engineering identity only when their lifecycle and authority semantics are explicit.
- Derived models should retain traceable references to their source object rather than silently becoming the source object's identity.
- Current `AlignmentData.id`, SpotObject mapping, and `derivedFrom` fields are correspondence evidence only; K1 does not declare them conformant identity implementations.

## Consequences for Thesis

- The Thesis should explain identity as durable distinguishability and keep it separate from keys, coordinates, representations, and numerical equality.
- Modification-versus-replacement must be presented as an engineering authority question, not as an automatic geometric test.

## Evidence and Origin

- Direct Research provenance: [`KC-FOUND-001 Engineering Object Identity`](../research/FOUNDATIONS/KC-FOUND-001_Engineering_Object_Identity.md).
- Supporting Research boundaries: [`KC-FOUND-007 Metric Realization`](../research/FOUNDATIONS/KC-FOUND-007_Metric_Realization.md), [`KC-FOUND-008 Representation`](../research/FOUNDATIONS/KC-FOUND-008_Representation.md), and [`KC-FOUND-009 Workflow / Project Context`](../research/FOUNDATIONS/KC-FOUND-009_Workflow_Project_Context.md).
- Approved Identity boundaries: [`FC-001`](../FREEZES/FC-001.md), approved through [`KD-2026-003`](../GOVERNANCE/DECISION_LOG.md#kd-2026-003), and [`FC-002`](../FREEZES/FC-002.md), approved through [`KD-2026-004`](../GOVERNANCE/DECISION_LOG.md#kd-2026-004). The Freeze approvals constrain this candidate but do not approve KC-ID-001.
- RefImpl correspondence: [`createEmptyAlignmentData.js`](../../../src/domain/alignment/editor/createEmptyAlignmentData.js), [`buildSparseAlignment.js`](../../../src/domain/alignment/editor/buildSparseAlignment.js), and [`AlignmentSpotObjectMapper.js`](../../../src/model/spot/model/AlignmentSpotObjectMapper.js).
- Thesis explanation: [`kernel/engineering_identity.tex`](../../thesis/AIM/kernel/engineering_identity.tex) and [`kernel/engineering_objects.tex`](../../thesis/AIM/kernel/engineering_objects.tex).

Identifier correspondence: `KC-FOUND-001` is direct Research provenance for `KC-ID-001`; no semantic conflict was found. The differing prefixes mark Research provenance versus the active Identity canonical home and are not renamed by K1.

## Open Decisions

- The general criterion and authority for deciding modification versus replacement require later governed elaboration; this candidate does not assign that authority beyond the Governance domain.
