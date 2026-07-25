# APP-UI-FOUNDATION-001 — Selection Contract Inventory

## Observed authorities and coupling

| Surface or mechanism | Current owner | Identity carried | Observed coupling or loss |
|---|---|---|---|
| Workspace selection | `windowStore.workspace_selection` | `primaryId`, `contextIds`, `elementId`, `source`, `crsId` | Current global authority; IDs are untyped and `source` is a free-form string. |
| SPOT activation / Objects | SPOT command plus focus manager | SPOT object ID | Activation reaches workspace primary selection. Object type is recovered later from SPOT state. |
| mainView / Viewer | View Controller subscription | primary object ID and element ID | Reads workspace selection; viewer element gestures write the same legacy structure and dispatch an editor-focus event. |
| Cockpit | Cockpit Controller and cockpit actions | primary/context object IDs, element ID | Reads and writes workspace selection; refresh and preview paths are coupled to store subscriptions. |
| CurvatureBand | CurvatureBand Controller | Alignment ID and element ID | Writes the complete legacy selection and optionally emits editor focus. Preview is separately stored in `preview_item`. |
| Alignment Editor | editor bridge | active Alignment plus element ID | Selector changes rewrite workspace element selection. Language refresh reconstructs DOM while attempting to preserve the legacy element ID. |
| Objects Workspace | SPOT view callbacks | SPOT object ID | Card activation delegates to focus manager; local menu and search state are DOM/component-local. |
| TransEd | transition editor bridge | TransitionDB record ID | Record selection is bridge-local. It currently avoids the workspace selection, but this isolation is implicit rather than typed. |
| GND Import Workbench | workbench model/controller | import session item/evidence IDs | Candidate and evidence inspection use workbench state and `preview_item`; explicit transfer promotes an admitted item to SPOT. |
| Import preview | import and Cockpit controllers | candidate item plus source descriptor | `preview_item` is distinct from selection, but both influence Viewer rendering. |
| AXTRAN candidate presentation | calculation result / review UI | candidate ID | Candidate vocabulary exists in calculation output; no shared application-level subject type currently declares it unapplied. |
| Hover and keyboard focus | individual DOM/controllers | DOM node or element ID | Mostly local and unrecorded; must not be inferred as global engineering selection. |

## Rival-state and loop risks

- `workspace_selection` is authoritative, but several surfaces reconstruct and rewrite its entire untyped value.
- Element identity can be separated from its parent Alignment when only `elementId` is passed through an event.
- `source` does not distinguish an initiating gesture from a dependent synchronization.
- Viewer-to-editor and editor-to-workspace paths can produce redundant writes and refresh cascades.
- Preview and tool-local records are correctly separate in several implementations, but their isolation is convention rather than contract.
- Language refresh and overlay reconstruction can retain stale DOM references even when semantic IDs remain valid.

## Foundation introduced by this package

- `subjectReference.js` defines typed application references over existing objects and records.
- `workspaceSelectionCompatibility.js` is the only migration boundary to and from the existing five legacy fields.
- `semanticSelectionContract.js` delegates global writes to the existing workspace store; it does not create a second global selection authority.
- Hover, preview, UI focus and named tool-local selections are explicitly separate.
- Element and station references require their parent Alignment identity.
- Causes carry surface, action, interaction mode, synchronization role/chain and timestamp.
- Repeated synchronization markers and stale element-parent combinations are rejected and retained in diagnostics.
- `selectionDiagnostics.js` exposes a non-visual development inspection hook.

## Remaining integration hooks after runtime ownership release

1. Instantiate one contract beside the existing window store during runtime initialization.
2. Route Objects and Cockpit primary/context actions through `selectPrimary` and `selectContext`.
3. Route Viewer and CurvatureBand element gestures through `focusElement`.
4. Have the Alignment Editor consume intrinsic focus and mark dependent writes as synchronization.
5. Register TransEd, Import Workbench and AXTRAN review selections with `setToolLocal`.
6. Adapt existing `preview_item` producers to publish the corresponding typed preview reference without changing preview semantics.
7. Register the browser regression in bootstrap only after `APP-RUNTIME-STABILITY-001R` releases `main.js` and the affected controllers.

No import interpretation, AXTRAN semantics, Kernel concept or governance state is changed by this inventory or contract.
