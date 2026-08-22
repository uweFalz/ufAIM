# Vertical Constructive State v0.1

Status: App architecture contract, not Knowledge Kernel approval.

Version:

```text
aim-core/vertical-constructive-state/0.1
```

## Normative state

```js
{
  contractVersion: "aim-core/vertical-constructive-state/0.1",
  type: "VerticalConstructiveState",
  id: "non-empty stable vertical-state identity",
  alignmentId: "non-empty stable Alignment identity",
  longitudinalParameter: "intrinsic-s",
  elements: []
}
```

`id` and `alignmentId` are independent, trimmed, stable identities. Elements
are ordered by increasing intrinsic Alignment position `s`. Unknown
JSON-compatible members may be retained but gain no normative meaning.

The state, its owned element array, and owned element records are frozen.
Operations are immutable and never mutate their input.

## Constant longitudinal gradient

```js
{
  id: "non-empty stable element identity",
  type: "constant-gradient",
  startS: finiteNumber,
  endS: finiteNumber,
  startElevation: finiteNumber,
  gradient: finiteNumber
}
```

For `u = s - startS`:

```text
z(s) = startElevation + gradient * u
g(s) = gradient
```

## Parabolic vertical transition

```js
{
  id: "non-empty stable element identity",
  type: "parabolic",
  startS: finiteNumber,
  endS: finiteNumber,
  startElevation: finiteNumber,
  startGradient: finiteNumber,
  gradientRate: finiteNumber
}
```

For `u = s - startS`:

```text
g(s) = startGradient + gradientRate * u
z(s) = startElevation + startGradient * u
       + 0.5 * gradientRate * u * u
```

`s`, `startS`, `endS`, and elevation use one internally consistent length unit
provided by the owning Alignment context. Gradient is dimensionless.
`gradientRate` has inverse-length dimension. The contract chooses no storage
unit, vertical datum, CRS, or external chainage scheme.

Every element has `endS > startS`. Element identities are unique within a
state.

## Ordered composition and continuity

For each element following the first:

- `startS` equals the preceding `endS`;
- `startElevation` equals the preceding law evaluated at its end;
- its starting gradient equals the preceding law's end gradient.

Comparisons use numeric JavaScript `===` after normal arithmetic. There is no
implicit tolerance, rounding, unit conversion, or snapping.

Version 0.1 admits only elevation- and gradient-continuous composition.

## Evaluation and deterministic boundaries

```js
evaluateVerticalAt(state, { s })
```

returns:

```js
{
  elementId,
  s,
  elevation,
  gradient
}
```

Evaluation depends solely on intrinsic `s` and the constructive laws. Positions
before the first element or after the last are rejected. Both external
endpoints are closed. At a shared boundary, the following element owns the
position; the final state endpoint belongs to the final element. Continuity
makes elevation and gradient invariant under this ownership rule.

External chainage, CRS, topology, selection, import evidence, and UI state do
not affect evaluation.

## API

```js
VERTICAL_CONSTRUCTIVE_STATE_VERSION
VerticalConstructiveStateError
isVerticalConstructiveState(value)
assertVerticalConstructiveState(
  value,
  context = "VerticalConstructiveState"
)
createVerticalConstructiveState({ id, alignmentId })
appendVerticalElement(state, element)
evaluateVerticalAt(state, { s })
```

`assertVerticalConstructiveState` returns the identical reference for valid
state and otherwise throws `TypeError` with the supplied context.

Construction, append, and evaluation reject through
`VerticalConstructiveStateError`, whose `code` is one of:

```text
INVALID_ID
INVALID_STATE
INVALID_ELEMENT
UNSUPPORTED_ELEMENT_TYPE
INVALID_DOMAIN
ELEMENT_ALREADY_EXISTS
NON_CONTIGUOUS_DOMAIN
ELEVATION_DISCONTINUITY
GRADIENT_DISCONTINUITY
EMPTY_PROFILE
POSITION_OUTSIDE_DOMAIN
```

Rejection never mutates state.

## Dependency direction

```text
UI/inApp
→ Application Service
→ AIM Core
→ Ports
→ Adapters
```

`VerticalConstructiveState.js` is AIM Core and has zero imports. It has no App,
browser, adapter, SPOT, Worker, Messaging, persistence, import, GND, topology,
horizontal-realization, cant, chainage, AXTRAN, or UI dependency.

The module is not yet wired productively and is not persisted by this package.

Current import representations such as profile points, LandXML PVI/ParaCurve,
and GND EH are external evidence or adapter representations. They are not this
Core state.

PROFILES-001 is non-canonical Research comparison evidence only. It does not
approve or define this App architecture contract.

## Deferred scope

The following are deferred and unauthorized:

- cant and cross-level;
- chainage and kilometring;
- topology integration;
- vertical UI and profile rendering;
- productive Application Service wiring;
- repository and persistence changes;
- vertical datum and CRS realization;
- circular vertical curves;
- higher-order vertical laws;
- discontinuities and exceptional topology;
- tolerance and snapping policy;
- speed and applicability;
- AXTRAN coupling or redesign;
- transitionDB changes;
- GND interpretation or promotion;
- generalized undo;
- file relocation and legacy removal.

No placeholder for these responsibilities is introduced.
