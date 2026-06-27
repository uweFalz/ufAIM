ufAIM — Leitlinie

# Core Idea

ufAIM is not a classic file editor.
ufAIM is not a BIM viewer.
ufAIM is not a GIS with alignment plugins.

ufAIM is an alignment-based engineering universe.

The system is built around the idea that infrastructure alignment is not merely geometry, but a central engineering knowledge structure.

Railway infrastructure in particular is fundamentally alignment-based:

* geometrically
* topologically
* operationally
* semantically
* mathematically
* spatially

ufAIM therefore treats alignment not as a drawing artifact, but as a first-class engineering object.

⸻

# What ufAIM Is

ufAIM is:

* object-based
* spatial-first
* alignment-centric
* knowledge-oriented
* multi-view
* sparse-kernel-based
* runtime/service-oriented
* open for third-party data
* capable of combining geometry, semantics and engineering context

The user does not primarily work on files.
The user works inside an engineering universe.

⸻

# What ufAIM Is NOT

ufAIM is not:

* a classic CAD replacement
* a pure BIM platform
* a project-file prison
* an import wizard
* a spreadsheet-style infrastructure tool
* a geometry-only viewer
* a static GIS application

Import is not the final workflow.
Import is merely object creation.

⸻

# The Universe

The highest-level concept of ufAIM is the Universe.

The Universe is the complete engineering working world.

It contains:

* SPOT objects
* spatial context
* technical views
* engineering relations
* external context data
* tools and services
* runtime-derived representations

The Universe is not equivalent to a project file.

A RouteProject is only one possible organizational structure within the Universe.

⸻

# SPOT

SPOT is the canonical engineering object space.

SPOT stores sparse, structured engineering objects.

Examples:

* alignments
* profiles
* cant bands
* station equations
* relations
* object groups
* route projects
* imported objects
* derived objects
* exported artifacts

SPOT is not view-dependent.
SPOT is not import-dependent.
SPOT is not renderer-dependent.

SPOT is the canonical object truth.

⸻

# Workspace

The Workspace is the current active perception and interaction state of the Universe.

It may contain:

* current focus object
* open views
* pinned objects
* active tools
* current map location
* active CRS context
* current technical analysis state
* session state

The Workspace is resumable.

The user should be able to continue working where they left off.

⸻

# Spatial-First Principle

Geo and alignment data are inherently spatial.

Therefore the primary interaction model of ufAIM is spatial-first.

The system should behave more like:

* Apple Maps
* modern GIS systems
* Figma
* Miro

than like:

* a property dialog
* a spreadsheet
* a file-import wizard

Objects should primarily be:

* visible
* selectable
* focusable
* relatable
* explorable

in space.

Lists and tables are secondary access modes.

⸻

# Multiple Access Modes

The same engineering object may be accessed through different views.

Examples:

Spatial Access

“Where is it?”

* mapLibre
* globe
* 2D/3D geometry
* spatial overlays

Structural Access

“How is it organized?”

* object explorer
* route projects
* collections
* groups
* tags
* sources

Technical Access

“What is it technically?”

* q/s band
* profile band
* cant band
* transition editor
* inspectors
* validators
* solver views

Operational Access

“What can be done with it?”

* export
* conversion
* optimization
* analysis
* simulation
* collaboration

These are not separate worlds.
They are different perceptions of the same engineering objects.

⸻

# Sparse Kernel Principle

Sparse engineering data remains canonical.

Derived representations are runtime/service results.

Examples:

* sampled geometry
* pose3
* visualization meshes
* export geometry
* solver states
* analysis buffers

may be cached or derived,

but they are never the canonical truth.

⸻

# pose2 / pose3 Principle

The sparse alignment kernel stores pose2-based geometric information.

pose3 is a runtime/service-level representation.

pose3 is derived from:

* cGeom
* cant
* profile

The sparse kernel remains lightweight and stable.

⸻

# Alignment Kernel

The alignment kernel is based on:

* fixed elements
* transition elements
* curvature-driven integration
* sparse representation
* runtime derivation

The system treats:

* geometry
* cant
* profile
* stationing

as related but distinct engineering layers.

⸻

# User Experience Principle

ufAIM should maximize engineering clarity while minimizing user friction.

The system should:

* help users understand data
* help users contextualize data
* help users trust or reject data
* help users manipulate and transform data
* help users relate data to reality

The system should not force users through rigid workflows.

The user owns the engineering process.

ufAIM assists.

⸻

# Third-Party Context

Alignment objects become significantly more valuable when combined with external context.

Examples:

* OSM
* map tiles
* DEMs
* IFC
* point clouds
* railway assets
* operational information
* environmental data
* future AI services

ufAIM is therefore designed as an extensible engineering universe.

⸻

# Long-Term Direction

The long-term goal is not merely a better alignment editor.

The long-term goal is:

* alignment-centered infrastructure engineering
* knowledge-based engineering
* mathematically rigorous but user-friendly tooling
* spatially understandable infrastructure workflows
* integration of geometry, topology, operation and semantics

The core principle remains:

Alignment is not a side artifact.
Alignment is the central organizing structure.
