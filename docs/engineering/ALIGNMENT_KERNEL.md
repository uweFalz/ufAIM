# Alignment Kernel

Sparse alignment, transitions, sampling and solver preparation.

## Core decision

The sparse alignment kernel stores geometry as `pose2`-anchored cGeom.
It does not store `pose3` as canonical truth.

`pose3` is derived at runtime from:

- `cGeom`
- `cant`
- `profile`

## cGeom

`cGeom` is the planar integration kernel.

Each element stores:

- `pose2` initial value anchor
- `arcLength`
- curvature value or curvature function reference
- element type: `fixed` or `transition`

## cant

`cant` is a sibling band of `cGeom`.

Rules:

- cant is correlated with `fixedElement`
- cant has no independent stationing world
- cant stores rail height difference, not roll angle
- roll angle is derived from `cant / gauge`
- cant uses the curvature family of the related cGeom transition
- optional station deltas handle rare non-corresponding ramp starts/ends

Minimal shape:

```js
cant: {
	type: "cantBand",
	unit: "heightDifference",
	reference: "trackCenter",
	gaugeRef: "objectGauge",

	elements: [
		{
			cGeomElementId: "el_012",
			startCant: 0.120,
			endCant: 0.000,
			startStationDelta: 0.0,
			endStationDelta: 0.0,
			flags: []
		}
	]
}

profile

profile is a separate vertical band.

It provides height evaluation for runtime pose3, but does not belong into pose2.

staEq

staEq is organizational stationing metadata.

It has no geometric role in the kernel.

pose3

pose3 is a runtime/service result:

pose3(s) = pose2(s) + profile(s) + cant(s)

pose3(s) = pose2(s) + profile(s) + cant(s)

It is used by viewers, exports, analysis, clearance checks and solver services.
It is not stored as sparse truth.

Principle

The kernel stays sparse.

Derived data may be cached, but cache is never canonical truth.

1. cGeom = pose2 + Krümmung
2. cant = fixedElement-korreliertes Band
3. profile = PVI/NW-basiertes Höhenband
4. staEq = äußere Stationsbeschriftung, keine Geometrie
5. pose3 = Runtime-Service
