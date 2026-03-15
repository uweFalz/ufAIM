# WindowSession

## Purpose

A **WindowSession** represents the local working context of a browser window.

It describes **how a window currently interacts with project data**, without owning the canonical data itself.

Canonical data lives in the **Master (SharedWorker)**, primarily in:

- SpotStore
- ImportState
- ProjectState (future)

The WindowSession only stores **local state**, such as:

- focus
- selection
- navigation
- UI configuration

---

# Concept

In ufAIM architecture a browser window is a **working incarnation** of the project.

Master (SharedWorker)
│
│ canonical data
▼
WindowSession
│
│ local working context
▼
Views

Multiple windows may operate simultaneously on the same project.

Each window has its own **WindowSessionState**.

---

# Responsibilities

The WindowSession manages:

### Focus
Which object the window currently works on.

Examples:

- a SPOT alignment
- a working import item
- a reference object

### Selection
User selection state inside the window.

### Navigation
Local navigation state (cursor, camera presets, etc.).

### UI state
Panel visibility and active tools.

### Working context
Temporary state when operating on working sets (e.g. Grabbeltisch).

---

# What a WindowSession does NOT own

The WindowSession must **not store canonical project data**.

It must not contain:

- SPOT data
- full working items
- geometry models
- project definitions

Instead it stores **references by ID**.

Example:

focus.objectId = “spot_a12b34c”

---

# WindowSessionState

Minimal structure for Stage 1:

```javascript
{
  sessionMeta: {
    windowId: null,
    sessionId: null,
    projectId: null
  },

  focus: {
    domain: null,          // "spot" | "working" | "reference"
    objectId: null,
    subId: null,
    slot: "right"
  },

  selection: {
    ids: [],
    lastPickedId: null
  },

  navigation: {
    cursorS: 0,
    cameraPreset: null,
    fitMode: "auto"
  },

  ui: {
    activePanel: null,
    overlays: {
      docs: false,
      transition: false,
      bands: false,
      section: false,
      spot: false
    },
    activeTool: null
  },

  workingContext: {
    activeWorkingItemId: null,
    activeGroupId: null,
    giftCabinetFilter: null
  },

  viewContext: {
    activeView: "geo",
    pinnedIds: []
  }
}


⸻

Interaction Model

Typical interaction flow:

UI interaction
     │
     ▼
WindowSessionController
     │
     ▼
WindowSessionState update
     │
     ▼
ViewController render

Controllers may also communicate with the Master via Messaging.

⸻

Relationship to SpotStore

The WindowSession references SPOT objects via IDs.

Example:

focus.domain = "spot"
focus.objectId = "spot_2f3a1c"

The actual alignment data remains in the SpotStore.

⸻

Persistence

In the future the WindowSession may be persisted to allow:
	•	restoring window state after restart
	•	restoring camera position
	•	restoring focused objects

Only lightweight state should be persisted.

⸻

Future Extensions

Potential extensions include:
	•	multi-object selections
	•	tool mode management
	•	view layout persistence
	•	cross-window session coordination
	
---

# Ergebnis

Mit dieser Datei hast du jetzt eine **saubere Definition für eine der zentralen Architekturrollen** deines Systems.

Sie passt zu:

- `SparseAlignment.md`
- `LANDFAT_SPEC.md`
- `SPOT_MODEL.md`

---

# Der nächste logische Architektur-Schritt

Jetzt, wo **WindowSession definiert ist**, können wir als Nächstes klären:

👉 **was genau der `WindowSessionController` tut**  

Das ist der fehlende Baustein zwischen:

uiWiring
workspaceState
spotController
views

Und genau dort verschwimmen aktuell die Verantwortlichkeiten.

Wenn du möchtest, können wir im nächsten Schritt auch ein **Controller-Rollenmodell für das ganze Window** aufstellen.

Gut, dann machen wir jetzt den entscheidenden nächsten Schritt:
ein klar definiertes Rollenmodell für die Window-Controller in ufAIM.

Das Ziel ist, die aktuelle Situation zu ordnen:

WindowRuntime
bootLegacyAppCore
uiWiring
workspaceState
spotController
importController
transitionEditorBridge

Momentan überschneiden sich deren Verantwortlichkeiten.
Das ist normal in dieser Phase – aber jetzt können wir das systematisch entflechten.

⸻

Zielmodell der Window-Controller

Im Idealfall hat jedes Fenster vier klare Ebenen:

WindowRuntime
      │
      ▼
WindowSessionController
      │
      ▼
Domain Controllers
      │
      ▼
Views


⸻

1️⃣ WindowRuntime

Der Host des Fensters.

Verantwortung:
	•	Bootstrapping
	•	Worker-Verbindung
	•	Window-Infrastructure
	•	Session starten

Beispiel:

WindowRuntime
  → bootLegacyAppCore
  → init messaging
  → create WindowSession
  
Wichtig:

WindowRuntime enthält keine Fachlogik.

⸻

2️⃣ WindowSessionController (neu)

Der Chef über den Arbeitskontext des Fensters.

Er besitzt:

WindowSessionState

Er beantwortet Fragen wie:
	•	Was ist im Fenster fokussiert?
	•	Welche Daten werden gerade bearbeitet?
	•	Welche Views sollen reagieren?

Beispielmethoden:

setFocus(domain, objectId)
setActiveWorkingItem(id)
setCursor(s)
setTool(toolId)

Alle UI-Events laufen zuerst hier hinein.

⸻

3️⃣ Domain-Controller

Diese Controller machen fachliche Operationen.

Beispiele aus deinem System:

ImportController

verarbeitet externe Daten

file
 → sniff
 → parser
 → pipeline
 → working items
 

⸻

SpotController

arbeitet mit dem SpotStore im Worker.

Operationen:

createSpot
updateSpot
deleteSpot
querySpot


⸻

TransitionEditorBridge

Adapter zwischen:

TransitionEditorView
 ↔ geometry engine
 ↔ worker
 

⸻

4️⃣ ViewController

Der Render-Koordinator.

Er:
	•	synchronisiert Views
	•	reagiert auf Session-State
	•	aktualisiert UI

Er darf keine fachliche Entscheidung treffen.

⸻

Gesamtbild

User interaction
        │
        ▼
uiWiring
        │
        ▼
WindowSessionController
        │
        ├── ImportController
        ├── SpotController
        └── TransitionEditorBridge
        │
        ▼
SharedMessagingWorker
        │
        ▼
SpotStore


⸻

Warum dieses Modell wichtig ist

Ohne diese Trennung passiert typischerweise:
	•	Controller greifen direkt auf Views zu
	•	Views enthalten Logik
	•	Session-State verteilt sich überall

Mit diesem Modell:

Session → entscheidet
Controller → handeln
Views → zeigen

