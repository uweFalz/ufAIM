# Alignment Kernel

Sparse alignment, transitions, sampling, validation and solver preparation.

## Purpose

The alignment kernel defines the canonical sparse representation used inside ufAIM.

It is intentionally compact. It stores engineering intent and mathematical structure, not sampled geometry. Dense geometry, 3D poses, rendered meshes, clearance envelopes and solver-specific data are derived by runtime services.

## Core Decision

The sparse alignment kernel stores horizontal geometry as `pose2`-anchored `cGeom`.

It does not store `pose3` as canonical truth.

`pose3` is derived at runtime from:

- `cGeom`
- `cant`
- `profile`

The kernel remains sparse. Derived data may be cached, but cache is never canonical truth.

## Alignment Object

Minimal kernel shape:

```js
alignment: {
	type: "sparseAlignment",
	name: "alignment name",

	startPose: pose2,

	elements: [],

	bands: {
		cant: null,
		profile: null,
		staEq: null
	},

	meta: {}
}
```

The top-level `elements` array is the horizontal `cGeom` sequence.

## pose2

`pose2` carries the initial values of the planar alignment initial value problem.

It contains:

- a 2D point
- a 2D direction

Example:

```js
pose2: {
	p: { x: 3500000.0, y: 5960000.0 },
	dir: { dx: 1.0, dy: 0.0 }
}
```

`pose2` belongs to the horizontal integration kernel.

It does not contain:

- height
- roll
- speed
- station equation state

## cGeom

`cGeom` is the planar integration kernel.

It is represented by an ordered alternation of fixed elements and transition elements.

Each element stores:

- `id`
- `type`
- `poseA`
- `arcLength`
- curvature value or curvature function reference
- optional metadata

### Fixed Element

A fixed element has constant curvature.

```js
{
	id: "el_0001",
	type: "fixed",
	poseA: pose2,
	arcLength: 120.0,
	curvature: 0.0,
	meta: {}
}
```

Lines are fixed elements with curvature `0`.

Circular arcs are fixed elements with curvature `1 / radius` including sign.

### Transition Element

A transition element has a curvature function.

```js
{
	id: "el_0002",
	type: "transition",
	poseA: pose2,
	arcLength: 80.0,
	transType: "clothoid",
	curvature: {
		from: 0.0,
		to: 0.00125
	},
	meta: {}
}
```

The exact transition function is resolved by the transition registry / calculation framework.

### Principle

`cGeom` computes planar position and planar tangent direction.

It is the only part of the kernel that requires `pose2` as an initial value anchor.

## cant

`cant` is a sibling band of `cGeom`.

It stores rail height difference, not roll angle.

Roll angle is derived at runtime:

```txt
roll = atan(cant / gauge)
```

### Rules

- `cant` is correlated with `cGeom` fixed elements.
- `cant` has no independent stationing world.
- `cant` has no own `pose2` or `pose3`.
- `cant` stores start/end rail height difference values.
- `cant` uses the curvature family of the related `cGeom` transition.
- No separate `cantFcnRef` is stored in the normal model.
- Optional station deltas handle rare non-corresponding ramp starts/ends.

### Shape

```js
cant: {
	type: "cantBand",
	unit: "m",
	valueSemantics: "railHeightDifference",
	reference: "trackCenter",
	gaugeRef: "objectGauge",

	functionRule: "useRelatedCGeomCurvatureFamily",

	elements: [
		{
			cGeomElementId: "el_0001",

			startCant: 0.120,
			endCant: 0.120,

			startStationDelta: 0.0,
			endStationDelta: 0.0,

			flags: []
		}
	]
}
```

### Fixed Cant

For constant cant:

```js
{
	cGeomElementId: "el_0001",
	startCant: 0.120,
	endCant: 0.120
}
```

### Cant Ramp

For changing cant:

```js
{
	cGeomElementId: "el_0002",
	startCant: 0.120,
	endCant: 0.000,
	startStationDelta: 0.0,
	endStationDelta: 0.0
}
```

The runtime function follows the related curvature family.

In simplified form:

```txt
u(s) = u0 + (u1 - u0) * kappaHat(s / L)
```

For Schwerpunkttrassierung, the cant development may remain based on the normal transition function while the curvature function receives an additional correction term.

### Important Distinction

`cant` is coupled to `cGeom`, but it is not stored inside `cGeom`.

`cGeom` and `cant` are sibling bands.

`pose3` is their shared runtime result.

## profile

`profile` is a separate vertical band.

It provides height evaluation for runtime `pose3`, but does not belong into `pose2`.

The sparse truth is PVI/NW-based.

This means the kernel stores vertical intersection points and optional vertical curve information at the PVI/NW.

### Shape

```js
profile: {
	type: "profileBand",
	reference: "trackCenter",
	stationRef: "own",
	unit: "m",

	pvis: [
		{
			s: 1234.0,
			z: 456.789,

			verticalCurve: {
				type: "arc",
				length: 80.0,
				radius: 12000.0
			}
		}
	]
}
```

### Rules

- `profile` acts separately from `cGeom` and `cant`.
- `profile` is evaluated over station `s`.
- PVI/NW is the preferred sparse truth.
- Ausrundungsanfang and Ausrundungsende are derived calculation points where possible.
- Formats that provide curve begin/end points may be converted back into PVI/NW form when possible.

### Rationale

Both common source representations carry approximation issues for vertical curves.

The PVI/NW form keeps the sparse engineering data cleaner. Derived curve begin/end points belong to calculation, validation or export services, not to the canonical sparse truth unless the source provides no better information.

## staEq

`staEq` is organizational stationing metadata.

It has no geometric role in the kernel.

It must not modify the internal geometric stationing of the reference line.

### Core Rule

The internal stationing remains monotone and geometrically true.

External stationing is label and organization logic.

### Shape

```js
staEq: {
	type: "stationEquationBand",
	reference: "refLine",
	internalStationUnit: "m",

	equations: [
		{
			s: 2500.0,

			before: {
				raw: "12+345",
				value: 12345.0,
				branch: "before",
				quality: "exact"
			},

			after: {
				raw: "12+678",
				value: 12678.0,
				branch: "after",
				quality: "exact"
			},

			delta: 333.0,
			type: "jump"
		}
	]
}
```

### Rules

- `s` is the internal station of the reference line.
- `before` and `after` describe external station labels.
- Overlength and ambiguous external stations may be stored as raw labels.
- Numeric external station values are optional.
- `staEq` is not a `cGeom` element.
- `staEq` is not part of geometry integration.
- `staEq` is used for display, organization, import/export and user communication.

## pose3

`pose3` is a runtime/service result.

It is not stored as sparse truth.

Conceptually:

```txt
pose3(s) = pose2(s) + profile(s) + cant(s)
```

More explicitly:

```txt
pose2(s)      -> planar point and tangent from cGeom
profile(s)   -> height
cant(s)      -> rail height difference
gauge(s)     -> gauge value
roll(s)      -> atan(cant(s) / gauge(s))
pose3(s)     -> 3D point + tangent frame + roll
```

`pose3` is used by:

- viewers
- exports
- analysis
- clearance checks
- dynamic section views
- solver services
- downstream BIM / GIS interfaces

## Speed

Speed is not immanent to `pose`.

Arc-length parametrization means:

```txt
|d gamma / ds| = 1
```

This is geometric unit speed along station `s`, not operational train speed.

Operational speed is derived from:

- geometry
- cant
- rules
- operating assumptions
- optional source declarations

Possible runtime shape:

```js
dynamics: {
	speedRange: null,
	designSpeed: null,
	limitSpeed: null,
	source: "derived"
}
```

## Point Data

SPOT is not a point database.

Point data may exist as optional observation, control, survey or reference data.

It does not own the alignment.

Possible point layer:

```js
pointSet: {
	type: "pointSet",
	role: "survey",
	data: {
		points: []
	},
	meta: {
		crsId: null,
		source: null
	}
}
```

Alignment remains the core knowledge object.

Point data can support:

- checking
- fitting
- reconstruction
- documentation
- quality control

## RouteProject and Relations

The kernel is alignment-based.

Topology is represented through relations, not by making the element graph the primary storage truth.

Possible relation examples:

```js
relations: [
	{ type: "stationReference", from: "track_1", to: "km_line" },
	{ type: "parallelTo", from: "left_track", to: "right_track" },
	{ type: "samePhysical", from: "obj_dbref", to: "obj_gk" },
	{ type: "belongsToRouteProject", from: "track_1", to: "rp_001" }
]
```

A RouteProject is a contextual grouping of alignments and related bands.

It is not limited to the classical DB 7-line model, but it can represent it.

## Validation Levels

The sparse kernel allows staged validation.

Suggested levels:

```txt
raw
structural
geometric
engineering
exportReady
```

### Meaning

`raw`:
Imported and stored, not yet trusted.

`structural`:
Shape and required fields are valid.

`geometric`:
Continuity, element lengths, curvature signs and pose integration are plausible.

`engineering`:
Railway-specific semantics, cant/profile consistency, gauge and rule checks are plausible.

`exportReady`:
Ready for a specific target schema or exchange format.

## Storage Principle

The kernel stores:

- sparse structure
- engineering semantics
- source-aware metadata
- enough information to reconstruct geometry

The kernel does not store:

- dense sampled polylines as truth
- meshes as truth
- `pose3` as truth
- point databases as truth
- station equations as geometry

## Summary

Kernel decisions:

1. `cGeom` = `pose2` + curvature.
2. `cant` = fixedElement-correlated sibling band.
3. `profile` = PVI/NW-based vertical band.
4. `staEq` = external station labelling, not geometry.
5. `pose3` = runtime/service result.
6. Speed is derived, not immanent.
7. The kernel stays sparse.
8. Derived cache is never canonical truth.
