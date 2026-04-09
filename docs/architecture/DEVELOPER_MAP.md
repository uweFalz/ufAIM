# ufAIM Developer Map

This document provides a quick orientation for developers navigating the ufAIM codebase.

It explains where major responsibilities live inside the system.

---

# System Overview

ufAIM follows a **model-centric multi-window architecture**.

The canonical project model is stored in the **SPOT Store** inside the **SharedWorker (Master Runtime)**.

All windows act as **clients** that interact with this model through the messaging system.

Window
↓
Controllers / Views
↓
Messaging
↓
SharedWorker
↓
SPOT Store

---

# Core Responsibilities

## Master Runtime

Location: `src/shared`

Responsible for:

- maintaining the canonical project state
- managing the SPOT Store
- coordinating multi-window communication
- broadcasting state updates

Key components:

- `SharedMessagingWorker`
- `MessageRouter`
- `SpotStore`

---

## SPOT Store

Canonical project data model.

Defined in:

docs/SPOT_MODEL.md

Responsible for:

- deterministic alignment representation
- curvature transitions
- geometry evaluation

The sparse alignment model is the mathematical backbone of ufAIM.

---

## Import Pipeline

Responsible for converting external formats into candidate project data.

Typical flow:

External file
↓
Parser
↓
landFAT representation
↓
Normalization
↓
Working Set
↓
User validation
↓
SPOT Store

Key components:

- `runImportPipeline`
- `landXMLNormalizers`
- `normalizeLandFATToSparse`

---

## Window Runtime

Each browser window runs its own client runtime.

Key components include:

- `WindowRuntime`
- `uiWiring`
- `WorkspaceState`
- `ViewController`

Responsibilities:

- initializing the UI
- connecting to the SharedWorker
- creating views and tool controllers

---

## Tool Controllers

Controllers implement user-facing engineering tools.

Examples:

- `ImportController`
- `GrabbeltischController`
- `TransitionEditorBridge`
- `SpotController`

Controllers never own the project model.
All changes are executed through commands sent to the SharedWorker.

---

## Views

Views provide visual access to the SPOT model.

Examples:

- `GeoView`
- `ProfileView`
- `TransitionEditorView`
- `GrabbeltischView`

Views are **purely visual** and contain no canonical data.

---

# Key Architectural Rule

Views do not own data.
Controllers do not own data.
Only the SPOT Store owns project data.

All state changes must pass through the Master Runtime.

---

# Data Spaces

ufAIM distinguishes three internal data spaces.

SPOT Data      → canonical project model
Working Set    → candidate project data
Reference Data → contextual external data

Details are described in:

docs/SPOT_MODEL.md

---

# Engineering Layers

The engineering stack inside ufAIM can be summarized as:

Sparse Alignment Core
↓
Engineering Model (SPOT)
↓
Tools / Solvers
↓
Views / Rendering

Rendering frameworks (MapLibre / Three.js) operate only on **derived geometry**.

---

# Where to Start

If you want to understand the system:

1. `VISION.md`
2. `CORE_CONCEPTS.md`
3. `ARCHITECTURE.md`
4. `SPOT_MODEL.md`
5. `SparseAlignment.md`

These documents describe the conceptual foundation of ufAIM.

---
