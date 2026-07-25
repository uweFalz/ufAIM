# Scenario walkthroughs

Each row states: active surface; primary object; representation; action;
mutation; recovery; evidence/authority boundary.

## A — New Alignment

| Step | Contract |
|---|---|
| Home | mainView; none; local plane; New Alignment; none; Home; no object yet |
| Create | creation flow + plane; working candidate; ghost sequence; choose start/template; working copy; Cancel; template is not authority |
| Construct | CurvatureBand/Editor; Alignment working copy; plan + curvature; add constrained elements; working copy commands; Undo; freedoms explicit |
| Select | mainView; Alignment/element; synchronized plan/band; Select; selection only; previous selection; representation is not identity |
| Edit curvature | CurvatureBand; element with Alignment context; κ band + plan; drag allowed freedom / exact edit; atomic Alignment command; Undo; constraints shown |
| Undo | same; same; prior state preview; Undo; inverse command; Redo where safe; provenance/history retained |

## B — Imported Alignment

| Step | Contract |
|---|---|
| Import | Workbench; import session/candidate; source summary + preview; ingest; evidence records; close/reopen session; source preserved |
| Inspect evidence | Workbench; evidence record; tree/raw/overlay; Reveal; none; Back; interpreted and unresolved separate |
| Transfer | Workbench; candidate with source context; before/destination summary; Transfer to SPOT; admission command; compensating removal only if policy allows; explicit boundary |
| Edit representation | mainView/Editor; admitted Alignment; plan + curvature; Edit; Alignment command; Undo; source evidence remains unchanged and linked |
| Trace | evidence view; Alignment; provenance path; Trace; none; Back; edit does not rewrite source claim |

## C — Transition calculation

| Step | Contract |
|---|---|
| Select join | mainView/CurvatureBand; element boundary; cursor across plan/band; Select; selection only; previous; intrinsic position explicit |
| Declare | AXTRAN/TransEd task; problem working copy; freedoms/locks table + plot; set freedoms/constraints; working state; Cancel; no false handle |
| Calculate | candidate review; problem; progress then candidate set; Calculate; immutable candidate/evaluation evidence; cancel request; solver has no authority |
| Inspect | review; local Candidate A; residual plots/table; Inspect/Compare; none; switch A/B; applicability distinct |
| Preview | mainView + review; target remains primary, candidate ephemeral; ghost delta; Preview; preview state; clear; not applied |
| Apply/reject | review; candidate; before/after + target; explicit Apply or Reject; target command or disposition record; command Undo where valid; neither action silently records engineering decision |

## D — Use without editing

| Step | Contract |
|---|---|
| Select range | mainView; Alignment with intrinsic range; plan/range cue; range-select; focus state; clear range; no Alignment mutation |
| Derive | derived tool; platform candidate, Alignment context; complete ghost; Derive platform; working candidate; Cancel; rule outputs labelled derived |
| Place | tool + mainView; same; plan/profile if needed; constrain side/start/length/offset; working copy; Undo; locked values not draggable |
| Create | tool; derived object; applied representation + dependency cue; Create; new dependent SpotObject/relation candidate per domain authority; undo creation if allowed; not an Alignment edit |
| Alignment changes | Cockpit/mainView; dependent object; old/new ghost and notice; inspect impact; recalculation/status mutation only per application contract; revert Alignment command; automatic update never hidden |
| React | comparison tool; derived object; delta/evidence; Update, keep prior, or mark review; explicit command/disposition; Undo; responsible decision remains separate |

## Scenario result

All four scenarios use the same selection, focus, preview, working-copy, apply,
undo, evidence, and authority grammar. No scenario requires Cockpit to own data
or a panel-specific competing selection. The selection model therefore covers
both Alignment editing and evidence inspection without a stop-condition conflict.

