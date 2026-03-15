# ufAIM – Current Focus

## Goal

Railway alignment engineering framework  
with SPOT data model and multi-window workspace.

---

# ACTIVE AREAS

### Import

sniff → parser → landFAT → sparseAlignment → SPOT

### Window Runtime

WindowRuntime  
workspaceState  
uiWiring

### Alignment Engine

SparseAlignment  
AlignmentFactory  
Transition functions

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
