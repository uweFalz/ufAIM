# ufAIM Architecture Governance

## Purpose

This file is the transfer document for future supervisors, contributors, or continuation chats.

It preserves the architectural decision logic of ufAIM.

The goal is not to document every implementation detail.

The goal is to prevent loss of the core model.

---

## Core Vision

ufAIM is not GIS.

ufAIM is not CAD.

ufAIM is not BIM.

ufAIM is Alignment-centric Engineering.

AIM means:

```text
Alignment-based Information Modelling
```

The central object is not a file, a map, a mesh, or a drawing.

The central object is:

```text
AlignmentData
```

as constructive railway alignment semantics.

---

## Core Freezes

### AlignmentData

```text
AlignmentData = constructive alignment semantics
```

AlignmentData is not:

```text
geometry
rendering
CRS
vehicle state
operational state
import artifact
```

Import and Editor are both producers of AlignmentData.

---

### pose2

```text
pose2 = intrinsic reconstruction state
```

pose2 contains the initial-value state required to reconstruct planar alignment geometry from curvature.

---

### pose3

```text
pose3 = runtime-evaluated railway state
```

Frozen v1:

```text
pose3(s) = (Γ(s), u(s), F_rail(s))
```

where:

```text
Γ(s)      reconstructed railway reference trajectory
u(s)      railway cant quantity
F_rail(s) cant-aware railway frame
```

pose3 is not:

```text
persistent geometry
VehicleState
PhysicalInterpretation
OperationalState
Representation
```

---

### SPOT

```text
SPOT = durable engineering object space
```

SPOT stores durable engineering objects.

SPOT is not:

```text
preview
workflow
view state
geometry cache
rendering layer
```

---

### Workspace

```text
Workspace = current engineering situation
```

Workspace answers:

```text
What matters right now?
What is the focus?
What is context?
```

Workspace is not canonical truth.

---

### GeoView

```text
GeoView = synchronized spatial projection
```

GeoView renders AIM state.

GeoView does not define AIM state.

```text
mapLibre ViewState != AIM MetricState
```

GeoView receives RenderPrimitives, not SpotObjects.

---

### AXTRAN2

```text
AXTRAN2 = optimization service
```

AXTRAN2 may consume canonical data.

AXTRAN2 may produce:

```text
proposal
candidate
delta
diagnostics
```

AXTRAN2 must not mutate:

```text
AlignmentData
SPOT
Workspace
RouteProject
```

---

## Native Authoring Boundary

Native editor creation follows:

```text
File
  → New Alignment
  → AlignmentData
  → SpotObject
  → Workspace Focus
```

It must not use:

```text
ImportSession
PreviewCandidate
Import.BeginSession
Import.AddItems
landFAT
```

Engineering objects may exist before geometric realization exists.

An AlignmentData object may be valid without:

```text
CRS
sparseAlignment
geometry
representation
```

---

## Critical Negative Rules

These rules protect the architecture.

```text
AlignmentData ≠ geometry
pose3 ≠ VehicleState
SPOT ≠ geometry cache
Workspace ≠ truth store
GeoView ≠ model
Import ≠ canonical semantics
AXTRAN2 ≠ canonical model
Representation ≠ SpotObject
```

---

## Open Research Areas

Do not freeze these yet without supervisor review:

```text
VehicleState
OperationalState
PhysicalRealizationSpace
RealizedPose
Schwerpunkt
AXTRAN2 vehicle-aware objectives
persistent pose3 storage
ellipsoidal alignment object type
```

---

## Decision Process

Research may create candidates.

Research may not create freezes.

Only Architecture Supervision may accept freezes.

Accepted freezes must be reflected in:

```text
docs/architecture
docs/thesis/AIM
implementation boundaries
```

No implementation may silently invalidate an accepted freeze.

---

## Sub-Reporting Rule

Every sub-thread must report in structured form.

Minimum required fields:

```text
STATUS
CHANGED FILES
ARCHITECTURE IMPACT
CANONICAL DATA IMPACT
RISKS
NEXT SAFE STEP
DONE CRITERIA
```

For thesis work, use:

```text
RESEARCH FINDINGS
FREEZE IMPACT
CONTRADICTIONS FOUND
THESIS IMPACT
ARCHITECTURE IMPACT
FREEZE RECOMMENDATION
```

---

## Current Active Streams

```text
Main Chat        Architecture Supervisor
Import Sub       Import / GND / CRS diagnostics
AXTRAN2 Sub      Optimization service
GeoView Sub      Rendering adapter boundary
Cockpit Sub      Workspace navigator / UI boundary
Thesis Sub       Research / theory / freeze candidates
Editor Sub       Native Alignment authoring
```

---

## Successor Survival Kit

A successor must preserve these truths:

```text
AlignmentData is constructive semantics.

pose3 is runtime railway state, not vehicle state.

SPOT stores durable engineering objects, not previews.

Workspace coordinates current engineering relevance, not truth.

GeoView renders representations, not canonical data.

AXTRAN2 produces proposals, not mutations.

Import is only one producer of AlignmentData.

Native authoring bypasses Import and Preview.
```

If these remain intact, ufAIM can continue with minimal conceptual loss.
