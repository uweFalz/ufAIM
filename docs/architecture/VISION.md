# ufAIM Vision

## Alignment-Based Information Modelling

ufAIM is an engineering system for railway infrastructure that places the **alignment** at the center of the model.

In most GIS, CAD or BIM systems the alignment is treated as a secondary object inside larger containers such as maps, models or document structures.  
ufAIM reverses this perspective.

The alignment is the primary object.  
Everything else is organised around it.

Terrain, infrastructure assets, BIM objects, coordinate systems and project data are referenced relative to the alignment and its geometry.


---

## Why ufAIM exists

Railway infrastructure design and maintenance fundamentally revolve around the alignment:

- geometry
- curvature
- transition curves
- stationing
- speed constraints
- cant and gradients

Despite this, most software environments treat alignments as a side element inside CAD drawings, GIS layers or BIM containers.

ufAIM was created to work **directly on the mathematical structure of alignments**.

Instead of managing files or models first, ufAIM manages **the alignment itself**.

Railway infrastructure is inherently a hybrid of geometry and topology.
ufAIM models the geometric structure of alignments while allowing them to be embedded into a topological network representation.


---

## Mathematical core

At its heart, ufAIM treats railway alignments as mathematical objects.

The internal alignment kernel is intentionally minimal and strict:

- straight segments
- constant curvature arcs
- transition elements (e.g. clothoids)
- explicit arc length parametrisation
- direction and curvature continuity

This **sparse alignment model** provides a stable foundation for:

- validation
- editing
- optimisation
- simulation
- geometric analysis


---

## Import philosophy

Real-world data arrives in many formats.

ufAIM therefore uses a two-stage representation:

### landFAT

A rich intermediate representation derived primarily from LandXML concepts.

landFAT is:

- **LandXML-compatible**
- **extended for transition curves**
- **JSON-based for internal processing**

All supported input formats are first translated into this common structure.


### sparse alignment

The strict internal alignment kernel used for computation and modelling.

landFAT data is normalised into sparse alignment objects that can be analysed, visualised and optimised.


---

## Engineering CRS

ufAIM distinguishes between geographic coordinate systems and the **engineering workspace**.

The engineering CRS defines the coordinate environment in which the alignment is analysed and edited.

Multiple coordinate systems can coexist:

- WGS84 / map projections
- national railway reference systems
- project-specific engineering coordinates

The system provides mechanisms to translate between them while preserving alignment precision.


---

## Beyond viewing: solving

ufAIM is not only intended to visualise railway geometry.

It is designed to **compute, analyse and improve alignments**.

Future components include optimisation approaches inspired by classical railway alignment solvers such as AXTRAN, extended with modern numerical and graph-based methods.

The goal is a system that can:

- analyse existing alignments
- detect inconsistencies
- assist with design optimisation
- support complex rail networks


---

## Alignment first

The guiding principle of ufAIM can be summarised simply:

> Railway infrastructure should be modelled **from the alignment outward**, not the other way around.

ufAIM therefore places the alignment at the centre of infrastructure information modelling.
