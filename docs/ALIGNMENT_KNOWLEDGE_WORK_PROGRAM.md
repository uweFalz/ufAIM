# ufAIM Alignment Knowledge Work Program

## North Star

> **Make Alignment Knowledge Work.**

ufAIM exists to make historically accumulated and newly developed railway
alignment knowledge understandable, computable, editable, reusable, and
exchangeable in a modern engineering workspace.

The Reference Application is the workshop, test bench, and publicly visible
proof that Alignment Knowledge actually works.

If the application cannot import, create, modify, calculate, preserve, and
clearly present Alignments and track networks, Research, Knowledge Kernel,
Thesis, Trace, and implementation have not yet completed their shared task.

## Product Promise

An engineer can start with an empty workspace or engineering data and:

1. create or import an Alignment or track network;
2. understand its constructive meaning and provenance;
3. edit horizontal geometry, vertical geometry, and cant;
4. calculate changes and connected consequences through AXTRAN;
5. work with intrinsic distance, operational chainage, speed, and CRS without
   conflating them;
6. inspect one synchronized state in plan, curvature, longitudinal, cant,
   cross-section, network, and geographic views;
7. preserve and reopen the state without semantic loss;
8. combine the Alignment with IFC context in the same workspace;
9. export and re-import IFCalignment with demonstrated meaning preservation.

Maps applications are UX teachers, not the product model. They contribute the
interaction grammar of one continuous world, semantic zoom, direct
manipulation, progressive disclosure, orientation, and immediate feedback.
ufAIM contributes the railway engineering.

## Non-Reducible Work Programme

The programme is complete in responsibility but ordered in implementation.
Items may be sequenced; none may be silently deleted.

### A. Complete the AIM Core

The browser-independent and theoretically language-neutral AIM Core shall own
the constructive engineering meaning of Alignments and track networks.

#### A1. Complete constructive Alignment

- horizontal geometry;
- vertical geometry;
- cant/superelevation geometry;
- intrinsic longitudinal parameter;
- operational chainage as a distinct qualified reference;
- transported spatial railway frame;
- constructive dependencies and boundary conditions;
- speed as qualified application and evaluation input, not intrinsic identity.

#### A2. Vertical geometry

- gradients;
- gradient changes;
- crest and sag vertical curves;
- vertical curvature;
- height reference and convention;
- binding to intrinsic distance;
- continuity and connection conditions;
- AXTRAN-based modification and recalculation.

#### A3. Cant and cross-level

- cant as an independent constructive law;
- cant ramps and ramp families;
- sign, orientation, and reference conventions;
- relation to track axis, rails, and transported frame;
- separated but coupled curvature and cant laws;
- cant deficiency and excess;
- spatial and temporal rates;
- editing, calculation, and visualization.

#### A4. Chainage and kilometre addressing

- kilometre lines;
- jumps, missing lengths, and excess lengths;
- incoming and outgoing addresses;
- multiple addresses for one constructive point;
- re-kilometring without changing Alignment identity;
- station equations;
- provenance and temporal validity;
- bidirectional and potentially multi-valued mapping between intrinsic
  distance and operational address.

#### A5. Spatial coupling

- qualified horizontal, vertical, and cant composition;
- explicit constructive reference trajectory;
- stable frame transport through straight and curved regions;
- rail positions relative to track axis;
- qualified CRS realization;
- World-to-Track and Track-to-World mappings;
- explicit candidate multiplicity and ambiguity handling.

#### A6. Track-network topology

- nodes, edges, and directed orientation;
- switches and branching;
- parallel tracks;
- routes;
- connection conditions between Alignments;
- multiple network detail and abstraction levels;
- separation of geometric connection, topology, and operational traversability;
- topology revision without identity collapse.

#### A7. AXTRAN as calculation core

- problem declarations rather than isolated edit routines;
- fixed, free, and constrained parameters;
- connected boundary and continuity conditions;
- candidate generation and residuals;
- sparse recalculation;
- reviewable alternatives;
- explicit separation of calculation, applicability, evaluation, and decision;
- compatibility with transitionDB and the Berlinish research grammar without
  assuming unproven universality.

#### A8. Lossless state and ports

- stable engineering identity;
- immutable revision lineage;
- constructive snapshots;
- provenance;
- lossless serialization contract;
- persistence ports independent of storage technology;
- language-neutral interface definitions where practical;
- compatibility façades during incremental migration.

### B. Establish Core Services

Core Services shall be task-oriented, interface-separated, and independently
testable. They may build on AIM Core but shall not redefine it.

- create and edit Alignments;
- connect, split, and couple elements and Alignments;
- solve boundary conditions and recalculate consequences;
- create and compare alternatives;
- evaluate speed-qualified reduced dynamics;
- project between World and Track contexts;
- manage revisions and scenarios;
- persist and restore through ports;
- compare intended and observed state;
- expose calculation results without creating approval or authority.

### C. Deliver the Engineering Workspace

One Alignment state shall be presented through synchronized, task-appropriate
views rather than unrelated windows.

- Engineering plan view;
- curvature band as primary horizontal edit access;
- longitudinal profile;
- cant/superelevation band;
- cross-section;
- track-network view;
- MapLibre geographic World View;
- IFC context in the same world;
- common active Alignment, element, station, selection, and revision;
- semantic zoom from world to network to Alignment to element to function;
- direct manipulation with immediate calculated consequences;
- progressive disclosure from engineering result to parameters, evidence, and
  diagnostics;
- trial mode and consequential-change mode with visibly different risk;
- fast, cancellable, non-blocking operations;
- no mandatory debug harnesses during normal startup.

### D. Complete Present-Day Exchange and Evidence

- truthful, cancellable, non-blocking file import;
- GND as an adapter and evidence source, not AIM Core;
- preservation of unresolved and ambiguous source evidence;
- IFC import into the shared Engineering/World workspace;
- IFCalignment export;
- export/re-import roundtrip with semantic comparison;
- explicit CRS and local-cartesian fallback;
- accepted, rejected, failed, and cancelled outcomes that always terminate
  visibly;
- no silent promotion from representation or evidence to constructive meaning.

### E. Extend into Railway Applications

These applications build on alignmentOS; they do not define AIM Core.

- corridor and route location;
- construction and setting-out;
- platform derivation and dependency;
- overhead-line corridors;
- cable routes;
- construction supervision;
- as-designed/as-built/as-maintained comparison;
- measurement-series and uncertainty handling;
- maintenance evaluation;
- broader digital-twin and asset applications.

## Historical Alignment

The programme continues rather than erases railway engineering history:

- surveying and levelling established route and profile;
- tangent/circle field calculus made geometry executable;
- transition curves controlled curvature development;
- cant and speed made the problem railway-specific;
- vertical alignment completed the constructive spatial task;
- tables, field books, Verm.Esn, AXTRAN, and CAD made knowledge operational;
- measurement distinguished design, realization, observation, and condition;
- CRS and linear referencing connected the constructive line to the world;
- topology, GIS, BIM, and IFC connected Alignments to networks and assets.

ufAIM does not claim to reinvent these ingredients. It seeks to reconnect their
fragmented present-day capabilities while preserving engineering meaning.

## Quality Standard

The UX target is Bauhaus in reduction, Apple-like in interaction quality, and
railway-engineering-grade in truthfulness.

- simplicity shall result from resolved complexity, not omitted engineering;
- the primary action shall be obvious;
- the engineering consequence shall be immediate;
- advanced detail shall remain available without dominating the first view;
- calculation shall be fast and reviewable;
- long work shall remain cancellable and visibly progressive;
- every operation shall end in an understandable state;
- representation shall never silently become identity or authority;
- visual polish shall serve orientation and action.

## Stream Responsibilities

- **Research shapes knowledge:** discovers, connects, challenges, reconstructs
  history, and proposes new forms.
- **Knowledge Kernel establishes and defends the basis:** preserves the
  identity, meaning, computability, and non-confusion invariants of Alignment
  Knowledge.
- **Thesis makes present Alignment Knowledge readable:** explains it as a
  human reader journey with accessible openings before scientific depth.
- **Trace maintains cross-artifact coherence:** compares Research, Kernel,
  Thesis, and Application and identifies semantic drift, gaps, and impact.
- **App Architect owns internal App decomposition:** prepares module
  boundaries, ports, migration packages, and parallel ownership surfaces.
- **App implements and proves:** delivers working code and the visible
  engineering experience.
- **Rock maintains the whole route. Uwe sets direction and owns the decisive
  engineering intent.**

## Execution Priority

1. separate AIM Core and App modules without a from-scratch rewrite;
2. complete horizontal, vertical, cant, and chainage calculation in AIM Core;
3. establish task-oriented Core Services;
4. stabilize the App and make diagnostics opt-in;
5. prove a language-neutral alternative AIM-Core implementation boundary;
6. align the Knowledge Kernel with the proven complete Alignment spine;
7. align the Thesis with Research, Kernel, and demonstrated application
   capability;
8. deliver synchronized Engineering, analytical, geographic, and IFC views;
9. prove IFCalignment export and roundtrip.

The ordering may be refined when dependencies demand it. The programme itself
may only change through an explicit Uwe/Rock product-direction decision.

## Mission Filter

A Mainline mission must answer yes to at least one question:

1. Does it complete a meaningful user action?
2. Does it establish or protect a required AIM-Core capability?
3. Does it create a stable module boundary that enables independent work?
4. Does it synchronize two important views of the same Alignment state?
5. Does it remove a real blocker from import, creation, editing, calculation,
   persistence, or exchange?
6. Does it provide evidence needed for a product or architectural decision?

If not, it may still be valid Research, debt work, documentation, or a later
application—but it is not the current App Mainline.

