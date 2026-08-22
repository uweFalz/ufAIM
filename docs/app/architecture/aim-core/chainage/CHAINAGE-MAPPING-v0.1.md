# Chainage Mapping v0.1

Status: App architecture contract. Knowledge Kernel authority is unchanged.

## Contract

The exact version is:

```text
aim-core/chainage-mapping/0.1
```

The normative mapping shape is:

```js
{
  contractVersion: "aim-core/chainage-mapping/0.1",
  type: "ChainageMapping",
  id: "non-empty stable mapping identity",
  alignmentId: "non-empty stable Alignment identity",
  schemeId: "non-empty stable chainage-scheme identity",
  schemeVersion: "non-empty explicit scheme version",
  longitudinalParameter: "intrinsic-s",
  addressQuantity: "chainage",
  unit: "alignment-length-unit",
  segments: []
}
```

Mapping, Alignment, scheme, and scheme-version values are distinct, trimmed,
non-empty strings. A scheme version is explicit and is never inferred from a
date, filename, import order, or UI state. Unknown JSON-compatible extension
members may be retained without gaining normative meaning.

The unit states only that intrinsic interval coordinates and addresses use the
owning Alignment context's internally consistent length unit. It selects no
physical storage unit.

## Segment relation

The normative segment shape is:

```js
{
  id: "non-empty stable segment identity",
  startS: finiteNumber,
  endS: finiteNumber,
  startAddress: finiteNumber,
  direction: 1 | -1
}
```

For `u = s - startS`:

```text
address(s) = startAddress + direction * u
```

Every segment satisfies `endS > startS`. Segment identities are unique.
Segments are serialized in increasing intrinsic order and their intrinsic
interiors do not overlap. Touching boundaries and intrinsic gaps are valid.
No segment is constructed from chainage-only points without explicit intrinsic
endpoints.

Chainage is an external address relation over intrinsic `s`. It is never
intrinsic identity, constructive geometry, or a substitute for Alignment
identity.

Increasing and decreasing segments are supported. Address ranges may overlap
or have gaps. Touching intrinsic segments may give their shared boundary
different back and ahead addresses, explicitly representing an address jump.

## Lookup semantics

Both segment endpoints are closed relation members.

Intrinsic-to-chainage lookup returns a frozen array, in segment serialization
order, containing zero, one, or multiple frozen records:

```js
{
  segmentId,
  s,
  address,
  schemeId,
  schemeVersion,
  unit: "alignment-length-unit"
}
```

At a touching boundary both segments contribute. No back or ahead candidate is
silently preferred.

Chainage-to-intrinsic lookup solves:

```text
s = startS + direction * (address - startAddress)
```

It retains a candidate when `startS <= s <= endS` and returns frozen records in
segment serialization order:

```js
{
  segmentId,
  address,
  s,
  alignmentId,
  schemeId,
  schemeVersion,
  unit: "alignment-length-unit"
}
```

Overlapping address ranges intentionally produce multiple candidates. A finite
value with no match returns an empty frozen array. Non-finite lookup values are
rejected.

Lookup depends only on mapping state. Horizontal, vertical, cant, topology,
CRS, speed, selection, import, persistence, and UI state neither influence nor
change it.

## Immutability and rejection

Mappings, owned segment arrays, segment records, and returned candidate
arrays/records are frozen. Append operations return a new mapping, retain
unknown members, reuse unchanged frozen segment records, and never mutate the
input.

`ChainageMappingError` uses exactly these codes:

- `INVALID_ID`
- `INVALID_MAPPING`
- `INVALID_SEGMENT`
- `INVALID_DIRECTION`
- `INVALID_DOMAIN`
- `SEGMENT_ALREADY_EXISTS`
- `OUT_OF_ORDER_DOMAIN`
- `OVERLAPPING_INTRINSIC_DOMAIN`
- `INVALID_POSITION`

Order rejection precedes overlap rejection when both conditions apply.
`assertChainageMapping` throws `TypeError` with the supplied context. Rejected
operations leave their input unchanged.

## Re-kilometring invariance

A separate scheme or scheme version may assign different external addresses.
Creating or replacing such a mapping does not mutate Alignment identity,
intrinsic `s`, horizontal, vertical, cant, topology, or physical realization.
Existing scheme versions are not mutated by this contract.

## Dependency boundary

The permitted architectural direction is:

```text
UI/inApp → Application Service → AIM Core → Ports → Adapters
```

This AIM Core module has zero imports. It has no App, browser, UI, adapter,
SPOT, Worker, Messaging, persistence, import, GND, topology, geometry, vertical,
cant, speed, or AXTRAN dependency.

GND EK, LandXML station equations, file stationing, and UI kilometer labels are
external evidence or adapter representations. They are not this Core mapping.

PROFILES-001, PROFILES-002, and Axiomatics are non-canonical comparison
evidence only. They do not define or approve this App contract and are not
architectural authority. This package makes no claim of productive wiring or
persistence.

## Deferred and unauthorized

- productive chainage Application Service wiring;
- persistence or repository technology;
- UI labels or editing;
- import/export adapters or GND EK interpretation;
- topology, line, or network scope integration;
- nonlinear scale factors or unit conversion;
- epochs, validity periods, authority/provenance models, or preferred-candidate
  policy;
- mutation or replacement of existing scheme versions;
- horizontal, vertical, or cant mutation;
- CRS or physical realization;
- speed or applicability;
- AXTRAN or transitionDB coupling;
- generalized undo;
- file relocation or legacy removal.

No placeholder for these responsibilities is established here.
