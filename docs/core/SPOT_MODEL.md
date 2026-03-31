# SPOT Model

This document describes the canonical data model of ufAIM.

## Overview

ufAIM organises its internal data into three distinct classes:

Spot Data      → canonical project model  
Working Set    → candidate project data  
Reference Data → contextual external data

Only **Spot Data** forms the **Single Source of Truth** of the system.

All clients (views, editors and tools) operate on this shared model via the **Master Runtime (SharedWorker)**.

---

# SPOT Data

Spot Data represents the **canonical working model of the project**.

It contains both:

- **engineering objects**
- **relations between those objects**

Examples of Spot objects:

- alignments
- gradients
- cant profiles
- route projects
- CRS definitions

Examples of Spot relations:

- alignment ↔ gradient
- alignment ↔ cant
- alignment ↔ route project
- topology relations between alignments

Spot Data therefore represents the **authoritative engineering state** of the project.

Characteristics:

- single source of truth
- shared across all windows
- editable by clients
- persisted as project state
- used by solvers, editors and visualisation

Spot Data is stored in the **Spot Store**.

Spot Data is not only stored, but actively used, inspected and edited through geometric and structural views.

---

# Spot Store Structure

Minimal conceptual structure:

```text
spotStore
├─ meta
├─ objects
├─ relations
├─ topology
└─ refs
```

refs does not store external models themselves, but only canonical project-side references to them.

Example:

```js
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
```

Objects represent engineering entities.  
Relations describe how these objects interact.

---

# Sparse Alignment Model

The **sparseAlignment** is the canonical geometric representation of railway alignments inside ufAIM.

It represents the alignment as an alternating sequence of:

FixElement → TransitionElement → FixElement

This minimal structure enables deterministic geometry evaluation and robust optimisation.

Structure:

FixElement
TransitionElement
FixElement
TransitionElement
…
FixElement

Rules:

1. The sequence begins with a FixElement  
2. The sequence ends with a FixElement  
3. Elements strictly alternate  
4. Every element defines its start pose (`poseA`)

---

## FixElement

Represents a segment with constant curvature.

```js
FixElement {
  kind: "fixed",
  poseA,
  arcLength,
  curvature,
}
```

Meaning:

- straight line → curvature = 0  
- circular arc → curvature ≠ 0

---

## TransitionElement

Represents a continuous curvature transition between two curvature states.

```js
TransitionElement {
	kind: “transition”,

	poseA,
	arcLength,
	transType,
}
```

Start and end curvature are implicitly derived from neighbouring FixElements.

---

# Graph Interpretation

Although stored as a linear sequence, sparse alignments can be interpreted as two dual graphs.

### Curvature Graph

FixNode –TransitionEdge– FixNode

Nodes represent curvature states.

---

### Geometry Graph

PoseNode –ElementEdge– PoseNode

Nodes represent geometric poses.

---

# Working Set

The **Working Set** contains candidate data that is not yet part of the canonical project model.

Typical sources:

- imported files
- landFAT containers
- unsorted alignments
- experimental geometry

Example:

workingSet = {
    sessionId: null,
    phase: “idle”,

    items: {
        item_001: WorkingItem
    }
}

Working Set data may later be promoted to Spot Data.

The **Grabbeltisch** acts as a user-facing manager for Working Set objects and candidate relations.

---

# Reference Data

Reference Data provides contextual information that is not part of the canonical project model.

Examples:

- IFC models
- terrain models
- GIS layers
- external documentation

Reference Data provides context but does not modify the Spot model.

---

# Import Pipeline -- !!! old version

Import exists solely to produce usable project data.

Typical flow:

External File
↓
Parsing
↓
landFAT container
↓
Normalization
↓
Working Set
↓
User decision
↓
Spot Store

The **Grabbeltisch** allows the user to inspect, organise and relate candidate data before it becomes part of the canonical model.

---

# View Responsibilities

Views provide different ways to work with the same Spot model.

### Geometric Views

Use the spatial content of Spot data.

Examples:

- GeoView
- ProfileView
- SectionView

---

### Structural Views

Focus on relations and project organisation.

Examples:

- Grabbeltisch
- property panels
- relation editors

---

Views do not own the model.

All state-changing operations must go through the **Master Runtime**.

---

# Master Runtime

The Master Runtime (SharedWorker) maintains the canonical project state.

Clients (windows)
│
▼
SharedWorker
│
▼
Spot Store

Principle:

**Data entered anywhere must become available everywhere.**

---

# Core Principle

Spot Data      = canonical project model
Working Set    = candidate data
Reference Data = contextual data

Only **Spot Data** forms the **Single Source of Truth**.

The **sparseAlignment model** forms the geometric backbone of ufAIM and is intentionally minimal, deterministic and solver-friendly.
