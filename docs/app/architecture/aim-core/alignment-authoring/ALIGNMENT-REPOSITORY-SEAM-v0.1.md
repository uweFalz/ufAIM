# Alignment Repository Seam v0.1

## Status and scope

This document freezes the smallest browser-independent seam around the existing
Alignment arc-authoring behavior:

```text
explicit Alignment engineering-object ID
→ load complete constructive Alignment state
→ apply one immutable update-arc operation
→ return success or structured rejection
→ save a successful changed state under the same ID
```

The contract version is `aim-core/alignment-authoring/0.1`. The result version
is `aim-core/alignment-authoring-result/0.1`. This package changes no productive
runtime call path.

## Vocabulary

### AlignmentId

An `AlignmentId` is a non-empty string identifying one existing Alignment
engineering object. It is never inferred from UI selection, focus, array
position, geometry, name, coordinates, DOM state, Worker state, or
message-envelope metadata. It remains unchanged across a successful edit.

### AlignmentConstructiveState

`AlignmentConstructiveState` is the existing `AlignmentData` object consumed by
`src/domain/alignment/editor/alignmentEditOps.js`. It has
`type === "AlignmentData"`, `id === AlignmentId`,
`editModel.startPose`, and `editModel.elements`.

Unknown JSON members are preserved by the seam. This package does not define
topology, CRS, speed, profile, cant, stationing, transition mathematics, or a
persistence format.

### AlignmentAuthoringRequestV01

```js
{
  contractVersion: "aim-core/alignment-authoring/0.1",
  alignmentId: string,
  operation: "update-arc",
  elementId: string,
  changes: {
    length?: finite number greater than 0,
    curvature?: finite non-zero number,
    radius?: finite non-zero number
  }
}
```

`alignmentId` and `elementId` are required non-empty strings. At least one
change is required. `curvature` and `radius` cannot both be supplied. Missing
values mean unchanged; JavaScript `undefined` is not serialized contract data.
The only operation in v0.1 is `update-arc`.

### AlignmentAuthoringResultV01

Success:

```js
{
  contractVersion: "aim-core/alignment-authoring-result/0.1",
  status: "changed",
  alignmentId: string,
  elementId: string,
  alignmentState: AlignmentConstructiveState,
  focusRecommendation: {
    alignmentId: string,
    elementId: string
  }
}
```

Rejection:

```js
{
  contractVersion: "aim-core/alignment-authoring-result/0.1",
  status: "rejected",
  alignmentId: string,
  elementId: string | null,
  code:
    "INVALID_REQUEST" |
    "ALIGNMENT_NOT_FOUND" |
    "ALIGNMENT_ID_MISMATCH" |
    "ELEMENT_NOT_FOUND" |
    "ELEMENT_TYPE_MISMATCH" |
    "INVALID_ARC_PARAMETERS" |
    "CONSTRUCTIVE_SEQUENCE_REJECTED",
  reason: string,
  focusRecommendation: null
}
```

On rejection, repository `saveById()` is not called, loaded state is not
mutated, and no workspace selection, active window, focus, UI, DOM, messaging,
or browser effect occurs. Existing-operation errors are translated only by the
test binding, not by new productive runtime code.

## AlignmentRepositoryPort v0.1

The port version is `aim-core/alignment-repository-port/0.1`. A conforming
repository exposes:

```js
repository.loadById(alignmentId)
repository.saveById(alignmentId, alignmentState)
```

`loadById(id)` returns the complete existing constructive state or `null`.
`saveById(id, state)` stores the complete successful state under the same ID
and returns the stored state. The port does not prescribe sync/async execution,
transport, Worker commands, SPOT implementation, serialization technology,
database, or browser lifecycle. A JavaScript binding may await direct values or
thenables. List, create, delete, selection, focus, snapshot, undo, and general
CRUD are outside v0.1.

## Existing-code mapping

| Neutral responsibility | Existing evidence | Mapping | Current owner | Package result |
|---|---|---|---|---|
| Constructive Alignment state | `src/domain/alignment/editor/alignmentEditOps.js` functions consume and return `AlignmentData` | exact | domain editor operations | referenced, not replaced |
| Immutable arc update | `updateArcById()` in `src/domain/alignment/editor/alignmentEditOps.js` | exact | domain editor operation | directly characterized |
| Arc lookup by stable element ID | `findElementById()` in `src/domain/alignment/editor/alignmentEditOps.js` | exact | domain editor operation | directly characterized |
| Structural sequence validation | `AlignmentApplicationService.assertStructurallyEditableSequence()` plus `buildSparseAlignment()` | partial | Application Service and sparse builder | documented; no extraction |
| Existing state load | `AlignmentApplicationService._editActiveAlignment()` obtains the active object through its gateway | partial and selection-coupled | Application Service/SPOT gateway | repository port freezes the future explicit-ID boundary |
| Existing state save | `spotGateway.saveObject()` in `AlignmentApplicationService._editActiveAlignment()` | partial and transport-coupled | Application Service/SPOT gateway | repository port freezes responsibility, no productive adapter |
| Focus recommendation | selection restoration in `AlignmentApplicationService._editActiveAlignment()` | lossy/mixed | Application Service/window store | result separates recommendation from effect |
| Actual workspace selection | `workspace_selection` and store actions | outside Core | App window state | explicitly excluded |

This package creates no second Alignment model and no productive repository
implementation.

## Dependency boundary

Permitted:

```text
test binding → new contract/port → existing pure alignment edit operation
```

Forbidden:

```text
new Core contract/port → app/
new Core contract/port → browser/DOM/UI
new Core contract/port → Shared Worker or messaging
new Core contract/port → SPOT concrete storage
new Core contract/port → GND/import
new Core contract/port → MapLibre
```

Focus recommendations are data only. Applying selection or focus remains an App
responsibility outside this seam.
