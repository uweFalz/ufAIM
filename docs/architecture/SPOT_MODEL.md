# SPOT Model

This document describes the canonical data model of ufAIM.

SPOT is the central, structured data pool of the application. It is not an object-oriented class model and not a full database system. It is the single accepted engineering truth of the project state.

---

## Overview

ufAIM organises its internal data into three distinct data classes:

```text
Spot Data      -> canonical project model
Working Set    -> candidate project data
Reference Data -> contextual external data
```

Only **Spot Data** forms the **Single Source of Truth** of the system.

All clients, including views, editors, tools and solvers, interact with this shared state via the **Master Runtime (SharedWorker)**.

---

# SPOT Data

Spot Data represents the canonical working model of the project.

It contains:

- validated engineering data,
- confirmed relations between engineering data,
- CRS references used by geometric data,
- minimal topology where connectivity matters.

SPOT contains only data that the application accepts as project truth.

---

## Scope

ufAIM is primarily based on geometric and alignment-related engineering data.

SPOT describes:

- geometry,
- kinematics,
- spatial reference,
- minimal topology,
- engineering relations.

SPOT does **not** primarily describe:

- train operation,
- timetables,
- rolling stock,
- dispatching,
- signalling logic,
- operational capacity models.

ufAIM provides the geometric and alignment-based foundation that systems such as railML may assume or build upon.

---

## Core Data Classes

### Spot Data

Spot Data is the canonical project model.

Examples:

- alignments,
- profiles,
- cant datasets,
- station equations,
- CRS aliases and CRS references,
- route projects,
- confirmed relations,
- topology.

### Working Set

The Working Set contains candidate data not yet accepted into SPOT.

Examples:

- import results,
- landFAT-derived items,
- solver proposals,
- edit proposals,
- experimental geometry.

Working Set data may be displayed, compared and reviewed, but it is not project truth.

### Reference Data

Reference Data provides external context.

Examples:

- IFC context models,
- terrain,
- GIS layers,
- documents,
- external point clouds.

Reference Data is read-only context and is never implicitly promoted to SPOT.

---

# Core Principles

## Single Source of Truth

```text
SPOT is the only accepted engineering truth of the system.
```

Working Set is possibility.
Reference Data is context.

---

## Mutation Rule (critical)

Spot Data may only be mutated through controlled operations in the Master Runtime.

Objects and datasets are treated as immutable by default.
Changes occur only through explicit, validated operations:

- import promotion,
- user edit,
- solver proposal acceptance,
- relation edit,
- topology edit.

Views do not mutate SPOT directly.

```text
Client -> Command -> Master Runtime -> validated mutation -> SPOT -> broadcast -> all clients
```

---

## CRS Rule (critical)

No geometric data may enter SPOT without a valid CRS reference.

```text
No CRS -> no SPOT
Ambiguous CRS -> review
Declared or resolved CRS -> admissible
```

CRS is referenced, not reimplemented.

SPOT stores CRS identifiers and local aliases. Transformations are handled by dedicated CRS infrastructure such as:

- EPSG / epsg.io,
- proj4,
- mapLibre where appropriate,
- ufAIM CRS alias mapping for domain-specific codes such as DB:DR0.

---

# Spot Store Structure

Minimal conceptual structure:

```text
spotStore
├─ meta
├─ crs
├─ objects
├─ relations
├─ topology
└─ refs
```

```js
spotStore = {
	meta: {
		version: "spot.v0.1",
		activeSpotId: null,
		activeRouteProjectId: null,
		engineeringCrsId: null,
		updatedAt: null,
	},

	crs: {
		// crsId -> CrsEntry
	},

	objects: {
		// objectId -> SpotEntry
	},

	relations: {
		// relationId -> RelationEntry
	},

	topology: {
		nodes: {},
		edges: {},
	},

	refs: {},
};
```

---

# CRS Entries

CRS entries describe known CRS references and aliases.

SPOT does not implement CRS transformations. It stores identifiers and enough reference information for the CRS subsystem to resolve them.

```js
CrsEntry = {
	id: "DB:DR0",
	type: "crs",

	authority: "DB",
	code: "DR0",

	status: "declared", // declared | resolved

	mapsTo: "EPSG:25832", // optional; only if known
	source: "db-crs-alias-map",

	name: "DR0",
};
```

Example EPSG entry:

```js
CrsEntry = {
	id: "EPSG:25832",
	type: "crs",

	authority: "EPSG",
	code: "25832",

	status: "resolved",
	source: "epsg.io",

	name: "ETRS89 / UTM zone 32N",
};
```

Rule:

```text
Geo data references CRS by crsId.
CRS details live in spotStore.crs.
Transformations live outside SPOT.
```

---

# Spot Entries

SPOT does not require object-oriented `SpotObject` classes.

Technically, SPOT contains serialisable, addressable data entries.

Minimal structure:

```js
SpotEntry = {
	id: "alignment_001",
	type: "alignment",

	crsId: "DB:DR0",

	data: {}, // type-specific, validated
	refs: {}, // IDs only
};
```

Rules:

```text
No payload bucket.
No parser-native structures.
No embedded foreign format.
No duplicated CRS definitions inside entries.
```

Use `data` for validated type-specific content.
Use `refs` for references to other SPOT entries.

---

# Geometry Representation

## Sparse Alignment

The `sparseAlignment` is the canonical geometric representation used by alignment-related SPOT entries.

It represents the deterministic 2D reference curve of an alignment.

Key properties:

- minimal,
- deterministic,
- solver-friendly,
- independent of visualisation,
- independent of import format.

The full mathematical and structural definition is specified in:

```text
SparseAlignment.md
```

---

## Important Separation

Within SPOT:

- `sparseAlignment` represents geometry only,
- datasets such as profile, cant and station equations remain separate entries,
- relations define how datasets apply to geometry,
- topology defines connectivity across entries.

No profile, cant or station equation data is embedded into an alignment entry as project truth.

---

# Spot Entry Types

## Alignment Entry

An alignment entry stores the canonical horizontal alignment kernel.

```js
AlignmentEntry = {
	id: "alignment_001",
	type: "alignment",
	crsId: "DB:DR0",

	data: {
		name: "1720_3_EK_124840039.8_125060003.4",
		sparseAlignment: {
			startPose: {
				p: { x: 0, y: 0 },
				t: { x: 1, y: 0 },
			},
			sparse: [
				// canonical Fix-Transition-Fix sequence
			],
		},
	},

	refs: {
		profileId: null,
		cantId: null,
		staEquationId: null,
	},
};
```

Rules:

```text
Alignment data contains geometry only.
Profile, cant and station equation datasets are referenced by ID.
```

---

## Profile Entry

A profile entry stores vertical geometry related to an alignment.

```js
ProfileEntry = {
	id: "profile_001",
	type: "profile",
	crsId: "DB:DR0",

	data: {
		name: "profile_001",
		points: [
			{
				s: 125060.003,
				z: 42.13,
				curve: null,
			},
		],
	},

	refs: {
		referenceAlignmentId: "alignment_001",
	},
};
```

Rules:

```text
Profile is not embedded in alignment.
Profile stationing is interpreted relative to its referenced alignment unless explicitly defined otherwise.
```

---

## Cant Entry

A cant entry stores applied cant or cant design values related to an alignment.

```js
CantEntry = {
	id: "cant_001",
	type: "cant",
	crsId: "DB:DR0",

	data: {
		name: "cant_001",
		values: [
			{
				s: 125060.003,
				value: 0.12,
				opt: null,
			},
		],
	},

	refs: {
		referenceAlignmentId: "alignment_001",
	},
};
```

Rules:

```text
Cant is not embedded in alignment.
Cant values are separate engineering data.
Cant may follow alignment curvature by rule, but the dataset remains explicit.
```

---

## Station Equation Entry

A station equation entry stores stationing discontinuities or mappings.

```js
StaEquationEntry = {
	id: "staeq_001",
	type: "staEquation",
	crsId: "DB:DR0",

	data: {
		name: "staeq_001",
		equations: [
			{
				sInternal: 125000.0,
				sExternal: 250000.0,
			},
		],
	},

	refs: {
		referenceAlignmentId: "alignment_001",
	},
};
```

Rules:

```text
Station equations live on the stationing model.
They are not embedded in the sparse alignment geometry.
```

---

## Route Project Entry

A route project groups alignments and related datasets into engineering roles.

```js
RouteProjectEntry = {
	id: "routeProject_001",
	type: "routeProject",
	crsId: "DB:DR0",

	data: {
		name: "Route Project 001",
	},

	refs: {
		referenceLineId: "alignment_ref_001",
		rightTrackId: "alignment_right_001",
		leftTrackIds: [],
		secondaryTrackIds: [],
	},
};
```

Rules:

```text
Route projects do not duplicate alignment data.
They assign roles to existing SPOT entries.
```

---

# Relations

Relations carry semantic dependencies between entries.

Examples:

- alignment uses profile,
- alignment uses cant,
- alignment uses station equation,
- alignment belongs to route project,
- route project assigns alignment role,
- confirmed inter-alignment dependency.

Minimal structure:

```js
RelationEntry = {
	id: "rel_001",
	type: "usesProfile",

	from: {
		type: "alignment",
		id: "alignment_001",
	},

	to: {
		type: "profile",
		id: "profile_001",
	},
};
```

Rules:

```text
Relations are semantic dependencies.
Relations contain no geometry.
Relations contain no topology.
Relations reference entries by ID only.
```

---

# Topology

Topology represents network-level connectivity between entries.

It is distinct from:

- geometry inside entries,
- semantic relations between entries.

Topology is the connectivity layer across objects.

Examples:

- node-edge railway network,
- switch connections,
- branching structures,
- alignment connectivity.

Minimal structure:

```js
topology = {
	nodes: {
		// nodeId -> TopologyNode
	},
	edges: {
		// edgeId -> TopologyEdge
	},
};
```

Rules:

```text
Topology contains connectivity.
Topology contains no semantic interpretation.
Topology does not duplicate sparse geometry.
```

---

# Working Set

The Working Set contains candidate data not yet part of SPOT.

Sources:

- imports,
- landFAT containers,
- solver proposals,
- edit proposals,
- experimental geometry.

```js
workingSet = {
	sessionId: null,
	items: {},
};
```

Rules:

```text
Working Set MUST NOT affect Spot Data unless explicitly promoted.
Working Set may be visualised as candidate data.
Working Set may be compared to SPOT.
Working Set is not project truth.
```

The Grabbeltisch manages Working Set data.

---

# Reference Data

Reference Data provides contextual external information.

Examples:

- IFC,
- terrain,
- GIS layers,
- documents,
- external point clouds.

Rules:

```text
Reference Data is read-only context.
Reference Data is never implicitly promoted to SPOT.
Reference Data may be used for comparison, snapping, interpretation or visualisation.
```

---

# Import and Candidate Pipeline

External data enters the system as candidates.

```text
External File
↓
Parsing
↓
landFAT container
↓
Normalization (CRS-aware)
↓
Working Set
↓
User decision / admission rule
↓
Spot Store
```

Solver results follow the same principle:

```text
Solver Iteration
↓
Solver Proposal
↓
Working Set / Candidate
↓
User decision / admission rule
↓
Spot Store
```

Rules:

```text
Imports do not write SPOT directly.
Solvers do not write SPOT directly.
Only accepted candidates become Spot Data.
```

---

# View Responsibilities

Views render SPOT and optional candidate/context layers.

They do not own or mutate the model.

## Geometric Views

Examples:

- GeoView,
- ProfileView,
- SectionView.

Use geometric projection of Spot Data.

Rules:

```text
A geometric view has an active CRS context.
A geometric view may render only compatible CRS data directly.
Other CRS data must be transformed explicitly or hidden.
```

## Structural Views

Examples:

- SPOT overlay,
- Grabbeltisch,
- property panels,
- relation editors.

Operate on entries and relations.

Rules:

```text
SPOT overlay is read-only.
Cockpit is the action center.
All state-changing actions go through commands.
```

---

# Master Runtime

The Master Runtime (SharedWorker):

- owns Spot Store,
- owns Working Set,
- validates operations,
- applies validated deterministic mutations,
- synchronises all clients,
- broadcasts state changes.

```text
Client -> Command -> Master Runtime -> Spot Store -> Broadcast -> Clients
```

---

# Final Statement

SPOT is the only accepted engineering truth of ufAIM.

Working Set is possibility.
Reference Data is context.

The sparse alignment model provides the geometric backbone of ufAIM.
SPOT defines the canonical structure in which geometric engineering data, CRS references, relations, topology and interpretations are organised.
