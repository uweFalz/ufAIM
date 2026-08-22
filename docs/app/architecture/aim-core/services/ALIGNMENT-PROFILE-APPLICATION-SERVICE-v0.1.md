# Alignment Profile Application Service v0.1

Status: App architecture composition contract. Knowledge Kernel authority is
unchanged.

## Language-neutral operations

```text
evaluateProfileAt(alignmentIdentity, intrinsicPosition)
  -> Core profile-evaluation result

evaluateProfileAtMany(alignmentIdentity, orderedIntrinsicPositions)
  -> ordered list of Core profile-evaluation results
```

Their meaning does not depend on Promises, classes, DOM, Worker messages,
command envelopes, browser lifecycle, object-property order, or UI selection.
JavaScript is the Reference Application binding.

## Versions and API

```text
app-service/alignment-profile-evaluation/0.1
app-service/alignment-profile-evaluation-batch-result/0.1
```

```js
new AlignmentProfileApplicationService({ records })

evaluateAt({ alignmentId, s })
evaluateMany({ alignmentId, positions })
```

Explicit snapshot records accepted by
`StaticAlignmentProfileStateReaderAdapter` are the only construction source.
Construction creates one static adapter and one
`AlignmentProfileEvaluationService`. Invalid snapshot-record errors pass
through unchanged.

## Single-position evaluation

`evaluateAt(request)` delegates exactly once to the retained Core Service and
returns the identical frozen Core result. It does not independently inspect or
normalize the request, translate errors, add focus or representation fields,
clone, reshape, mutate, or persist the result.

The Core Service remains authoritative for single-request validation,
component absence, non-coverage, chainage ambiguity, and evaluation semantics.

## Ordered multi-position evaluation

```js
{
  alignmentId: "trimmed non-empty explicit Alignment identity",
  positions: [finiteNumber, ...]
}
```

An empty positions array is valid. The complete request is rejected before
evaluation when its Alignment identity, array, or any number is invalid.

Positions are evaluated sequentially in supplied order. Duplicates are
preserved. The service does not deduplicate, sort, interpolate, resample, or
fill gaps. It invokes the Core Service once per position with the normalized
explicit Alignment identity. A failure stops evaluation at its exact index.

Success returns:

```js
{
  contractVersion:
    "app-service/alignment-profile-evaluation-batch-result/0.1",
  status: "evaluated",
  alignmentId,
  positions,
  results
}
```

The batch envelope and its shallow-copied positions and results arrays are
frozen. Each results entry is the identical frozen Core result reference.
Single results remain owned by the Core Service; the batch envelope and arrays
are owned by this Application Service. Supplied Core states remain owned by
their callers.

## Structured errors

`AlignmentProfileApplicationServiceError` uses:

- `INVALID_BATCH_REQUEST`
- `BATCH_EVALUATION_FAILED`

A batch evaluation failure preserves the original Core error as `cause`,
exposes the zero-based failing `index`, and performs no later evaluation.
`evaluateAt` never wraps Core errors.

## Ownership and dependency boundary

This service composes the existing static adapter and Core evaluation service
and adds only ordered batch orchestration:

```text
future UI/inApp -> Application Service -> Core Service
  -> Core Port <- App Adapter
```

The vertical, cant, and chainage Core states retain ownership of their laws and
identity. The adapter retains only static lookup membership and mapping order.

No productive UI or runtime registration is claimed. The service has no active
selection, focus, SPOT, Worker, Messaging, browser storage, import, GND,
LandXML, persistence, or storage dependency. It adds no interpolation or
representation semantics.

Research remains non-canonical comparison evidence and is not architectural
authority.

## Deferred and unauthorized

- productive UI, runtime, or inApp wiring;
- SPOT, import, GND, or LandXML conversion;
- persistence and serialization;
- mutation or save operations;
- aggregate ownership;
- selection or focus effects;
- interpolation, resampling, or representation;
- current or preferred chainage policy;
- horizontal or topology aggregation;
- vertical or cant authoring;
- speed or applicability;
- CRS or realization;
- AXTRAN or transitionDB coupling;
- broad file movement or cleanup.
