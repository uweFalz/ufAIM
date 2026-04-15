# SPOT Model

This document describes the canonical data model of ufAIM.

---

## Overview

ufAIM organises its internal data into three distinct classes:

Spot Data      → canonical project model  
Working Set    → candidate project data  
Reference Data → contextual external data  

Only **Spot Data** forms the **Single Source of Truth** of the system.

All clients (views, editors and tools) operate on this shared model via the **Master Runtime (SharedWorker)**.

---

# SPOT Data

Spot Data represents the canonical working model of the project.

It contains both:
- engineering objects
- relations between those objects

---

## Objects

Objects carry geometry and domain content.

Examples:
- alignments
- gradients
- cant profiles
- route projects
- CRS definitions

---

## Relations

Relations carry semantic dependencies between objects.

Examples:
- alignment ↔ gradient
- alignment ↔ cant
- alignment ↔ route project
- inter-alignment dependencies
- construction / operational dependencies

---

## Core Properties

Spot Data is:
- single source of truth
- shared across all windows
- editable only via Master Runtime
- persisted as project state
- used by solvers, editors and visualisation

---

## Mutation Rule (critical)

Spot Data may only be mutated via controlled operations in the Master Runtime.

Objects are treated as immutable by default.  
Changes occur via explicit operations (edit, solver, import promotion).

---

## Spot Store Structure

Minimal conceptual structure:

```text
spotStore
├─ meta
├─ objects
├─ relations
├─ topology
└─ refs

spotStore = {

	meta: {
		activeSpotId: null,
		activeRouteProjectId: null,
		engineeringCrsId: null
	},

	objects: {
		spot_001: SpotObject,
		spot_002: SpotObject
	},

	relations: {
		rel_001: RelationObject
	},

	topology: {
		nodes: {},
		edges: {}
	},

	refs: {}
}


⸻

SpotObject

Minimal structure:

SpotObject {
  id,
  type,
  spatialRef,
  payload
}


⸻

Spatial Reference (critical)

Each object carries its own spatial reference.

spatialRef = {
  horizontalCrsId,
  verticalCrsId,
  status   // declared | inferred | unknown
}

Notes:
	•	CRS is always referenced, never implemented
	•	Transformation is handled externally (proj4 / mapLibre)
	•	CRS is context, not geometry

⸻

Geometry Representation

Sparse Alignment

The sparseAlignment is the canonical geometric representation
used by alignment-related SPOT objects.

It represents the deterministic 2D reference curve of an alignment.

Key properties:
	•	minimal
	•	deterministic
	•	solver-friendly
	•	independent of visualisation

The full mathematical and structural definition is specified in:

→ SparseAlignment.MD

⸻

Important Separation

Within SPOT:
	•	sparseAlignment represents geometry only
	•	datasets such as profile, cant, and staEq remain separate objects
	•	relations define how these datasets apply to geometry

⸻

Topology

Topology represents network-level connectivity between objects.

It is distinct from:
	•	geometry (inside objects)
	•	relations (semantic dependencies)

Topology = connectivity layer across objects

Examples:
	•	node-edge railway network
	•	switch connections
	•	branching structures

⸻

Working Set

The Working Set contains candidate data not yet part of SPOT.

Sources:
	•	imports
	•	landFAT containers
	•	experimental geometry

workingSet = {
  sessionId,
  items: {}
}


⸻

Rule

Working Set MUST NOT affect Spot Data unless explicitly promoted.

The Grabbeltisch manages Working Set data.

⸻

Reference Data

Reference Data provides contextual external information.

Examples:
	•	IFC
	•	terrain
	•	GIS
	•	documents

⸻

Rule

Reference Data is read-only and never promoted to Spot Data.

⸻

Import Pipeline

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
User decision
↓
Spot Store

⸻

View Responsibilities

Geometric Views
	•	GeoView
	•	ProfileView
	•	SectionView

Use geometric projection of Spot data.

⸻

Structural Views
	•	Grabbeltisch
	•	property panels
	•	relation editors

Operate on object/relations directly.

⸻

Rule

Views do not own or mutate the model.

⸻

Master Runtime

The Master Runtime (SharedWorker):
	•	owns Spot Store
	•	validates operations
	•	applies mutations
	•	synchronises all clients

Client → Command → Master Runtime → Spot Store

⸻

Core Principle

Spot Data      = canonical model
Working Set    = candidates
Reference Data = context

⸻

Final Statement

SPOT is truth.
Working Set is possibility.
Reference Data is context.

The sparse alignment model provides the geometric backbone of ufAIM,
while SPOT defines the canonical structure in which all engineering data,
relations and interpretations are organised.
