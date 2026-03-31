# ufAIM – SESSION BOOT

## Kontext

ufAIM ist eine Engineering-Toolbox für Railway Alignments.

Aktueller Fokus:
- Import → Strukturierung → Modellkern
- robuster alignment2D-Kern (sparseAlignment)
- saubere Trennung von:
  - canonical truth (SPOT)
  - candidate data (Working Set)
  - view representation (Projection)

---

## Core Principles

- SPOT = einzige Wahrheit (Worker)
- Working Set = Import-/Kandidatenraum
- Cockpit = User-Intent (Client)
- Projection = eigene Schicht (keine View-Logik)
- Views = dumm (nur Darstellung)
- Parser = source-nah (keine Geometrie, keine Interpretation)

---

## Data Flow (entscheidend)

Import → Parser → landFAT → coordGeom → sparseAlignment → Projection → View

Critical dependencies:
- semanticMap → Parser-Semantik
- coordGeom → sparse builder
- sparseAlignment → alles downstream (Projection, Solver, Views)

---

## Architekturrollen

Worker (Master Runtime):
- SPOT Store (Objects, Relations, Topology, CRS)
- Working Set
- Messaging / Commands / Events

Client (Window):
- WindowRuntime
- WorkspaceState / WindowSession
- CockpitController (User-Intent-Orchestrator)
- ToolController (Import, Spot, Transition, etc.)

Projection:
- ViewProjectionController
- AlignmentProjectionService
- Derived View Geometry
- Representation Cache

Views:
- GeoView
- Profile / Section
- Transition Editor
- (Grabbeltisch / Nachfolger)

---

## Aktuelle Baustellen

- semanticMap.GND.js fehlt
- traLikeCoordGeom prüfen (keine implizite Geometrie!)
- buildSparseFromLandFAT stabilisieren
- buildImportArtifacts → zurückbauen auf saubere Projection
- CockpitController definieren (zentraler Client-Actor)
- klare Trennung:
  - landFAT vs sparse vs preview

---

## Wichtige Regeln

- keine doppelte Semantik (Source-of-Truth)
- semanticMap ist führend für Formatinterpretation
- keine Richtungs-/Geometrieberechnung im Parser
- sparseAlignment ist der technische Kern
- Projection erzeugt View-Geometrie, nicht Parser
- jede Änderung: „wer hängt davon ab?“

---

## Dependency Spine (Minimal)

semanticMap
→ Parser
→ coordGeom
→ buildSparseFromLandFAT
→ sparseAlignment
→ Projection
→ Views

SPOT
→ Projection
→ Views
→ (Solver später)

---

## Arbeitsmodus

- minimal + robust (kein Overengineering)
- Probleme sichtbar machen (nicht verstecken)
- @baustelle nur lokal im Code
- Architekturentscheidungen in MD bündeln
- Änderungen zuerst an der Quelle, nicht an Ableitungen

---

## Kurzform für schnellen Einstieg

ufAIM = Alignment-Toolbox

Kern:
- Import → landFAT → sparseAlignment

Architektur:
- SPOT (truth)
- Working Set (candidates)
- Cockpit (intent)
- Projection (representation)
- Views (dumb)

No-Gos:
- keine Geometrie im Parser
- keine doppelte Semantik
- keine Vermischung von SPOT / Preview
