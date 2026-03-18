# ufAIM – Session Transfer

Date: 2026-03-17  
Session: short description

Wir arbeiten gerade an TransitionRegistry
pose2 ist falsch
RegistryCompiler wird aufgespalten

---

# STATUS

## Stable parts

- Import pipeline: sniff → parser → normalizeParsedResult
- landXML → landFAT → sparseAlignment
- TRA/GRA → legacy path
- WorkingItems generation works
- SharedMessagingWorker stable

## Working parts

- WindowRuntime
- workspaceState
- spotController
- importController

## Experimental parts

- transitionEditorBridge
- AlignmentFactory
- sparseAlignment builder

---

# CURRENT FOCUS

Transition registry refactor.

Tasks:
- separate RegistryCompiler and KappaFcnBuilder
- define runtime transition descriptor
- correct pose2 representation in geometry layer

---

# FOLLOW-UP TASKS

Immediate next tasks:

1. Fix batch counter in import pipeline
2. Clarify RP-select responsibility
3. Define WindowSessionState

---

# ARCHITECTURE QUESTIONS

Open design questions:

1. Who owns **window focus state**?
2. What is the exact role of **WindowRuntime**?
3. Should **Grabbel** manage the working set?
4. How does **SpotStore interact with windows**?

---

# PENDING ARCHITECTURE TOPICS

Longer term design topics:

- WindowSession model
- CRS Agent
- Project persistence
- MultiWindow focus model
- Reference data integration (terrain / IFC)

---

# NEXT SESSION PLAN

Suggested next steps:

1. Define **WindowSessionState**
2. Fix import batch statistics
3. Clarify RP-select vs view pick
4. Decide WindowSessionController role

---

# NOTES

Important observations or discoveries.

Example:

- landXML alignments import correctly but lack CRS.
- TRA/GRA imports produce artifacts usable by alignment builder.
