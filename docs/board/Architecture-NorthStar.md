# ufAIM – Architecture North Star

## Ergänzte Leitidee

ufAIM ist nicht nur ein Viewer oder Importwerkzeug für Alignments.

ufAIM ist eine Engineering-Toolbox, in der der Nutzer:

- Daten importiert
- Kandidaten strukturiert
- SPOT kontrolliert aufbaut
- Darstellungen aus kanonischen Daten ableitet
- und insbesondere Übergänge (Transitionen) analysiert, vergleicht und entwirft

Transitionen sind dabei kein Randthema, sondern ein fachlicher Schmerzpunkt
der Alignment-Welt. Deshalb bleibt der Transition Editor kein Neben-View,
sondern ein eigenständiges Kernwerkzeug der Architektur.

## Zweck

Dieses Dokument beschreibt den aktuellen **architektonischen Nordstern** von ufAIM.

Es ist kein reines IST-Diagramm und kein theoretisches SOLL, sondern ein **Leitbild**, das:

- Struktur gibt
- Refactoring leitet
- neue Player einordnet
- Altlasten sichtbar macht

---

## Grundidee

ufAIM trennt strikt in drei Ebenen:

### 1. Master Runtime (Canonical Truth)
- läuft im SharedWorker
- enthält die Wahrheit des Systems

→ SPOT, Topologie, CRS, canonical data

---

### 2. Client / Window Runtime (User Interaction)
- läuft im Fenster
- enthält **keine Wahrheit**
- ist der Ort der User-Interaktion

→ Cockpit, Tools, Session, UI

---

### 3. Projection / Representation
- übersetzt canonical data in view-taugliche Formen

→ Sampling, Geometrie, Cache, LoD

---

## Leitprinzipien

### SPOT ist Wahrheit
Canonical state liegt ausschließlich im Worker.

### Working Set ist Kandidatenraum
Importierte Daten sind zunächst **nicht Teil der Wahrheit**.

### Cockpit ist Wille
Cockpit ist der clientseitige Intent-Actor des Users.

### Views sind dumm
Views zeigen nur vorbereitete Daten.

### Projection ist eigene Domäne
Keine View darf selbst Geometrie ableiten.

---

## Leitformel

> **SPOT ist Wahrheit.  
> Cockpit ist Wille.  
> Views sind Wahrnehmung.**

---

## Architecture Map

```plantuml
@startuml

title ufAIM – Architecture North Star (SPOT / Projection / Cockpit)

skinparam packageStyle rectangle
skinparam linetype ortho
skinparam shadowing false
hide empty members

package "External World" {
  [Import Files\nTRA / GRA / LandXML / IFC]
  [Public Geo Context\nmapLibre / GIS]
  [Reference Models\nIFC / Terrain / Docs]
}

package "Master Runtime (SharedWorker)" {
  [ProjectState]
  [Messaging / Commands / Events]

  package "Canonical Project Model" {
    [SPOT Store]
    [Spot Objects]
    [Spot Relations]
    [Topology]
    [Engineering CRS]
    [Canonical Refs]
  }

  package "Candidate / Context Data" {
    [Working Set]
    [Reference Store]
  }
}

package "Engineering Core" {
  [Sparse Domain]
  [SparseAlignment]
  [Validators]
  [Solver]

  package "Transition Resolution" {
    [RegistryResolver]
    [KappaFcnBuilder]
  }
}

package "Window Client" {
  [WindowRuntime]
  [WorkspaceState / WindowSession]
  [uiWiring]
  [ViewController]
  [CockpitController]

  package "Tool Controllers" {
    [ImportController]
    [GrabbeltischController]
    [TransitionEditorBridge]
    [SpotController]
  }

  package "Projection Layer" {
    [ViewProjectionController]
    [AlignmentProjectionService]
    [TopologyProjectionService]
    [ObjectProjectionService]
    [Derived View Geometry]
    [Representation Cache]
  }

  package "Views / Tools" {
    [GeoView]
    [Profile / Section Views]
    [Grabbeltisch]
    [Transition Editor]
    [Property Panels]
  }
}

' Import Flow
[Import Files\nTRA / GRA / LandXML / IFC] --> [ImportController]
[ImportController] --> [Messaging / Commands / Events]
[Messaging / Commands / Events] --> [Working Set]

' Cockpit orchestration
[WindowRuntime] --> [CockpitController]
[WorkspaceState / WindowSession] --> [CockpitController]
[uiWiring] --> [CockpitController]

[CockpitController] --> [ImportController]
[CockpitController] --> [GrabbeltischController]
[CockpitController] --> [TransitionEditorBridge]
[CockpitController] --> [SpotController]
[CockpitController] --> [ViewProjectionController]

[CockpitController] --> [Messaging / Commands / Events]

' SPOT internals
[SPOT Store] --> [Spot Objects]
[SPOT Store] --> [Spot Relations]
[SPOT Store] --> [Topology]
[SPOT Store] --> [Engineering CRS]

' Projection
[SPOT Store] --> [ViewProjectionController]
[Working Set] --> [ViewProjectionController]
[Reference Store] --> [ViewProjectionController]
[WorkspaceState / WindowSession] --> [ViewProjectionController]

[ViewProjectionController] --> [AlignmentProjectionService]
[ViewProjectionController] --> [TopologyProjectionService]
[ViewProjectionController] --> [ObjectProjectionService]

[AlignmentProjectionService] --> [Derived View Geometry]
[TopologyProjectionService] --> [Derived View Geometry]
[ObjectProjectionService] --> [Derived View Geometry]

[Derived View Geometry] --> [Representation Cache]

' Views
[Representation Cache] --> [GeoView]
[Representation Cache] --> [Profile / Section Views]
[Representation Cache] --> [Transition Editor]

[SPOT Store] --> [Grabbeltisch]
[SPOT Store] --> [Property Panels]

@enduml
