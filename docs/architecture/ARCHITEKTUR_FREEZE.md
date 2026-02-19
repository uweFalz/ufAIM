# ARCHITEKTUR_FREEZE – ufAIM Core (Alignment-first, didactic BIMinfra)

Stand: 2026-02-14

## 0. Mission (nicht verhandelbar)
ufAIM ist ein visuelles, didaktisches BIMinfra-Tool mit Alignment-Fokus:
Import → CRS-verstehen → Visualisieren → Editieren → Exportieren.
Transitions sind erstklassige Domänenobjekte; interne Semantik ist Superset (Berlinish) gegenüber Format-Restriktionen.

## 1. Domänen-Kern ist ThirdParty-frei
Alles unter `src/alignment/**` darf keine direkten Imports von THREE/mapLibre/proj4/jsxgraph enthalten.
Domäne = Datenstrukturen + Evaluatoren + Invarianten + Tests.

## 2. Single Source of Truth: Store/Model
UI/Views sind Projektionen.
Kein View hält “eigene Wahrheit” über Alignment/Transition-Parameter, sondern liest/schreibt über State/Actions.

## 3. Klare Paketgrenzen (Core Packages)
- `src/alignment/`  Domäne: Elemente, Transition-Typen, Registry, Evaluator, Invarianten
- `src/crs/`        CoordinateAgent, Transform-Pipelines, CRS-Meta, Passpunkte/Referenzen
- `src/io/`         Import/Export: Parser, Mapper, Validation, Reports (Format ↔ Domäne)
- `src/view/`       Views: 3D-Editor, Bänder, Schnitt, TransEd (nur UI-Logik + Rendering-Adapter)
- `src/engine/`     Rendering Engines / ThirdParty-Kapseln (THREE/mapLibre/etc.)
- `src/solver/`     SQP/AXTRAN-Revival: Objective/Constraints, Differentiation, Fit-Pipelines
- `src/shared/`     Querschnitts-Services (Messaging, Logger, Utils, FeatureFlags)

## 4. Transition ist Kern-IP
- TransitionType-DB (Registry + Presets) ist Bestandteil des Domänenkerns.
- TransEd ist der autorisierte UI-Einstieg für: Typ anlegen/prüfen/analysieren.
- Registry liefert “kompilierte” Typen (kappa, kappa', kappa'', integral, cuts/meta).

## 5. Berlinish-Prinzip
Interne Transition-Semantik ist nicht Format-gebunden:
- normierter Parameter u∈[0,1]
- definierte Stetigkeit (mindestens C1, optional C2+ je Typ)
- segmentiertes Modell (z.B. halfWave1 / linear / halfWave2) ist erlaubt und üblich
- Format-Restriktionen werden beim Export gemappt, nicht im Kernmodell erzwungen.

## 6. Import = Erkenntnis-Pipeline, nicht File-Load
Import erzeugt: (a) Domänenobjekte, (b) Meta/CRS-Kontext, (c) Quality/Warnings.
Containerformate (LandXML/IFC) werden in Subdatensätze zerlegt; Spezialformate (TRA/GRA) sind file-level.

## 7. Export ist bewusst (Mapping + Loss-Policy)
Jeder Exportpfad definiert:
- Zielschema/Restrictions
- Mapping-Strategie Berlinish→Target
- Loss-Policy: lossless | controlled-loss (mit Report) | reject

## 8. CRS ist Feature
Kein Alignment ohne CRS-Kontext.
CoordinateAgent ist zentraler Dienst; Views zeigen CRS-Zustand und Transformationen nachvollziehbar an.

## 9. Rendering ist austauschbar
mapLibre/THREE/jsxgraph sind Implementierungen hinter Interfaces/Adapters.
Views sprechen nur mit Engine-Interfaces, nie direkt mit ThirdParty (Ausnahme: View-spezifische Mini-Renderer, wenn klar abgegrenzt).

## 10. MultiView/MultiWindow ist vorgesehen
Views dürfen nicht “singleton-annahmen”.
Kommunikation über Messaging/EventBus/Router; Model/Store bleibt zentral (ggf. Worker).

## 11. Solver (SQP) ist separate Domäne
SQP/AXTRAN-Revival lebt in `src/solver/` und operiert auf Domänenobjekten.
Keine Solver-Logik in Views oder Importern.

## 12. Invarianten & Tests (Pflicht bei Kernobjekten)
- AlignmentElement/TransitionElement: Validierung + Normalisierung
- Registry/Compiler: deterministisch, pure functions soweit möglich
- Import-Mapping: testbare Golden-Cases (LandXML/IFC/TRA)

## 13. “No quick hacks” Regel
Temporäre Fixes dürfen Paketgrenzen nicht verletzen.
Wenn ein Fix nötig ist: Interface erweitern → Implementierung anpassen → erst dann nutzen.

## 14. Naming & Struktur
Klar, beschreibend, langlebig. Keine “witzigen” Namen für Core.
Dateipfade spiegeln Rollen: `alignment/elements`, `alignment/transition`, `io/parsers`, `io/mappers`, …

## 15. UI-Prinzip (didaktisch)
Jede Editor-Funktion muss “sehen lassen, was sie tut”:
Plot/Derivative/Integral/Continuity/Constraints sichtbar, nicht nur Ergebnis.

⸻

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