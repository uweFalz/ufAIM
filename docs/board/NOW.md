# ufAIM – Current Focus

## Goal

Railway alignment engineering framework  
with SPOT data model and multi-window workspace.

---

# ACTIVE AREAS

### Import

sniff → parser → landFAT → sparseAlignment → SPOT

	•	GNDedit .MDB/.XLSX Import als nächster Real-World-Use-Case
	•	Importpfad dafür sauber definieren: sniff → parse → normalize → Spot/RouteProject
	•	Import-Service-/Worker-Schnitt dabei mit absichern
	•	kleiner Zielpunkt: erste lauffähige Beispieldatei bis „im Spot sichtbar“
Das passt gut, weil Import aktuell schon stabil genug ist, um als echter Use Case weitergezogen zu werden.

### Window Runtime

WindowRuntime  
workspaceState  
uiWiring

### Alignment Engine

Current work:

- Separate RegistryCompiler and KappaFcnBuilder responsibilities
- Define transition runtime descriptor for AlignmentEngine
- Fix geometric foundation (pose2 representation)

Alignment tasks:

1. Correct pose2 representation
   { {x,y}, {tx,ty} } instead of { {x,y}, theta }

2. Provide minimal linear algebra layer
   vec2 / frame2 helpers instead of scattered helpers

3. Clean AlignmentElement class hierarchy

4. Prepare TransitionRuntime input for AlignmentEngine

---

# CURRENT QUESTIONS

- WindowSession vs SpotStore responsibilities
- Who owns working set (Grabbel?)
- Window focus management
- CRS detection for imports

---

# NEXT MILESTONE

Minimal workflow:

Import alignment → Working Set → SPOT → View render
