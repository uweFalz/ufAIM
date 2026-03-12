# ufAIM Core Concepts

This document summarises the fundamental ideas behind ufAIM.

The system is designed around a single principle:

> Railway infrastructure should be modelled **from the alignment outward**.


---

# 1 Alignment as the primary object

In most GIS, CAD or BIM systems the alignment is a secondary element embedded in drawings or infrastructure models.

ufAIM reverses this perspective.

The alignment is the primary engineering object.  
Terrain, infrastructure assets, coordinate systems and BIM models are referenced relative to it.

Infrastructure
↓
Alignment

becomes

Alignment
↓
Infrastructure

---

---

# 2 Three-space alignment model

An alignment exists simultaneously in three mathematical spaces.

κ(s)  →  θ(s)  →  (x,y)

| Space | Meaning |
|------|---------|
| κ(s) | curvature space |
| θ(s) | direction space |
| (x,y) | geometric space |

The system operates primarily in curvature space.


---

# 3 Sparse alignment kernel

The internal representation of an alignment is intentionally minimal.

Elements alternate between:

FixElement → TransitionElement → FixElement …

| Element | Description |
|-------|-------------|
| FixElement | constant curvature (line or arc) |
| TransitionElement | curvature transition |

This structure allows stable numerical operations and solver integration.


---

# 4 landFAT import model

External formats are first mapped to a rich intermediate representation called **landFAT**.

External formats
↓
landFAT
↓
Sparse alignment kernel

landFAT is:

- based on LandXML concepts
- extended for transition curves
- JSON-native
- tolerant to incomplete data


---

# 5 Topology and geometry

Railway infrastructure is inherently a mixture of topology and geometry.

RailNetwork
│
└── Alignments (edges)
│
└── SparseAlignment

Alignments describe geometry.  
The network layer describes connections between them.


---

# 6 Engineering coordinate space

ufAIM distinguishes between geographic CRS and engineering workspace coordinates.

The **engineering CRS** defines the coordinate environment in which alignments are analysed and edited.

Multiple CRS may coexist and be translated between when necessary.


---

# 7 Solver-ready architecture

Because the alignment kernel operates in curvature space, optimisation methods can be applied directly.

Future solver components will support:

- alignment validation
- correction of inconsistent geometry
- design optimisation
- network-level improvements


---

# 8 Rendering as a derived layer

Geometry used for rendering is derived from the alignment kernel.

SparseAlignment
↓
Sampling
↓
Polyline geometry
↓
Rendering

Rendering engines such as mapLibre and three.js operate only on derived geometry.


---

# Summary

ufAIM is not primarily a viewer or CAD system.

It is an **alignment-centric engineering platform** where railway infrastructure is modelled starting from the mathematical structure of the alignment.

