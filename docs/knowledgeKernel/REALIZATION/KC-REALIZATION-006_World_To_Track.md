# KC-REALIZATION-006 World-to-Track

## Status

`candidate`

## Canonical Question

How is a world-domain position related to applicable intrinsic track references?

## Candidate Canonical Answer

World-to-Track is a context-qualified projection from a world-domain position to zero, one, or multiple applicable track-domain results, each identifying an intrinsic longitudinal parameter and applicable offsets or quality information.

## Normative Meaning

- Input belongs to a declared world-domain realization; output belongs to a declared intrinsic track-reference domain.
- Evaluation requires the realized track geometry, compatible Metric Space, Realization Context, reference-line convention, and applicable domain restrictions.
- Results may include longitudinal parameter, signed lateral offset, vertical or frame-relative offset where defined, and quality or ambiguity information.
- Loops, crossings, branches, parallel tracks, boundaries, and incomplete context may produce multiple, approximate, or no solutions.

## Boundaries

- World-to-Track is projection, not Identity, admission, coordinate transformation, operational kilometre lookup, or rendering.
- It has no unconditional global uniqueness or total inverse guarantee.
- Operational station or kilometre labels may be derived after an intrinsic result under separate addressing rules; they do not define Alignment Identity.
- A nearest geometric point is not automatically the applicable engineering result when topology or reference context differs.

## Relations to Other Kernel Concepts

- Is a [`KC-REALIZATION-004 Spatial Operator`](KC-REALIZATION-004_Spatial_Operators.md) using Metric Space and Realization Context.
- Is conditionally related to [`KC-REALIZATION-007 Track-to-World`](KC-REALIZATION-007_Track_To_World.md); inverse claims apply only on restricted compatible domains.
- Uses the intrinsic longitudinal parameter clarified for [`KC-ID-004 Alignment Identity`](../IDENTITY/KC-ID-004_Alignment_Identity.md) without redefining it as operational stationing.

## Consequences for Reference Implementation

- APIs should return applicability, candidate multiplicity, residual/quality, selected reference object, and context rather than assume one tuple.
- Search, projection, topology filtering, and operational-address conversion should remain separable.
- Numerical algorithms and Thesis formulas are implementation/explanation correspondence, not canonical proof.

## Consequences for Thesis

- The Thesis should state the operator's domains, ambiguity, context, and restriction of inverse claims.
- Operational kilometre addressing should follow projection rather than be substituted for intrinsic parameterization.

## Evidence and Origin

- Partial Research correspondence: [`KC-FOUND-007`](../research/FOUNDATIONS/KC-FOUND-007_Metric_Realization.md) establishes context-dependent metric operators but does not name this directional projection.
- Identity boundary: [`KC-FOUND-004`](../research/FOUNDATIONS/KC-FOUND-004_Alignment_Identity.md), clarified by [`KD-2026-006`](../GOVERNANCE/DECISION_LOG.md#kd-2026-006).
- Thesis explanation: [`state/world_to_track.tex`](../../thesis/AIM/state/world_to_track.tex), [`foundations/operators.tex`](../../thesis/AIM/foundations/operators.tex), and [`runtime/runtime_services.tex`](../../thesis/AIM/runtime/runtime_services.tex).
- RefImpl evidence is incomplete; similarly named or heritage projection behavior does not prove this full contract.

Principal correspondence classification: partial correspondence. No semantic conflict with Identity or the freezes was found.

## Open Decisions

- The canonical result schema, tie-breaking authority, topology inputs, and quality measures require focused Research and implementation conformance work.
