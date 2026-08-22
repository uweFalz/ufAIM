# Static Alignment Profile State Reader Adapter v0.1

Status: App architecture adapter contract. Knowledge Kernel authority is
unchanged.

## Version and API

Adapter version:

```text
app-adapter/static-alignment-profile-state-reader/0.1
```

The concrete App-layer adapter implements the existing
`AlignmentProfileStateReaderPort` through:

```js
new StaticAlignmentProfileStateReaderAdapter({ records })

loadVerticalByAlignmentId(alignmentId)
loadCantByAlignmentId(alignmentId)
loadChainageMappingsByAlignmentId(alignmentId)
```

It accepts only already valid Core states. It performs no semantic conversion.
The vertical, cant, and chainage Core modules remain the authoritative owners
of their respective state and law semantics.

## Snapshot record

Each supplied record has all four members:

```js
{
  alignmentId: "trimmed non-empty explicit Alignment identity",
  vertical: VerticalConstructiveState | null,
  cant: CantConstructiveState | null,
  chainageMappings: ordered list<ChainageMapping>
}
```

Record Alignment identities are unique. Every non-null state and every mapping
is valid Core state for the same explicit Alignment identity. Mapping
identities are unique within a record. Unknown record members are ignored and
gain no persistence or domain meaning.

The adapter owns only lookup membership and a shallow copied, frozen mapping
array preserving supplied order. It does not retain caller record objects or
caller mapping-array objects. Later record mutation, array replacement,
reordering, or append does not change the installed snapshot. The adapter does
not clone, freeze, or mutate supplied domain states; it returns vertical, cant,
and mapping values by identity.

## Read semantics

Every load validates and trims the requested explicit Alignment identity.
Unknown Alignments return:

```text
vertical -> null
cant -> null
chainage mappings -> frozen empty list
```

Known Alignments return the installed vertical and cant references or explicit
`null`, plus the adapter-owned frozen mapping-list copy. Reads never select a
fallback Alignment, active Alignment, preferred mapping, or current scheme
version. Reads do not mutate adapter or domain state.

## Structured errors

`StaticAlignmentProfileStateReaderAdapterError` provides its name and one of:

- `INVALID_RECORDS`
- `INVALID_RECORD`
- `INVALID_ALIGNMENT_ID`
- `DUPLICATE_ALIGNMENT_ID`
- `ALIGNMENT_ID_MISMATCH`
- `DUPLICATE_MAPPING_ID`

Validation failure does not mutate input.

## Ownership and dependency boundary

```text
Core Service -> Core Port <- App Adapter
```

The profile evaluation service consumes the Core port without knowing this
adapter. This adapter is browser-independent and has dependencies only on the
Core port assertion and the vertical, cant, and chainage state validators.

It has no SPOT, Worker, Messaging, browser storage, UI, import, GND, LandXML,
persistence, or selection dependency. Its static snapshot is neither a durable
persistence format nor an Alignment aggregate contract.

This package makes no claim of productive wiring. Research remains
non-canonical comparison evidence and is not architectural authority.

## Deferred and unauthorized

- productive adapter wiring;
- SPOT, import, GND, or LandXML conversion;
- persistence or serialization format;
- mutation or save operations;
- aggregate ownership;
- active-selection fallback;
- current or preferred chainage policy;
- UI or inApp integration;
- horizontal or topology aggregation;
- vertical or cant authoring;
- speed or applicability;
- CRS or realization;
- AXTRAN or transitionDB coupling;
- broad movement, renaming, deletion, or cleanup.
