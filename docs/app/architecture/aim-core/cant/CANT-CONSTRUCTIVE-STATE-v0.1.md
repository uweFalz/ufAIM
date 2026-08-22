# Cant Constructive State v0.1

Status: App architecture contract. This document does not modify or replace
Knowledge Kernel authority.

## Contract

The exact contract version is:

```text
aim-core/cant-constructive-state/0.1
```

The normative state shape is:

```js
{
  contractVersion: "aim-core/cant-constructive-state/0.1",
  type: "CantConstructiveState",
  id: "non-empty stable cant-state identity",
  alignmentId: "non-empty stable Alignment identity",
  longitudinalParameter: "intrinsic-s",
  quantity: "cross-level",
  unit: "alignment-length-unit",
  signConvention: "left-minus-right-viewed-in-increasing-s",
  elements: []
}
```

State identity and Alignment identity are independent, trimmed, non-empty
strings. Elements are ordered by increasing intrinsic longitudinal position
`s`. Unknown JSON-compatible extension members may be retained but receive no
normative meaning.

Cross-level is the left rail-head elevation minus the right rail-head elevation
when viewed in the direction of increasing intrinsic `s`. Positive cross-level
means the left rail is higher. It uses the owning Alignment context's internally
consistent length unit.

The contract implies no gauge, roll angle, vehicle, speed, horizontal curvature,
equilibrium cant, deficiency, comfort, or regulatory meaning. It authorizes no
automatic conversion between cross-level and angle.

## Constructive laws

A constant-cross-level element is:

```js
{
  id,
  type: "constant-cross-level",
  startS,
  endS,
  startCrossLevel
}
```

For `u = s - startS`:

```text
c(s) = startCrossLevel
twist(s) = 0
```

A linear-cross-level element is:

```js
{
  id,
  type: "linear-cross-level",
  startS,
  endS,
  startCrossLevel,
  crossLevelRate
}
```

For `u = s - startS`:

```text
c(s) = startCrossLevel + crossLevelRate * u
twist(s) = crossLevelRate
```

`s`, interval bounds, and cross-level use the same Alignment length unit.
`crossLevelRate` is dimensionless. Every domain satisfies `endS > startS`.
Element identities are non-empty and unique.

## Composition and evaluation

Each element after the first starts exactly at the preceding `endS` and its
`startCrossLevel` equals the preceding law evaluated there. Comparison uses
numeric `===` after ordinary JavaScript arithmetic. No tolerance, rounding,
conversion, or snapping is implicit.

Version 0.1 requires cross-level continuity but permits twist changes at typed
element boundaries.

Evaluation returns exactly:

```js
{
  elementId,
  s,
  crossLevel,
  twist,
  quantity: "cross-level",
  unit: "alignment-length-unit",
  signConvention: "left-minus-right-viewed-in-increasing-s"
}
```

External endpoints are closed. At a shared boundary the following element owns
the position, except that the final endpoint belongs to the final element.
Empty states, non-finite positions, and positions outside the total domain are
rejected.

Evaluation depends only on intrinsic `s`, the constructive laws, and the fixed
quantity, unit, and sign convention. Chainage, CRS, topology, horizontal
curvature, vertical state, speed, gauge, selection, import evidence, and UI
state do not affect it.

## Identity, immutability, and rejection

State and element identities remain stable. Creation and append operations
freeze state-owned top-level values, element arrays, and element records.
Append returns a new state, preserves unknown extension members, reuses
unchanged frozen element records, and never mutates its input.

`CantConstructiveStateError` uses these codes:

- `INVALID_ID`
- `INVALID_STATE`
- `INVALID_ELEMENT`
- `UNSUPPORTED_ELEMENT_TYPE`
- `INVALID_DOMAIN`
- `ELEMENT_ALREADY_EXISTS`
- `NON_CONTIGUOUS_DOMAIN`
- `CROSS_LEVEL_DISCONTINUITY`
- `EMPTY_CANT`
- `POSITION_OUTSIDE_DOMAIN`

`assertCantConstructiveState` throws `TypeError` with the supplied context.
Rejected operations leave their input unchanged.

## Dependency boundary

The permitted architectural direction is:

```text
UI/inApp → Application Service → AIM Core → Ports → Adapters
```

This module is AIM Core and has zero imports. It has no App, browser, UI,
adapter, persistence, Worker, Messaging, SPOT, import, GND, topology, vertical,
horizontal, speed, gauge, or AXTRAN dependency.

Import cant points, LandXML cant records, and GND EU are external evidence or
adapter representations. They are not this Core state.

PROFILES-001 and PROFILES-002 are non-canonical comparison evidence only. They
do not define or approve this App contract and are not architectural authority.
This package makes no claim that cant state is productively wired or persisted.

## Deferred and unauthorized

- chainage or kilometring;
- productive vertical or cant Application Service wiring;
- topology integration;
- UI, band, or profile rendering;
- persistence or repository changes;
- angle-based cant or gauge conversion;
- nonlinear Bloss, cosine, Helmert, sine, or Viennese laws;
- discontinuities, tolerance, or snapping;
- horizontal-curvature, speed, vehicle, equilibrium-cant, cant-deficiency,
  comfort, or regulatory coupling;
- AXTRAN or transitionDB coupling or redesign;
- GND interpretation or promotion;
- import or export contracts;
- generalized undo;
- file relocation or legacy removal.

No placeholder for these responsibilities is established by this contract.
