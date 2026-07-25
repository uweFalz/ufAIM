# Surface architecture

| Surface | Responsibility; entry / exit | Selection; mutation authority | Visibility / layout | Must not own |
|---|---|---|---|---|
| Home | orientation and start/recover; launch or Home / selecting/opening | reads workspace; create/import routes to workflows | mainView state; narrow stacks action cards | recents as identity, property editing |
| mainView | active plane/map, framing, direct selection, previews; Home/open object / tool may overlay | drives common selection/focus; only direct commands explicitly active | always dominant; never fully covered | identity, CRS transform, acceptance |
| Cockpit | concise selected-subject brief/router; selection / collapse | follows selection; dispatches explicit commands | contextual dock, movable/collapsible; narrow bottom sheet | object browser, property dump, local selection |
| Objects | find/filter/open objects, candidates, evidence, relations | can set workspace selection; organize only via explicit commands | on demand full-height browser; narrow replaces view with Back | geometry editing, engineering identity definition |
| CurvatureBand | intrinsic position, curvature evolution, constrained intent editing | follows Alignment/element; local handles; commits Alignment commands | task strip top/bottom, compact/collapsed; narrow full tool | transition catalogue, unrelated properties |
| Alignment Editor | exact constructive sequence/parameters | follows Alignment; working copy and atomic apply | on demand side/full workspace; narrow full-screen | map navigation, Transition DB |
| TransEd | transition-function catalogue, live κ/κ′/κ″, working function | keeps catalogue local selection; transfers/applies only to declared target | on demand focused workspace; narrow full-screen | SPOT selection, Alignment element editor |
| Import Workbench | source evidence, interpretation, unresolved retention, transfer | import candidate/evidence primary; transfer crosses admission boundary | dedicated workspace; Cockpit collapses; narrow stepped flow | SPOT identity redefinition, parser semantics |
| AXTRAN review | problem statement, candidates, residuals, comparison, preview | candidate set local; Apply targets declared Alignment command | focused compare workspace; narrow sequential A/B | solver truth, automatic acceptance |
| Derived application | configure/place dependent candidate and inspect change | governing Alignment context; candidate local; Create/Update dependent object | tool + mainView overlay; narrow staged placement | Alignment modification, platform rules in shell |

## One-plane shell

At wide widths mainView remains the largest continuous region. One contextual
surface may dock beside it and one analytic strip may dock above/below it.
Focused tools may replace the central region but retain a locator and stable
Back/Home route. Floating windows are optional saved layout, not workflow
semantics.

At narrow width there is one primary surface at a time:

```text
top: Back/Home | selected subject | state
body: mainView OR focused tool
bottom: up to three next actions | More
```

Selection and working state survive layout transitions. Hover-only interactions
gain tap/keyboard equivalents. Dock and panel location never encode authority.

