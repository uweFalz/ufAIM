# mainView and Cockpit contracts

## mainView contract

mainView is the dominant answer to “where am I and what am I working on?” It
shows one active plane or map, overlays selected engineering objects and
dependent/context layers, supports select/focus/range gestures, and hosts
clearly labelled previews. It does not own object identity, properties,
evidence, calculation, acceptance, or tool state.

### Home

Home frames the loaded universe in the best available plane:

- no data: calm empty canvas with `New Alignment`, `Import`, and `Open Objects`;
- local-only: complete engineering plane with axes, units, origin/frame badge,
  fit-to-work, and no degraded warning;
- geographic context available: optional map mode; returning to local preserves
  intrinsic focus;
- mixed/unmappable content: frame the active scope and show an unobtrusive
  “3 items outside this realization” notice.

### Plane and realization distinctions

The mode label is always explicit: `Local engineering plane`, `Geographic map`,
or `Physical/observed realization`. A CRS badge identifies a dependency, not
identity. Attaching geographic context is a deliberate transform workflow with
preview, accuracy/applicability report, and undo. MapLibre is a geographic
basemap/rendering adapter only; it does not own coordinates, transforms,
selection, or object identity.

### Layers and selection

Order: basemap/grid → context/observations → Alignment/network → dependent
objects → candidates/previews → selection/focus → warnings/handles. Selection
uses one strong outline plus a sparse station/range cue; context fades rather
than accumulating labels. Editing keeps governing neighbors, constraints,
dependent-object impacts, and needed evidence visible; unrelated overlays
quietly recede.

### 3D

3D is contextual/diagnostic for grade/cant, physical realization, clearance,
and derived-object spatial relationships. It is off by default for constructive
horizontal alignment work, evidence triage, and candidate comparison where
perspective impairs exact judgement.

### State model

```text
empty
  -> local(scope, selection?, focus?)
  -> geographic(context, scope, selection?, focus?)
  -> realization(kind, context, scope, selection?, focus?)

Each state may add:
  preview(candidate) | compare(A,B) | editOverlay(tool)

home() frames current scope without changing engineering state.
```

## Cockpit contract

Cockpit answers, in this order:

1. What is selected?
2. What state is it in?
3. What matters now?
4. What can I do next?
5. What evidence/warning deserves attention?
6. Which tool provides depth?

Default anatomy: type + name; one-line state; at most three primary actions; at
most one concise notice; `More` and `Evidence` disclosure. It is collapsible,
may move/dock, and becomes a bottom sheet or selection header at narrow width.

### Required states

| State | Brief | Default actions | Notice/depth |
|---|---|---|---|
| Empty home | loaded object/evidence counts or “No objects” | New, Import, Objects | attention count only |
| Alignment | identity label, intrinsic extent, placement/realization state | Focus, Edit, Derive | dependencies/placement issue |
| Alignment element | type, intrinsic range, degrees-of-freedom summary | Edit, Calculate, Compare | continuity/constraint issue |
| Imported candidate | source identity, interpreted/unresolved/admitted state | Preview, Inspect, Transfer | ambiguity/CRS/evidence count |
| Unresolved evidence | source, reason, affected subject if known | Reveal, Classify, Retain | never imply deletion |
| Transition function | function/version/source, domain/applicability | Open TransEd, Compare, Use in working copy | not “applied” |
| Calculation candidate | target, applicability, residual summary, `not applied` | Preview, Compare, Apply/Reject | assumptions and authority |
| Derived dependent object | type, governor, valid/stale/review state | Focus, Edit placement, Compare change | dependency delta |

### Never in default Cockpit

- exhaustive property tables or raw source rows;
- permanent object tree, layer manager, console, or debug information;
- full provenance/dependency graph;
- all warnings when none affects the next action;
- multiple competing selections;
- solver logs or full residual matrices;
- style/layout controls;
- actions unrelated to the selected subject;
- green “valid” that conflates applicable, accepted, and authoritative.

