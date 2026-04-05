# NOW.md

## CORE FLOW (NON-NEGOTIABLE)

parse
→ landFAT
→ validateLandFAT
→ sparse (buildSparseFromLandFAT)
→ validateSparseAlignment
→ SPOT (store ONLY)
→ Projection (@kernel ONLY)
→ View (render ONLY)

---

## HARD RULES (DO NOT BREAK)

### 1. SINGLE SOURCE OF TRUTH
- landFAT = import truth
- sparse = geometry truth
- SPOT = object truth
- Projection = view truth

→ NEVER duplicate truth across layers

---

### 2. SPOT IS NOT A CALCULATOR
SPOT stores:
- ids
- references
- parameters

SPOT NEVER:
- builds geometry
- samples geometry
- modifies sparse

---

### 3. PROJECTION IS THE ONLY GEOMETRY ENTRY
ALL viewable geometry MUST come from:

    @kernel → AlignmentProjectionService

FORBIDDEN:
- sampleAlignment in View
- polyline stored in SPOT
- geometry cached in UI

---

### 4. IMPORT PIPELINE IS PURE

runImportPipeline:
- no UI
- no SPOT
- no side effects

ONLY:
    file → landFAT → validated → importResult

---

### 5. SPARSE IS MANDATORY BEFORE SPOT

NO sparse → NO SPOT candidate

NO EXCEPTIONS

---

### 6. VALIDATION LIVES IN ONE PLACE

✔ validateLandFAT → import stage  
✔ validateSparseAlignment → domain stage  

FORBIDDEN:
- duplicate validation in View
- silent fallback logic

---

### 7. WINDOWS ARE DUMB

Windows:
- do NOT store truth
- do NOT sync each other
- do NOT compute geometry

Windows ONLY:
    subscribe → project → render

---

### 8. EVENTS DRIVE UI

ONLY trigger for Spot UI:

    Spot.UiStateChanged

FORBIDDEN:
- polling Spot.GetState in loops
- manual UI refresh calls

---

## CURRENT FOCUS (ROCK MODE)

1. Projection = SINGLE ENTRY POINT
2. Remove ALL preview geometry hacks
3. Enforce sparse-before-spot everywhere
4. Stabilize Spot.UiStateChanged flow

---

## STOP DOING THIS

❌ "just quick polyline fallback"
❌ "temporary preview sampling in View"
❌ "store polyline for convenience"
❌ "validate again just to be safe"
❌ "call kernel from multiple places"

---

## DEFINITION OF DONE

✔ deterministic pipeline  
✔ every step loggable  
✔ no hidden geometry generation  
✔ projection is the ONLY geometry path  
✔ UI reacts only to events  

---

## MANTRA

"SPOT knows WHAT.
Projection knows HOW.
View just SHOWS."
