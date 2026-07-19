# KC-EVAL-002 Engineering Observation

## Status

`candidate`

## Canonical Question

What records evidence about an engineering object, state, or context without claiming to be the observed reality or accepted knowledge?

## Candidate Canonical Answer

An Engineering Observation is source-grounded information about an engineering object, state, or context together with the provenance, method, time, conditions, and uncertainty needed to interpret it as evidence.

## Normative Meaning

- Observation records an encounter with or report about its subject; it does not become that subject.
- Provenance and acquisition context are part of observation meaning.
- Multiple compatible or conflicting observations may concern one object or physical state.
- Observation can support knowledge or decisions only through explicit interpretation and admission.

## Boundaries

- Observation is not physical reality, Physical State, Engineering Object Identity, truth, knowledge, representation, or decision.
- Observation uncertainty concerns evidence acquisition and interpretation; it is not physical variability or constraint violation.
- A source-system record may correspond to an observation only when its provenance and observation semantics are established.

## Relations to Other Kernel Concepts

- Supplies evidence for [`KC-EVAL-001 Engineering Knowledge`](KC-EVAL-001_Engineering_Knowledge.md).
- Remains separate from [`KC-REALIZATION-005 Physical Realization`](../REALIZATION/KC-REALIZATION-005_Physical_Realization.md) and its resulting physical states.
- Does not change object identity under Identity and Freeze boundaries.

## Consequences for Reference Implementation

- Observation records should retain source identity, acquisition method, timestamp, context, transformation history, and uncertainty.
- Measured geometry must not overwrite intended or physical state without an explicit inference and decision process.

## Consequences for Thesis

- The Thesis should distinguish observations, observed-state estimates, physical states, and accepted conclusions.

## Evidence and Origin

- Multi-source support: [`ObservationService`](../_draft/20-services/ObservationService.md) and [`RESEARCH-REALIZATION-001`](../research/REALIZATION/RESEARCH-REALIZATION-001_Physical_Realization_Space.md), especially its observation/state counterexamples.
- Supporting boundaries: [`KC-FOUND-001`](../research/FOUNDATIONS/KC-FOUND-001_Engineering_Object_Identity.md), [`FC-001`](../FREEZES/FC-001.md), and [`KC-REALIZATION-005`](../REALIZATION/KC-REALIZATION-005_Physical_Realization.md).
- Thesis explanation: [`kernel/observations.tex`](../../thesis/AIM/kernel/observations.tex) and [`reality/measurement_and_imperfect_data.tex`](../../thesis/AIM/reality/measurement_and_imperfect_data.tex).

Evidence classification: multi-source support; no Research approval is inherited.

## Open Decisions

- The boundary between raw source record, observation, and inferred Observed State requires focused later Research.
