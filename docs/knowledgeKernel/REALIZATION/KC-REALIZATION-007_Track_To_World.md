# KC-REALIZATION-007 Track-to-World

## Status

`candidate`

## Canonical Question

How is an intrinsic track reference evaluated as world-domain metric state?

## Candidate Canonical Answer

Track-to-World is a context-qualified mapping from an applicable intrinsic track reference and defined offsets to world-domain metric state under a selected realization.

## Normative Meaning

- Input identifies the engineering object, intrinsic longitudinal parameter, and any reference-line or frame-relative offsets required by the operator.
- Output is world-domain metric state, potentially including position and frame quantities, within the declared context.
- Evaluation depends on the object's Metric Realization, Metric Space, Realization Context, and applicability domain.
- Different valid realizations may produce different world states for the same intrinsic reference without replacing the engineering object.

## Boundaries

- Track-to-World is not rendering, display-coordinate conversion, object Identity, or operational kilometre addressing.
- Intrinsic longitudinal parameter is not silently replaced by station labels or kilometre values that may jump, overlap, change, or be reassigned.
- The operator need not cover invalid parameters, undefined offsets, missing frames, or incompatible contexts.
- A world output is a realized result, not a constructive definition or representation requirement.

## Relations to Other Kernel Concepts

- Is a [`KC-REALIZATION-004 Spatial Operator`](KC-REALIZATION-004_Spatial_Operators.md) evaluated through [`KC-REALIZATION-001 Metric Realization`](KC-REALIZATION-001_Metric_Realization.md).
- Is conditionally related to [`KC-REALIZATION-006 World-to-Track`](KC-REALIZATION-006_World_To_Track.md), which may be multivalued and is not a global inverse.
- Consumes intrinsic alignment reference semantics from [`KC-ID-004`](../IDENTITY/KC-ID-004_Alignment_Identity.md) without redefining them.

## Consequences for Reference Implementation

- APIs should require an explicit reference object and context and expose invalid-domain or unavailable outcomes.
- World results should remain separate from viewer coordinates and cached rendering geometry.
- Forward evaluation and inverse search should be independently implemented and validated.

## Consequences for Thesis

- The Thesis should distinguish intrinsic track input, realized world output, and later representation.
- Formulae should state reference-line, offset, frame, metric, and validity assumptions.

## Evidence and Origin

- Partial Research correspondence: [`KC-FOUND-007`](../research/FOUNDATIONS/KC-FOUND-007_Metric_Realization.md) establishes metric operators and contextual embedding but does not name Track-to-World.
- Identity boundary: [`KC-FOUND-004`](../research/FOUNDATIONS/KC-FOUND-004_Alignment_Identity.md), clarified by [`KD-2026-006`](../GOVERNANCE/DECISION_LOG.md#kd-2026-006).
- Thesis explanation: [`state/world_to_track.tex`](../../thesis/AIM/state/world_to_track.tex), [`foundations/operators.tex`](../../thesis/AIM/foundations/operators.tex), and [`runtime/runtime_services.tex`](../../thesis/AIM/runtime/runtime_services.tex).
- RefImpl correspondence is incomplete; coordinate `toWorld` helpers do not alone implement this engineering operator.

Principal correspondence classification: partial correspondence. No semantic conflict with operational-stationing boundaries was found.

## Open Decisions

- Required offset/frame components, valid track domains, and world-result quality metadata require focused Research.
