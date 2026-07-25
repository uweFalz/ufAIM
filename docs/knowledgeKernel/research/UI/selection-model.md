# Selection model

## State

```text
workspaceSelection {
  primary: { kind, objectId, subId? } | null
  context: [{ kind, objectId, relation? }]
  focus: { intrinsicPosition? | intrinsicRange? | spatialExtent? }
  representationHint?: plan | map | profile | curvature | evidence | comparison
}

ephemeral {
  hover: { kind, objectId, subId? } | null
  preview: { candidateId, targetId? } | null
}

toolLocal {
  ownerSurface, workingCopyId?, localSubselection?, compareSet?
}
```

The schema is an App candidate, not a Kernel definition.

## Primary and context rules

- Exactly zero or one primary subject.
- An Alignment element uses the element as primary and its Alignment as context.
- An intrinsic position/range is focus within the selected Alignment unless the
  position itself is the explicit object of an operation.
- Imported candidate, evidence record, transition function, calculation
  candidate, and derived object can each be primary; their source/target/
  governing Alignment becomes context.
- Context is visible but does not receive primary actions.
- Multi-selection exists only as an explicit comparison/operation set inside a
  tool, never as ambiguous competing primary selections.

## Surface response

| Primary | mainView | Cockpit | Tool following |
|---|---|---|---|
| Alignment | strong line + context objects muted | identity, placement/state, next actions | relevant tools offer Open |
| Element | element strong, Alignment retained | type/range/state, edit/calculate | CurvatureBand/editor follows |
| Intrinsic position/range | cursor/range across views | position plus governing Alignment | all linked plots follow |
| Import candidate | ghost preview if realizable | source, interpretation, transfer status | Workbench owns task |
| Evidence | flash affected object/region if known | evidence state and reason | evidence view follows |
| Transition function | optional plot only, no spatial fiction | function identity/applicability | TransEd owns local catalogue |
| Calculation candidate | ghost over target + difference | candidate/applicability/not applied | candidate review follows |
| Derived object | strong object, governor visible | dependency/validity/next action | derived tool follows |

## Tool-local selection

A tool may maintain independent local selection only when selecting catalogue
records, candidate alternatives, control points, or table rows that are not the
workspace subject. It must:

- label the local scope (for example “Candidate B of 4”);
- preserve the workspace primary and show its context;
- never update Cockpit as if the local row were the durable subject;
- promote to workspace selection only through an explicit Select/Open action;
- clear or restore predictably on Close.

TransEd catalogue browsing is the archetype; it must not hijack SPOT selection.

## Persistence

Selection uses stable semantic identifiers, never DOM nodes, translated labels,
array indexes, coordinates, or rendered feature IDs. Language, docking, narrow
layout, and representation changes preserve it. If a selected subject is
removed, selection moves to the nearest surviving semantic parent and announces
the change. If a representation cannot show it, the representation says “not
representable here” while Cockpit and selection remain intact.

