Overview

ufAIM organizes its internal data into three distinct classes:

Spot Data      → canonical project model
Working Set    → temporary candidate data
Reference Data → contextual external data

Only Spot Data forms the Single Source of Truth of the system.

All clients (views, editors, tools) operate on this shared model via the Master Runtime (SharedWorker).

⸻

1. Spot Data

Spot Data represents the canonical working model of the project.

Characteristics:
	•	single source of truth
	•	shared across all windows
	•	editable by clients
	•	persisted as project state
	•	used by solvers, editors and visualisation

Example Spot objects:

alignment (sparse)
gradient
cant
topology relations
engineering CRS

Spot Data is stored in the Spot Store.

⸻

Spot Store Structure

Minimal structure:

spotStore
 ├─ meta
 ├─ spots
 ├─ routeProjects
 ├─ topology
 └─ refs
 
 Example:
 
 spotStore = {

  meta: {
    activeSpotId: null,
    activeRouteProjectId: null,
    engineeringCrsId: null
  },

  spots: {
    spot_001: SpotObject,
    spot_002: SpotObject
  },

  routeProjects: {},

  topology: {
    nodes: {},
    edges: {}
  },

  refs: {}
}


⸻

Spot Object

Example alignment spot:

spot = {
  id: "spot_001",
  kind: "alignment",
  role: "primary",

  name: "Main Track",

  model: {
    type: "sparseAlignment",
    data: {
      startPose: {
        pnt: { x: 0, y: 0 },
        dir: { cos: 1, sin: 0 }
      },

      elements: [
        { type: "G", arcLength: 120 },
        { type: "transition", transitionCurve: "clothoid" },
        { type: "R", curvature: 0.0012 }
      ]
    }
  },

  status: {
    editable: true,
    valid: true,
    dirty: false
  },

  provenance: {
    sourceFormat: "landXML",
    sourceFile: "example.xml"
  },

  links: {
    routeProjectId: null
  }
}


⸻

2. Working Set

The Working Set contains temporary data that may later become Spot Data.

Typical sources:

imports
landFAT containers
unsorted alignments
candidate geometry

Working Set objects are not part of the canonical model.

Example structure:

workingSet = {
  sessionId: null,
  phase: "idle",

  items: {
    item_001: WorkingItem
  }
}

Example WorkingItem:

workingItem = {
  id: "wrk_001",

  kind: "landFATAlignment",

  name: "Alignment A",

  source: {
    file: "route.xml",
    format: "landXML"
  },

  payload: { ...landFAT... },

  status: {
    selected: false,
    validated: false
  }
}

The Grabbeltisch acts as manager for the Working Set.

⸻

3. Reference Data

Reference Data represents contextual information that is not part of the canonical project model.

Examples:

IFC models
terrain / DGM
GIS layers
external documentation
environment data

Reference Data is stored separately:

referenceStore = {
  items: {
    ref_001: ReferenceObject
  }
}

Example:

reference = {
  id: "ref_ifc_001",
  kind: "ifcModel",

  source: {
    file: "bridge.ifc",
    format: "IFC"
  },

  status: {
    visible: true
  }
}


⸻

4. Import Pipeline

Import is not the goal of the system.

Its only purpose is to produce usable Spot Data.

Typical flow:

External File
      ↓
Parsing
      ↓
landFAT container
      ↓
Normalization
      ↓
sparse alignment
      ↓
Spot Store

landFAT is therefore a conversion interface, not a model format.

⸻

5. Master Runtime

The Master Runtime (SharedWorker) maintains the canonical state.

Clients (windows)
       │
       ▼
SharedWorker
       │
       ▼
Spot Store

All state-changing operations must go through the Master Runtime.

Principle:

Data entered anywhere must become available everywhere.


⸻

6. View Responsibilities

Views do not own the model.

Examples:

GeoView           → visualises Spot Data
transEd           → edits curvature model
Grabbeltisch      → manages Working Set

All views communicate with the Master Runtime via the messaging system.

⸻

Core Principle

Spot Data = canonical project model
Working Set = candidate data
Reference Data = contextual data

Only Spot Data forms the Single Source of Truth.
