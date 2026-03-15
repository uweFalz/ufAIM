# Architecture

A deterministic engineering model
shared through a master runtime
and explored through specialised tools.

Canonical engineering model
+
Shared runtime authority
+
Specialized engineering tools

technically:

SPOT model
+
SharedWorker runtime
+
Tool-based clients

See also: `diagrams/ufAIM_system_overview.puml`

This document describes the architectural structure of ufAIM.

ufAIM is designed as an engineering-grade alignment framework with a lightweight reference application.

The system prioritizes deterministic, auditable and optimizable representations of railway alignments over purely visual modelling.

---

# Design Principles

ufAIM follows a small set of explicit architectural principles:

- Alignments are treated as first-class engineering objects
- Deterministic parametrization is preferred over implicit geometry
- Engineering logic is strictly separated from visualization and UI
- Numerical robustness and auditability take precedence over visual fidelity
- Derived geometry must never replace the underlying design intent

---

# Model-Centric Tool Architecture

ufAIM follows a **model-centric architecture** in which a canonical engineering model is shared between multiple specialized tools.

The core model represents the **single source of truth** for all engineering-relevant data.

Tools and views do not replicate this model but access it through commands and events.

Examples of specialized tools include:

- alignment editors
- transition editors
- geometric viewers
- working-set managers such as the *Grabbeltisch*

Each tool retrieves only the information it needs and reacts to
domain-level change events instead of maintaining mirrored state.

This allows ufAIM to evolve as a modular engineering workbench where
multiple specialized tools collaborate on the same canonical model.

---

# System Layers

The system is organized as a layered architecture.

```text
External Data
↓
Import Pipeline
↓
Working Set
↓
SPOT Store
↓
Views / Tools
```

External formats are first parsed and converted into intermediate
representations.

Candidate data is stored in the **Working Set**, where it can be inspected
and organised by the user.

Only validated objects are promoted into the **SPOT Store**, which
represents the canonical project model.

---

# Geometry Core

The canonical geometric representation of alignments is the
**Sparse Alignment Model**.

See: docs/core/SparseAlignment.md

This representation provides the deterministic mathematical backbone
for alignment evaluation, editing and optimisation.

---

# Coordinate Systems and Rendering

Engineering computations are performed in a **local engineering
coordinate system**.

Rendering frameworks such as **MapLibre** and **Three.js** are used
for spatial context and interaction but do not influence engineering
logic or numerical precision.

This separation allows ufAIM to combine:

- GIS-scale spatial context
- engineering-grade geometric accuracy

---

# Framework and Reference Application

ufAIM consists of two clearly separated layers:

**Alignment Framework**

- sparse alignment core
- transition families
- engineering mathematics
- validation and solver components

**Reference Application**

- import pipeline
- visualization
- workflow tools
- user interaction

The reference application exists primarily to validate and demonstrate
the framework and is intentionally not designed as a full CAD system.

---

The architecture of ufAIM prioritizes clarity, robustness and
extensibility in order to support long-term infrastructure engineering
workflows.
