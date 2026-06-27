Window Client Architecture

Ein Browserfenster ist in ufAIM kein Datencontainer, sondern ein Werkzeug-Host.

Seine Aufgabe ist:

User interaction
+ Tool orchestration
+ View rendering

Das Fenster besitzt kein kanonisches Modell.

Alle Daten liegen im SPOT Store im SharedWorker.

⸻

Grundstruktur eines Window-Clients

WindowRuntime
      │
      ▼
ViewController
      │
      ▼
ToolControllers
      │
      ▼
Views
      │
      ▼
Messaging
      │
      ▼
SharedWorker


⸻

1 WindowRuntime

Der Bootstrap des Fensters.

Verantwortlich für:
	•	Initialisierung des Fensters
	•	Verbindung zum SharedWorker
	•	Session-Wiederherstellung
	•	Start des ViewControllers

Typische Aufgaben:

connectSharedWorker()
restoreWorkspaceSession()
initViews()

WindowRuntime ist kein Tool und keine View.

⸻

2 ViewController

Der Manager der Views im Fenster.

Aufgaben:
	•	Views erstellen
	•	Views registrieren
	•	View-Updates koordinieren

Beispiele:

GeoView
GrabbeltischView
TransitionEditorView

Der ViewController kennt keine Domainlogik.

⸻

3 ToolControllers

ToolController implementieren User-Werkzeuge.

Beispiele:

ImportController
GrabbeltischController
TransitionEditorBridge
SpotController

Sie:
	•	reagieren auf UI-Events
	•	senden Commands an den Worker
	•	interpretieren Worker-Events

ToolController besitzen keine Daten.

⸻

4 Views

Views sind reine Darstellungen.

Beispiele:

GeoView
ProfileView
GrabbeltischView
TransitionEditorView

Eigenschaften:

stateless
visual only
no canonical data

Sie zeigen nur:

SPOT data
WorkingSet data
Reference data


⸻

5 Messaging

Messaging verbindet Window und Worker.

Prinzip:

Command → Worker
Event → Windows

Beispiel:

ImportController
     │
     ▼
messaging.send("import.start")

Worker
     │
     ▼
messaging.broadcast("Import.StateChanged")


⸻

Rollenübersicht

Rolle	Verantwortung
WindowRuntime	Fensterstart und Session
ViewController	Views verwalten
ToolControllers	User-Werkzeuge
Views	Darstellung
Worker	Datenautorität
SPOT	kanonisches Modell

Wichtige Regel

Die wichtigste Regel der Architektur lautet:

Views do not own data.
Controllers do not own data.
Only the SPOT Store owns project data.

Alle Änderungen müssen durch den Worker laufen.

So kann man sich ufAIM vorstellen:

        SPOT Model
             │
       SharedWorker
             │
     ┌───────┴────────┐
     │                │
 Window A         Window B
     │                │
 Tools + Views   Tools + Views
 
Alle Fenster arbeiten auf dem gleichen Modell.
