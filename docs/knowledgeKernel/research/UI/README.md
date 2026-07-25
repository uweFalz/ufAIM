# RESEARCH-UI-ALIGNMENTOS-001 — From Darwin to Finder

Status: non-canonical UI Research  
Responsible stream: research / UI  
Baseline: `c5d2763e8d6a891d6324c8ee9376970ddb1e5113`

## Outcome

The starting hypothesis **survives with reformulation**.

alignmentOS's UI object metaphor is not a file and not a rendered curve. It is a
**durable engineering subject with coordinated lenses**: an Alignment, element,
evidence item, candidate, transition function, or dependent object is located
once, selected once, and then shown through whichever spatial, intrinsic,
analytic, evidential, or comparative representation answers the current
question.

The recommended product model is:

- **Home** is the recoverable orientation state for the loaded engineering
  universe, not a blank dashboard.
- **mainView** is the dominant spatial/intrinsic work frame. It owns framing and
  view mode, never engineering identity or acceptance.
- **Cockpit** is a concise selection brief: identity, state, one important fact,
  next actions, and exceptional notice. It is not an object browser or property
  dump.
- **Objects** locates and organizes durable objects, candidates, and evidence.
- **Tools** temporarily become the primary representation for a focused task.
- **One workspace selection** coordinates all surfaces; tools may keep a clearly
  labelled local sub-selection or working copy without replacing it.
- **Preview, calculate, apply, and decide are distinct transitions.** A
  successful calculation never implies applicability, acceptance, or authority.

## Deliverables

1. This document: outcome, users, Finder disposition, external study, truth
   model, derived-application test, and answer to the ten done questions.
2. [domain-to-representation matrix](domain-representation-matrix.md)
3. [interaction grammar](interaction-grammar.md)
4. [selection model](selection-model.md)
5. [mainView and Cockpit contracts](mainview-cockpit-contracts.md)
6. [surface architecture](surface-architecture.md)
7. [scenario walkthroughs](scenario-walkthroughs.md)
8. [wireframe set](prototypes/index.html)
9. [prioritized App roadmap](app-roadmap.md)
10. [mission report](MISSION_REPORT.md)

## Evidence labels

Statements use these labels:

- **[R]** user requirement from the mission.
- **[K]** observed approved/candidate Knowledge Kernel boundary.
- **[A]** observed Reference App behavior at the baseline working tree.
- **[E]** observed external product pattern.
- **[I]** design inference.
- **[P]** proposed interaction contract.
- **[O]** open product or governance question.

## User and workflow model

The four roles share an object universe, selection grammar, representations,
evidence access, comparison semantics, and authority cues. They differ mainly in
default actions and disclosure depth:

| Role | Default question | Default next actions | Extra disclosure |
|---|---|---|---|
| Alignment designer | Is the constructive geometry viable? | edit, calculate, compare, apply | curvature derivatives, freedoms, residuals |
| Engineering surveyor | What was observed and how can it be interpreted? | import, inspect, transfer, compare | CRS/realization, uncertainty, raw evidence |
| Infrastructure planner | What can be derived without changing the governor? | select range, derive, place, monitor | dependencies and change impact |
| Responsible engineer | What is supportable and within my authority? | compare, trace, record decision | assumptions, applicability, provenance, decision record |

Role changes should reorder recommended actions and saved workspaces, not create
four applications. Authority remains explicit per action rather than inferred
from a role label. [I]

## Finder analogy: disposition

### Transfer

- Stable, referenceable object metaphor.
- Separate locating, selecting, previewing, opening, and editing.
- A selected item survives a change of representation.
- Search and saved scopes hide storage details.
- Contextual actions are close to the selected subject.
- Details and raw metadata are progressively disclosed.
- A predictable Home and Back/Home recovery path.

### Do not transfer

- File/folder containment as the primary engineering hierarchy.
- One preview as the presumed truth.
- Opening a file as permission to mutate it.
- Drag/drop as a universal semantic operation.
- Generic “modified” status in place of candidate/applicable/accepted/
  authoritative distinctions.
- Deleting unresolved evidence because it cannot be interpreted.

Finder works because selection is stable while icon, list, column, gallery, and
preview are replaceable representations. alignmentOS should transfer that
grammar, but its subject is an engineering object or evidence-bearing candidate,
not a storage artifact. [I]

## External product pattern study

This is a pattern study, not a feature comparison.

1. **Apple Finder — selection, preview, open, contextual action.** Finder offers
   multiple views of the same item, a preview pane, Quick Look, and Quick
   Actions. Transfer: selection should not equal opening or editing. Do not
   transfer: files are simpler than multi-representation engineering subjects.
   Risk: copying a three-column appearance without a stable engineering object
   model. [Apple Finder guide](https://support.apple.com/en-ca/guide/mac-mini/apddf030866a/mac),
   [Preview pane](https://support.apple.com/en-au/guide/mac-help/mchl1e4644c2/mac).

2. **ArcGIS Pro — linked views.** One active view drives linked centers/scales;
   linking is visible and optional. Transfer: declare the active driver and show
   synchronization. Do not transfer: spatial extent alone cannot synchronize
   intrinsic position, evidence, or calculation candidates. Risk: silent
   feedback loops between views. [ArcGIS Pro linked views](https://pro.arcgis.com/en/pro-app/latest/help/mapping/navigation/link-multiple-views.htm).

3. **QGIS — identify versus selection.** Identify can highlight and inspect
   overlapping features without necessarily changing selection, and results can
   expose raw versus formatted values. Transfer: hover/inspect is ephemeral;
   selection is durable. Do not transfer: layer-first identity. Risk: confusing
   canvas hit results with engineering identity. [QGIS Identify Features](https://docs.qgis.org/4.2/en/docs/user_manual/introduction/general_tools.html).

4. **Civil 3D — plan/profile/bands and cross-highlighting.** Profile views
   coordinate several profiles and bands along an Alignment; crossing selection
   highlights plan and profile. Transfer: station cursor and selection synchronize
   plan, profile, and analytic bands. Do not transfer: drawing/view objects and
   style configuration must not own identity. Risk: permanent band overload.
   [Profile views](https://help.autodesk.com/cloudhelp/2024/ENG/Civil3D-UserGuide/files/GUID-C2C782D2-899C-4B0B-9E61-9D72A80AFC80.htm),
   [cross-highlighting](https://help.autodesk.com/view/CIV3D/2026/ENU/?guid=GUID-C2169772-A968-47DB-ADD9-33139AE8486E).

5. **Revit — contextual properties.** A modeless palette follows selection and
   distinguishes editable from calculated/dependent values. Transfer:
   contextual fields and constraint-aware read-only states. Do not transfer: a
   permanently open exhaustive palette. Risk: Cockpit becoming a parameter
   dump. [Revit Properties palette](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-GetStarted/files/GUID-A764EA7A-FE26-469B-857C-F3A70812FC34.htm).

6. **Blender modifiers — non-destructive result versus Apply.** A modifier can
   affect display without changing editable base geometry; Apply makes the
   effect permanent. Transfer: previews and candidates remain reversible until
   explicit Apply. Do not transfer: “permanent geometry” is not engineering
   acceptance or accountable authority. Risk: treating Apply as a decision
   record. [Blender modifier guidance](https://docs.blender.org/manual/en/latest/grease_pencil/modifiers/introduction.html).

7. **ParaView — linked selection in scientific views.** ParaView propagates a
   selection between coordinated render, chart, and data views. Transfer:
   semantic selection should survive a change from spatial to analytic or
   tabular representation. Do not transfer: a selected dataset row is not
   automatically a durable engineering subject. Risk: synchronizing display
   indices instead of identity and intrinsic focus.
   [ParaView User's Guide 6.0](https://docs.paraview.org/_/downloads/en/latest/pdf/).

8. **Google Earth — orientation and recovery.** Navigation controls recede
   when idle, while explicit commands restore north-up, top-down, or the globe
   overview. Transfer: keep normal work visually calm and provide a predictable
   recovery orientation. Do not transfer: north-up and geographic overview are
   not universal engineering Home states. Risk: making local-Cartesian work
   feel incomplete because a basemap is absent.
   [Google Earth navigation](https://support.google.com/earth/answer/148186?hl=en-en).

## Truthfulness with calm progressive disclosure

Every subject exposes a five-level truth stack:

1. **Immediate state:** one noun and one state token, e.g. “Candidate · not
   applied”; always visible near selection.
2. **Concise notice:** one actionable warning or uncertainty count; appears only
   when it changes the next safe action.
3. **Contextual explanation:** why the notice exists and what is affected;
   Cockpit disclosure or tool explanation.
4. **Technical evidence:** assumptions, residuals, uncertainty, CRS/realization,
   dependencies, and provenance graph; dedicated view.
5. **Raw source detail:** exact imported rows/files/messages, preserved and
   reachable but never forced into normal work.

Escalate automatically from 1 to 2 for inapplicability, unresolved ambiguity,
stale dependency, failed constraint, or missing authority. Escalate to 3–5 only
on user request or when an action would cross an authority/destructive boundary.
Colour is redundant with text/icon/shape. “Unknown” is a state, not an error.
[P]

## Direct manipulation policy

- Directly manipulate **engineering intent** only where the pointer maps to a
  genuine degree of freedom and live constraints are visible.
- Use parameter editing for exact values, standards, discrete choices, and
  inaccessible geometry.
- Use calculated constraint solving when variables are coupled or feasibility
  cannot be maintained continuously.
- Never present a draggable handle for a derived or constrained value. Show a
  locked/dependent handle that explains the governing relation.

Examples: selecting an Alignment and framing a station range are direct;
curvature handles are direct only for declared freedoms; `w1,w2` partition
boundaries may drag within admissible bounds; a solver candidate is previewed,
not dragged into “acceptance”; platform placement manipulates offset/range
constraints while equipment derived from rules remains read-only. [P]

## Derived platform test

“Exterior platform, category IV, usable length 200 m” passes through:

1. Objects/Derive chooses a platform type while an Alignment range is primary.
2. A placement working copy appears; standard parameters and rule-derived
   equipment are labelled `input`, `derived`, or `unresolved`.
3. mainView shows a translucent complete candidate following intrinsic position
   or pointer; Cockpit says `Candidate · depends on Alignment A`.
4. The user constrains start/range/side/offset. Invalid freedom is never shown.
5. Create records a dependent object and governing relation; it does not modify
   the Alignment.
6. An Alignment change recalculates the dependent representation when
   applicable, otherwise marks it `needs review`.
7. A comparison explains geometry, rule input, and provenance deltas before any
   explicit update/apply.

This demonstrates that applications sit above alignmentOS as consumers and
producers of dependent SpotObjects and explicit relations. Platform rules are
deliberately not defined here. [P]

## Answers to the done questions

1. **Object metaphor:** a durable engineering subject with coordinated lenses.
2. **Home:** a recoverable overview of the loaded universe and recent/attention
   work, with create/import/open entry points.
3. **mainView:** spatial/intrinsic framing, direct selection, context layers,
   preview, and synchronized highlighting.
4. **Cockpit:** concise selected-subject brief and safe next-action router.
5. **Selection:** one typed primary selection plus context, focus position/range,
   ephemeral hover, and tool-local working selection.
6. **Primary representation:** chosen by user question, as specified in the
   matrix; no universal permanent panel.
7. **View to work:** select → inspect → open task tool → create working copy or
   calculation → compare/preview → explicitly apply/reject → undo at the
   mutation boundary.
8. **Truth states:** the five-level disclosure stack with mandatory immediate
   state and escalation at safety boundaries.
9. **Applications:** derived objects retain explicit governing dependency and
   change-impact state.
10. **Implementation order:** selection/focus and state semantics first, then
    Home/mainView/Cockpit, then focused engineering workflows; see roadmap.

## Kernel boundary and open questions

The model preserves `FC-001` (Representation is never Identity), `FC-002`
(Metric Realization is not Identity), intrinsic Alignment identity, candidate
versus decision boundaries, and imported candidate versus admitted SpotObject.
UI selection, focus, preview, and working copies are application state only.

- **UI-OD-001:** exact identity and authority semantics of Candidate Solution
  remain evidence-missing in `KC-EVAL-008`; the UI can distinguish states but
  cannot canonically define them.
- **UI-OD-002:** accountable Engineering Decision semantics remain
  evidence-missing in `KC-EVAL-011`; “Apply” must not claim acceptance.
- **UI-OD-003:** representation semantics have no promoted active concept.
  Implementation may coordinate views but must not claim canonical
  Representation meaning.
- **UI-OD-004:** rules and invalidation semantics for derived platform objects
  require a separate application/domain package.

None prevents the coherent UI model; each is an explicit authority boundary.
