# AIM Core Residual Path Inventory

Baseline: `e326a27bc7ddc913f0e97b57ebbd1da18598fdb7`.

Classes:

- **A** — logic-free, reference-identical compatibility facade;
- **B** — explicitly bounded outside-Core adapter/orchestrator/data boundary;
- **C** — nonproductive dormant residual/debt;
- **D** — prohibited duplicate productive Core authority.

Class D is empty. No second productive Core authority was found.

## A — Reference-identical facades

Owner: corresponding Core area. Consumer evidence: repository imports and the
dedicated compatibility tests. Trigger: remove only when repository search
finds no consumer and a compatibility-removal package is authorized. Parallel:
facade maintenance follows its Core owner; no independent semantic edits.

### Alignment, Profile, Topology and Geometry

- `src/domain/alignment/Alignment2D.js`
- `src/domain/alignment/authoring/AlignmentAuthoringContract.js`
- `src/domain/alignment/build/AlignmentFactory.js`
- `src/domain/alignment/cant/CantConstructiveState.js`
- `src/domain/alignment/chainage/ChainageMapping.js`
- `src/domain/alignment/editor/alignmentEditOps.js`
- `src/domain/alignment/editor/createEmptyAlignmentData.js`
- `src/domain/alignment/elements/AlignmentElement.js`
- `src/domain/alignment/elements/FixedElement.js`
- `src/domain/alignment/elements/ImmediateElement.js`
- `src/domain/alignment/elements/KinkElement.js`
- `src/domain/alignment/elements/TransitionElement.js`
- `src/domain/alignment/elements/ZeroLengthFixed.js`
- `src/domain/alignment/ports/AlignmentProfileStateReaderPort.js`
- `src/domain/alignment/ports/AlignmentRepositoryPort.js`
- `src/domain/alignment/services/AlignmentProfileEvaluationService.js`
- `src/domain/alignment/topology/TrackNetworkTopology.js`
- `src/domain/alignment/vertical/VerticalConstructiveState.js`
- `src/lib/geom/frame/pose2.js`
- `src/lib/geom/frame/poseAdvance2.js`
- `src/lib/geom/vec2.js`
- `src/lib/math/numeric/romberg.js`

### Transition and AXTRAN

- `src/domain/transition/build/KappaFcnBuilder.js`
- `src/domain/transition/registry/ast/buildProtoAst.js`
- `src/domain/transition/registry/ast/evalAst.js`
- `src/domain/transition/registry/ast/simplify.js`
- `src/domain/transition/registry/ast/symDiff.js`
- `src/domain/transition/registry/ast/symInt.js`
- `src/domain/transition/registry/compose/computeAnchorsFromTotal.js`
- `src/domain/transition/service/TransitionQueryService.js`
- `src/domain/transition/versioned/VersionedTransitionEvaluator.js`
- `src/domain/transition/versioned/buildFutureAxtranInputContract.js`
- `src/domain/transition/versioned/continuity/createVersionedContinuityModel.js`
- `src/domain/transition/versioned/continuity/index.js`
- `src/domain/transition/versioned/continuity/solveTransitionContinuity.js`
- `src/domain/transition/versioned/continuity/validateContinuityCandidate.js`
- `src/domain/transition/versioned/index.js`
- `src/domain/transition/versioned/quantityRoles.js`
- `src/domain/transition/versioned/upgradeLegacyTransitionLookup.js`
- `src/domain/transition/versioned/validateVersionedTransitionRegistry.js`

## B — Bounded outside-Core boundaries

These paths deliberately contain configuration, concrete data or application
orchestration. Owner: App/service adapter owner, not a Core area. Trigger:
review when the corresponding productive consumer is migrated to dependency
injection. Parallel: yes, outside Core, provided public Core contracts and
shared hotfiles are unchanged.

| Path/surface | Current evidence and boundary |
|---|---|
| `src/domain/transition/registry/RegistryResolver.js` | Concrete default `transitionLookup.json` adapter subclassing injected canonical `RegistryResolver`. |
| `src/domain/transition/transitionLookup.json` | Concrete catalogue data consumed outside Core. |
| `src/domain/alignment/editor/buildSparseAlignment.js` | Configures JSON resolver and canonical Kappa runtime, then delegates to canonical Sparse builder. |
| `src/domain/alignment/horizontal/HorizontalConstructiveState.js` | Re-exports pure state functions by identity and injects the configured Sparse adapter for value-only realization. |
| `src/domain/alignment/service/sampleSparseAlignmentForView.js` | Productive application sampling orchestration over the legacy Factory entry point. |
| `src/services/alignment/AlignmentApplicationService.js` | Application orchestration, repository access and productive edit workflow outside Core. |
| `src/services/alignment/AlignmentProfileApplicationService.js` | Application service over Core profile ports/evaluation. |
| `src/services/alignment/StaticAlignmentProfileStateReaderAdapter.js` | Concrete static reader adapter. |
| `src/services/alignment/RepositoryAlignmentProfileStateReaderAdapter.js` | Concrete repository reader adapter. |
| `src/services/alignment/SpotAlignmentRepositoryAdapter.js` | Concrete SPOT repository implementation. |
| `src/shared/**`, `app/**`, storage/import implementations | Messaging, runtime, persistence, browser UI and import remain outside Core. |

## C — Dormant residual debt

Owner: App Architect until removal package. Current consumer evidence: repository
search finds no productive importer; tests only assert exclusion where noted.
Trigger: delete after a dedicated no-consumer proof and regression run.
Parallel: read-only inventory; do not edit concurrently with Core packages.

| Path | Evidence |
|---|---|
| `src/domain/transition/registry/compose/composeTotal.js` | No productive consumer; explicitly excluded from Transition Runtime API. |
| `src/domain/transition/registry/compose/solvePartitionC1.js` | No productive consumer; explicitly excluded from Transition Runtime API. |
| `src/domain/transition/registry/validator.js` | Superseded legacy validator; no productive importer found. |
| `src/lib/geom/curve/Curve2D.js` | Dormant abstract curve; no productive importer found. |
| `src/domain/alignment/service/sampleSparseAlignmentForView_old.js` | Inventoried compatibility copy; no productive importer found. |

## D — Prohibited duplicate authority

None.
