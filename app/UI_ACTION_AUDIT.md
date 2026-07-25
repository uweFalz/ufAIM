# alignmentOS visible-action audit

Mission baseline: `APP-UI-RECOVERY-001`

Only normal product mode is covered. Repeated object/import rows inherit the
same disposition as their row action. Developer harness controls are excluded
because they are not rendered as product actions.

| Location | Action | Owner / command | Disposition |
| --- | --- | --- | --- |
| Toolbar | Import file | ImportController / file picker | Keep |
| Toolbar | Import workbench | GND Import Workbench controller | Keep; contextual evidence home |
| Toolbar | Language | i18n runtime | Keep |
| Toolbar | Objects | SPOT workspace | Keep |
| Toolbar | TransEd | TransitionEditorBridge / Transition commands | Keep |
| Toolbar | Alignment Editor | AlignmentEditorBridge / AlignmentApplicationService | Keep; independent from TransEd |
| Toolbar | Bands | legacy 2D board | Hide; duplicates the CurvatureBand without current user value |
| Toolbar | Section | legacy section board | Hide until a current owning workflow exists |
| Toolbar | Status / Debug | developer diagnostics | Hide in normal product mode |
| Toolbar | Cockpit | UI shell | Keep |
| Toolbar | Cursor − / + / station | Viewer cursor state | Keep |
| Toolbar | Auto-fit | Viewer framing preference | Keep |
| Toolbar | Frame | ViewController | Keep |
| CurvatureBand | New Alignment | AlignmentCreationController | Keep in empty state |
| CurvatureBand | Add straight | AlignmentCreationController | Keep when an Alignment is active |
| CurvatureBand | Add transition + arc | AlignmentCreationController | Keep when structurally applicable |
| CurvatureBand | Add arc | AlignmentCreationController | Keep; structured rejection remains visible |
| CurvatureBand | Remove | AlignmentCreationController | Keep only with element selection |
| CurvatureBand | Undo | AlignmentApplicationService history | Keep only when history exists |
| CurvatureBand | Details | AlignmentEditorBridge | Keep; opens the correct editor |
| CurvatureBand | Collapse / compact | CurvatureBand controller | Add |
| CurvatureBand | Move edge | CurvatureBand controller | Add; top/bottom session state |
| CurvatureBand | Resize | CurvatureBand controller | Add |
| Alignment Editor | Element choice | AlignmentEditorBridge | Keep |
| Alignment Editor | Apply | AlignmentApplicationService | Keep as the only commit action |
| Alignment Editor | Undo | AlignmentApplicationService history | Add |
| Alignment Editor | Reset | AlignmentEditorBridge local form | Keep; never commits |
| Alignment Editor | Technical details | presentation-only disclosure | Add; closed by default |
| TransEd | Transition choice | Transition query commands | Keep |
| TransEd | κ / κ′ / κ″ emphasis | TransitionEditorView | Keep; all three remain visible |
| TransEd | w1 / w2 | Transition working-copy state | Keep inside the plot |
| TransEd | Apply working copy | Transition.UpdateWorkingCopy | Keep |
| TransEd | Reset working copy | Transition.ResetWorkingCopy | Keep |
| TransEd | Catalogue / details / compare | Transition query commands | Keep behind disclosure |
| Cockpit empty | New Alignment | AlignmentCreationController | Keep |
| Cockpit contextual | Edit selected element | AlignmentEditorBridge | Keep |
| Cockpit contextual | Frame / inspect / import actions | existing action adapters | Keep only when supplied by current context |
| Cockpit object rows | Activate / inspect | SPOT actions | Relocate to Objects by default; retained only in empty overview |
| Cockpit import rows | Preview / transfer | Import actions | Show only for import context |
| Objects cards | Select / rename / remove / undo / details | SPOT workspace controller | Keep |
| Import Workbench | Inspect / preview / transfer / clear preview | GND Import Workbench controller | Keep; eligibility-gated |
| Every panel | Close | owning overlay bridge | Keep |

No control was retained merely because a handler existed. The hidden legacy
Bands, Section, and Debug toolbar entries remain internally callable for
regression and developer use but no longer compete with the primary product
surface.
