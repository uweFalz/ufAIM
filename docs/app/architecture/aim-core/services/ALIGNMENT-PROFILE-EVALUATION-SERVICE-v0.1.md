# Alignment Profile Evaluation Service v0.1

Status: App architecture contract. Knowledge Kernel authority is unchanged.

## Language-neutral operation

```text
evaluateAlignmentProfiles(alignmentId, intrinsicPosition)
  -> component-preserving evaluation result
```

The fachliche meaning does not depend on JavaScript classes, Promises,
prototypes, DOM events, Worker messages, command envelopes, object-property
order, or browser lifecycle. The JavaScript service is the Reference
Implementation binding.

## Read port

Port version:

```text
aim-core/alignment-profile-state-reader-port/0.1
```

The read-only port provides:

```text
loadVerticalByAlignmentId(alignmentId)
  -> VerticalConstructiveState | null

loadCantByAlignmentId(alignmentId)
  -> CantConstructiveState | null

loadChainageMappingsByAlignmentId(alignmentId)
  -> ordered list<ChainageMapping>
```

Each operation receives the explicit Alignment identity. `null` denotes absent
vertical or cant responsibility. Chainage absence is an empty list. Direct and
awaitable JavaScript results are binding mechanisms, not fachliche semantics.
The reader owns no state and has no save, selection, transport, lifecycle,
messaging, import, or presentation responsibility.

## Service request and validation

The request contains a trimmed, non-empty explicit `alignmentId` and finite
intrinsic `s`. Invalid requests perform no read. Each accepted request invokes
all three read operations exactly once.

Returned states remain owned by their source. The service validates their Core
shapes, exact Alignment identity, and unique chainage mapping identity. It does
not repair, coerce, materialize, mutate, freeze, or persist them.

## Result

Result version:

```text
aim-core/alignment-profile-evaluation-result/0.1
```

```js
{
  contractVersion:
    "aim-core/alignment-profile-evaluation-result/0.1",
  status: "evaluated",
  alignmentId,
  s,
  vertical,
  cant,
  chainage
}
```

Vertical and cant components preserve these states:

```js
{ status: "absent" }
{ status: "evaluated", value: evaluatorResult }
{ status: "not-covered", code: emptyOrOutsideDomainCode }
```

Vertical non-coverage codes are `EMPTY_PROFILE` and
`POSITION_OUTSIDE_DOMAIN`. Cant non-coverage codes are `EMPTY_CANT` and
`POSITION_OUTSIDE_DOMAIN`. Absence and non-coverage are not fabricated
engineering values.

Chainage absence is:

```js
{ status: "absent", mappings: [] }
```

Present chainage is:

```js
{
  status: "evaluated",
  mappings: [{
    mappingId,
    schemeId,
    schemeVersion,
    candidates
  }]
}
```

Mapping order, scheme/version identity, and every candidate are preserved. A
mapping with no candidate remains present with an empty candidate list. The
service never chooses a preferred scheme, version, segment, back/ahead address,
or candidate.

All service-owned results, component records, copied evaluator records, mapping
records, candidates, and arrays are recursively frozen.

## Structured errors

`AlignmentProfileEvaluationServiceError` uses:

- `INVALID_REQUEST`
- `INVALID_PORT_RESULT`
- `ALIGNMENT_ID_MISMATCH`
- `DUPLICATE_MAPPING_ID`
- `PORT_READ_FAILED`
- `COMPONENT_EVALUATION_FAILED`

Wrapped unexpected port or evaluator failures retain their cause. Failures do
not mutate port-owned state.

## State ownership

| Responsibility | Authoritative owner | Service role |
|---|---|---|
| Vertical state and laws | `VerticalConstructiveState` | Read and evaluate |
| Cant state and laws | `CantConstructiveState` | Read and evaluate |
| Chainage relation and ambiguity | `ChainageMapping` | Read and evaluate |
| Component storage | External adapter/owner | Reader owns no state |
| Evaluation orchestration | This Core Service | Preserve component meaning |

Horizontal constructive state and topology remain separate Core
responsibilities. Their absence from this bounded query is not missing
aggregation.

## Dependency boundary

```text
UI/inApp -> Application Service -> AIM Core Service
  -> AIM Core Model/Ports -> Adapters
```

The port has zero imports. The service imports only the reader-port assertion
and the vertical, cant, and chainage Core model evaluators. It is read-only and
browser-independent.

No concrete adapter or productive consumer is added. Existing
`AlignmentApplicationService`, the SPOT adapter, Shared Worker, Messaging,
browser persistence, UI, import, GND, and harnesses remain outside this
contract.

Research and Axiomatics remain non-canonical comparison evidence only and are
not architectural authority.

## Deferred and unauthorized

- concrete reader adapter;
- productive service wiring;
- save or mutation port;
- persisted Alignment aggregate;
- storage technology;
- horizontal authoring aggregation;
- topology or network service;
- UI or inApp integration;
- import/export or GND interpretation;
- preferred chainage candidate or version policy;
- vertical or cant authoring;
- speed or applicability;
- CRS or realization;
- AXTRAN or transitionDB coupling;
- broad movement, renaming, deletion, or legacy cleanup.

No placeholder for these responsibilities is established here.
