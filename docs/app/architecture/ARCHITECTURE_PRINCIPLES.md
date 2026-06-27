# ufAIM Architecture Principles

This document summarises the fundamental architectural principles guiding the ufAIM system.

These principles ensure that the system remains consistent while evolving.


---

## 1. Alignment first

The alignment is the primary engineering object.

All infrastructure information — terrain, assets, BIM objects, coordinate systems and project metadata — is organised relative to the alignment.


---

## 2. Mathematical core

The internal alignment representation is intentionally minimal and strict.

The sparse alignment kernel consists only of:

- straight segments
- constant curvature arcs
- transition elements
- arc length parameterisation
- directional continuity

No rendering artefacts or UI-specific data belong in this core.


---

## 3. Rich import, strict kernel

Input data is first mapped to a rich intermediate representation (landFAT).

Only afterwards is the data normalised into the strict sparse alignment kernel.

External formats → landFAT → sparse alignment

This separation keeps the kernel stable while allowing flexible imports.


---

## 4. Import tolerance

Real-world engineering data is rarely perfect.

The import pipeline therefore prioritises **robustness over strict rejection**.

Files may contain:

- incomplete alignments
- auxiliary data
- terrain without alignment
- partial infrastructure models

The system imports what is usable and marks problematic elements instead of rejecting them.


---

## 5. Separation of domains

Different responsibilities are kept separate:

| Domain | Responsibility |
|------|------|
| Import | reading external formats |
| Normalisation | building internal representations |
| Kernel | alignment mathematics |
| Rendering | visualisation |
| Solver | optimisation and correction |
| UI | interaction and editing |

This separation allows components to evolve independently.


---

## 6. Engineering CRS

ufAIM distinguishes between geographic CRS and engineering coordinate spaces.

The **engineering CRS** defines the coordinate workspace in which alignments are analysed and edited.

Multiple CRS may coexist and be translated between when necessary.


---

## 7. Canonical state

The system maintains a canonical state managed by a central authority (Master).

Views, windows and tools operate as clients that interact with this canonical model.

This architecture enables:

- multi-window interaction
- worker-based computation
- distributed rendering and tools


---

## 8. Extensibility

The architecture is designed to grow beyond alignment import.

Future domains include:

- terrain modelling
- BIM infrastructure integration
- network-level optimisation
- solver-assisted design

All extensions must respect the alignment-centric model.


---

## Summary

ufAIM is built around a simple principle:

**Railway infrastructure should be modelled from the alignment outward.**
