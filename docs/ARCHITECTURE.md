# Architecture

This document describes the architectural principles and core concepts
behind ufAIM.

ufAIM is designed as an engineering-grade alignment framework with a
lightweight reference application.
Its primary goal is not visual completeness, but deterministic,
auditable, and optimizable alignment representations for infrastructure projects.

Dieses Dokument beschreibt die architektonischen Grundprinzipien und
Kernkonzepte von ufAIM.

ufAIM ist als ingenieurzentriertes Alignment-Framework mit einer
bewusst schlank gehaltenen Referenzanwendung konzipiert.
Im Vordergrund stehen deterministische, nachvollziehbare und
optimierbare Trassenrepräsentationen – nicht maximale visuelle Vollständigkeit.

## Design Principles

ufAIM follows a small set of explicit architectural principles:

- Alignments are treated as first-class engineering objects
- Deterministic parametrization is preferred over implicit geometry
- Engineering logic is strictly separated from visualization and UI
- Numerical robustness and auditability take precedence over visual fidelity
- Derived geometry must never replace the underlying design intent

ufAIM folgt einer bewusst kleinen Anzahl klarer architektonischer Prinzipien:

- Achsen und Trassen sind primäre Engineering-Objekte
- Explizite Parametrisierung wird impliziter Geometrie vorgezogen
- Ingenieur-Logik ist strikt von Visualisierung und UI getrennt
- Numerische Robustheit und Auditierbarkeit haben Vorrang vor Visualisierung
- Abgeleitete Geometrie darf niemals den Entwurfsinhalt ersetzen

## Model-Centric Tool Architecture

ufAIM follows a model-centric architecture in which a canonical
engineering model is shared between multiple specialized tools.

The core model represents the single source of truth for all
engineering-relevant data. Tools and views do not replicate this model
but access it through well-defined commands and events.

Specialized editors and viewers operate as focused tools around the
shared model rather than as parts of a monolithic application.
Examples include alignment editors, transition editors, geometry
visualizers, and working-set managers such as the "Grabbeltisch".

Each tool retrieves only the information it needs and reacts to
domain-level change events instead of maintaining full mirrored state.

This architecture allows ufAIM to evolve as a modular engineering
workbench where specialized tools collaborate on the same canonical
alignment model.

---

ufAIM folgt einer modellzentrierten Architektur, in der ein kanonisches
Engineering-Modell von mehreren spezialisierten Werkzeugen gemeinsam
genutzt wird.

Das Kernmodell stellt die einzige maßgebliche Quelle aller
ingenieurrelevanten Daten dar (Single Source of Truth).
Werkzeuge und Views replizieren dieses Modell nicht,
sondern greifen über klar definierte Commands und Events darauf zu.

Editoren und Viewer sind als spezialisierte Werkzeuge um das gemeinsame
Modell organisiert, nicht als Teil einer monolithischen Anwendung.
Beispiele sind Alignment-Editoren, Transition-Editoren,
Geometrie-Viewer oder Working-Set-Manager wie der „Grabbeltisch“.

Jedes Werkzeug bezieht nur die Informationen, die es benötigt,
und reagiert auf fachliche Änderungsereignisse statt vollständige
Zustandsspiegel vorzuhalten.

Diese Architektur ermöglicht es ufAIM, sich als modulare
Engineering-Workbench zu entwickeln, in der mehrere spezialisierte
Werkzeuge auf demselben kanonischen Alignment-Modell arbeiten.

## Sparse Alignment Core

At the center of ufAIM lies the sparse alignment representation.

A sparse alignment is defined as an alternating sequence of:

- fixed elements with constant curvature (line, arc)
- transition elements with explicitly defined curvature evolution

Continuity in position, direction, and curvature is enforced at all element boundaries.
The first and last elements are always fixed elements.

Im Zentrum von ufAIM steht die Sparse-Alignment-Repräsentation.

Ein Sparse Alignment ist als alternierende Sequenz aus

- Fixelementen mit konstanter Krümmung (Gerade, Kreisbogen)
- Übergangselementen mit explizit definierter Krümmungsentwicklung

definiert.

An allen Elementgrenzen werden Lage-, Richtungs- und Krümmungsidentität
erzwingend eingehalten.
Das erste und letzte Element sind stets Fixelemente.

### Transition Families

Transition elements are not hard-coded.

Instead, ufAIM introduces transition families that define
how curvature evolves over arc length.
This allows different transition models to coexist within the same alignment core.

The current reference implementation uses a three-piece (3pcs)
Berlin-style schema consisting of:

- a half-wave entry segment
- a clothoid core segment
- a half-wave exit segment

Transition families are evaluated via lookup tables and edited using the transition editor.

## Multiband Representation

While 3D visualization is useful for communication,
engineering decisions are primarily based on functional representations.

ufAIM therefore emphasizes multiband views along the alignment axis,
including but not limited to:

- curvature κ(s)
- gradient i(s)
- cant u(s)
- speed, travel time, and comfort-related measures

The 3D geometry is treated as a derived visualization of these bands,
not as the primary design representation.

Während 3D-Darstellungen für Kommunikation und Kontext hilfreich sind,
basieren ingenieurtechnische Entscheidungen primär auf Funktionsverläufen.

ufAIM legt daher den Schwerpunkt auf Multiband-Darstellungen entlang der Achse,
u. a.:

- Krümmung κ(s)
- Gradiente i(s)
- Überhöhung u(s)
- Geschwindigkeit, Fahrzeit und Komfortkennwerte

Die 3D-Geometrie ist eine abgeleitete Visualisierung dieser Bänder,
nicht deren Ersatz.

## Coordinate Systems and Rendering

Engineering computations are performed in a local, metric reference frame.

Visualization frameworks such as MapLibre and Three.js are used
for spatial context and interaction,
but are not allowed to dictate numerical precision or domain logic.

This separation enables ufAIM to combine GIS-scale context
with engineering-grade accuracy.

## Framework and Reference Application

ufAIM consists of two clearly separated layers:

- an alignment core framework containing domain logic, math, and geometry
- a lightweight reference application for import, visualization, and workflows

The application serves to validate and demonstrate the framework
and is intentionally not designed as a full-featured CAD system.

The architecture of ufAIM is intentionally conservative.

Rather than optimizing for short-term feature completeness,
it prioritizes clarity, robustness, and extensibility
as prerequisites for long-term infrastructure use cases.


                    ┌─────────────────────────────┐
                    │        External Data        │
                    │ TRA / GRA / LandXML / IFC  │
                    │ terrain / geo / BIM etc.   │
                    └──────────────┬─────────────┘
                                   │
                                   ▼
                        ┌──────────────────┐
                        │  Import Pipeline │
                        │ runImportPipeline│
                        └─────────┬────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │     landFAT      │
                        │ rich alignment   │
                        │ import model     │
                        └─────────┬────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │  Sparse Alignment│
                        │ mathematical core│
                        └─────────┬────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼

       ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
       │  Preview     │   │   Solver     │   │  Validators  │
       │ polyline2D   │   │ AXTRAN-like  │   │ geometry     │
       │ fast render  │   │ optimisation │   │ checks       │
       └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
              │                  │                  │
              └──────────────┬───┴───────────────┬──┘
                             │                   │
                             ▼                   ▼
                      ┌────────────────────────────┐
                      │        Project Model       │
                      │ alignment-based domain    │
                      └─────────────┬─────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ Engineering CRS  │
                          │ workspace system │
                          └─────────┬────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │   GeoRender      │
                          │ mapLibre + three │
                          └─────────┬────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │  MultiWindow UI  │
                          │ Master + Windows │
                          └──────────────────┘
