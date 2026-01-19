ARCHITEKTUR_FREEZE

Projekt: ufAIM

Stand: Januar 2026

Ziel dieses Dokuments
Dieses Dokument friert die aktuelle Kernarchitektur ein. Es beschreibt Rollen, Flüsse und Verantwortlichkeiten, nicht jede Implementierungsdetails. Änderungen an diesen Punkten gelten als architekturrelevant und müssen bewusst entschieden werden.

⸻

1. Leitprinzipien
	1.	Trennung von Verantwortung (SoC)
	•	Import, Model, View und Render sind strikt getrennt.
	•	Keine UI-Logik im Model, keine Model-Mutationen im View.
	2.	Canonical Data bleibt unangetastet
	•	Echte Koordinaten (ENU / DBRef / etc.) bleiben immer im Model.
	•	Views dürfen transformieren, aber niemals kanonische Daten verändern.
	3.	Views sind austauschbar
	•	three.js ist eine Render-Implementierung, kein Architekturanker.
	•	Adapter kapseln Achsen, Maßstab, Floating Origin.
	4.	QuickHooks sind View-Cache
	•	Keine Geschäftslogik.
	•	Keine Persistenz.
	•	Austauschbar.

⸻

2. Zentrale Bausteine

2.1 appCore

Rolle: Orchestrator
	•	Initialisiert Store, UI, ImportController, ViewController
	•	Kennt keine Import-Details
	•	Kennt keine Render-Details

Darf:
	•	Komponenten verbinden
	•	Lebenszyklus steuern

Darf nicht:
	•	Import parsen
	•	View-Logik enthalten

⸻

2.2 Store (workspaceState)

Rolle: Einzige Quelle des Zustands

Enthält:
	•	routeProjects
	•	artifacts
	•	activeRouteProjectId
	•	activeSlot
	•	Cursor-Zustand

Zusätzlich (View-Cache):
	•	import_* (QuickHooks)
	•	import_activeArtifacts

Regel:

Alles, was hier liegt, ist beobachtbar.

⸻

2.3 ImportController

Rolle: IO-Glue

Datei → Importer → ImportSession → applyImportToProject → Store

	•	Verwaltet Drag&Drop und FilePicker
	•	Kennt Importformate (TRA/GRA/…)
	•	Kennt keine View

Output:
	•	Effects (log, optional props)

⸻

2.4 importApply

Rolle: Model-nahe Mutation
	•	Erzeugt Artifacts
	•	Ordnet Artifacts Slots zu (right / left / km)
	•	Aktualisiert routeProjects + artifacts

Zusätzlich:
	•	Erzeugt import_activeArtifacts (deterministisch)
	•	Spiegelt QuickHooks nur aus aktivem Slot

⸻

2.5 QuickHooks (import_*)

Rolle: View-Cache

Beispiele:
	•	import_polyline2d
	•	import_profile1d
	•	import_cant1d

Regeln:
	•	Nur Ableitungen aus Artifacts
	•	Immer überschreibbar
	•	Niemals Quelle der Wahrheit

⸻

2.6 import_activeArtifacts

Rolle: Deterministischer View-Schlüssel

Enthält:
	•	baseId
	•	slot
	•	alignmentArtifactId
	•	profileArtifactId
	•	cantArtifactId

Zweck:
	•	Eindeutig festlegen, was gerade gerendert wird
	•	Geometrie-Wechsel erkennen (Recenter / Zoom)

⸻

2.7 ViewController

Rolle: Store → UI + Render
	•	Einziger Subscriber auf den Store
	•	Berechnet sectionInfo
	•	Aktualisiert Overlays
	•	Steuert Render über Adapter

Darf:
	•	Ableiten
	•	Cachen (z. B. Chainage)

Darf nicht:
	•	Store mutieren

⸻

2.8 ThreeAdapter

Rolle: Geometrie-Übersetzer

Canonical ENU → Floating Origin → three.js local

	•	Kapselt Achsenkonventionen
	•	Kapselt Maßstab
	•	Kapselt Ursprung

Einzige Stelle, an der three-spezifische Koordinatenlogik existiert.

⸻

3. Render-Flow (vereinfachtes Diagramm)

Store
 └─ ViewController
     ├─ compute sectionInfo
     ├─ update UI overlays
     └─ ThreeAdapter
          └─ threeViewer


⸻

4. Logging & Debug

4.1 Log
	•	Menschlich lesbar
	•	Ereignisse
	•	Ruhig halten

4.2 Props
	•	Strukturierter Zustand
	•	Debug-Ansicht
	•	Keine Side Effects

4.3 SystemPrefs

Zentrale Laufzeit-Flags:
	•	DEV vs PROD
	•	Debug-Verhalten

Beispiel:
	•	emitImportPropsEffects

⸻

5. Bewusste Nicht-Ziele (Stand Freeze)
	•	Keine Optimierung im Model
	•	Keine Persistenz-Versionierung
	•	Kein mapLibre-Bundle
	•	Keine Multi-Window-Synchronisierung

Diese kommen nach diesem Freeze.

⸻

6. Konsequenzen
	•	Neue Features müssen sich einordnen
	•	Abkürzungen sind bewusst zu markieren
	•	Adapter statt Direktzugriff

Wenn du das Gefühl hast, du müsstest diese Regeln brechen,
halte an und entscheide bewusst.

⸻

Status: 🧊 Architektur eingefroren