# KC-ID-004 Alignment Identity

## Status

`candidate`

## Canonical Question

Which intrinsic constructive structure distinguishes an Alignment as an engineering object?

## Candidate Canonical Answer

Alignment Identity is the constructive identity formed by an intrinsic longitudinal parameterization, ordered constructive sequencing, and curvature evolution along that parameterization.

## Normative Meaning

- The alignment owns an intrinsic longitudinal domain over which its constructive sequence and curvature evolution are ordered.
- Sequence order and curvature evolution belong to the alignment's constructive distinction, independently of sampled or rendered geometry.
- Under [`KD-2026-006`](../GOVERNANCE/DECISION_LOG.md#kd-2026-006), “stationing” in the Research provenance means only intrinsic longitudinal parameterization; it is not an external kilometre or station-address system.
- Metric embedding, coordinates, and derived poses may realize the alignment but do not own its identity.

## Boundaries

- Alignment Identity does not own CRS, world coordinates, pose2, pose3, rendering, exchange formats, or sampled curves.
- It does not own operational stationing, station equations, kilometre-line addressing, workflow state, or project context. Operational addresses may jump, overlap, change, or be reassigned and therefore do not define intrinsic Alignment Identity.
- This entry does not define a particular transition family, sparse serialization, or metric realization operator.
- Similar realized geometry does not by itself prove identical Alignment Identity.

## Relations to Other Kernel Concepts

- Specializes [`KC-ID-001 Engineering Object Identity`](KC-ID-001_Engineering_Object_Identity.md).
- Uses the composition principle from [`KC-ID-002 Identity Composition`](KC-ID-002_Identity_Composition.md).
- Is an alignment-specific form of [`KC-ID-003 Constructive Identity`](KC-ID-003_Constructive_Identity.md).
- SpotObject, Realization, Evaluation, and Communication relations remain outside K1.

## Consequences for Reference Implementation

- The ordered element sequence and curvature laws may correspond to constructive Alignment Identity, while sampled points, poses, and viewer geometry remain derived.
- Internal monotone `s` must remain distinguishable from external `staEq` labels and station equations.
- Current sparse alignment structures demonstrate this separation but do not by themselves prove canonical conformance or determine identity persistence across edits.

## Consequences for Thesis

- The Thesis should distinguish intrinsic longitudinal parameterization from operational stationing and kilometre-line addressing.
- Sparse or sampled models should be explained as representations or realizations of alignment construction, not automatically equated with the durable engineering object.

## Evidence and Origin

- Direct Research provenance as clarified by Governance: [`KC-FOUND-004 Alignment Identity`](../research/FOUNDATIONS/KC-FOUND-004_Alignment_Identity.md). Its “ordered curvature evolution” and “constructive sequencing” correspond directly; [`KD-2026-006`](../GOVERNANCE/DECISION_LOG.md#kd-2026-006) fixes its unqualified term “stationing” to intrinsic longitudinal parameterization.
- Draft clarification: [`AlignmentIdentity.md`](../_draft/10-concepts/AlignmentIdentity.md) uses “station parameterization” and excludes CRS, coordinates, poses, and rendering.
- Research boundaries: [`KC-FOUND-007 Metric Realization`](../research/FOUNDATIONS/KC-FOUND-007_Metric_Realization.md), [`KC-FOUND-008 Representation`](../research/FOUNDATIONS/KC-FOUND-008_Representation.md), and [`KC-FOUND-009 Workflow / Project Context`](../research/FOUNDATIONS/KC-FOUND-009_Workflow_Project_Context.md).
- RefImpl correspondence: [`ALIGNMENT_KERNEL.md`](../../app/engineering/ALIGNMENT_KERNEL.md), [`Alignment2D.js`](../../../src/domain/alignment/Alignment2D.js), and [`buildSparseAlignment.js`](../../../src/domain/alignment/editor/buildSparseAlignment.js) distinguish internal `s`, ordered elements, curvature, derived pose, and external `staEq` metadata.
- Thesis explanation: [`kernel/engineering_identity.tex`](../../thesis/AIM/kernel/engineering_identity.tex), [`foundations/kernel_glossary.tex`](../../thesis/AIM/foundations/kernel_glossary.tex), [`modeling/sparse.tex`](../../thesis/AIM/modeling/sparse.tex), and [`reality/km_line_and_stationing.tex`](../../thesis/AIM/reality/km_line_and_stationing.tex).

Identifier correspondence: `KC-FOUND-004` is direct provenance for `KC-ID-004` under the binding terminology clarification in `KD-2026-006`. The identifier families remain unchanged.

## Open Decisions

- Identity persistence across changes to sequence or curvature requires later engineering decision criteria; K1 does not invent them.
