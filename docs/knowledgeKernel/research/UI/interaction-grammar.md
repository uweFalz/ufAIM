# Interaction grammar

## Common contract

All surfaces use the same verbs. A verb has one semantic result even when its
control differs (pointer, keyboard, menu, or command palette). `Focus` changes a
view; `Select` changes workspace selection; `Open` changes surface; only the
mutation verbs change engineering or working state.

| Verb | Intent / owner | Feedback and synchronized behavior | Mutation / undo / authority |
|---|---|---|---|
| Find | locate a subject; Objects/search | results with type/state/scope; hover flashes in visible views | none; none; no authority |
| Focus | bring subject/range into working frame; mainView or active tool | animated frame and shared cursor/range; selection unchanged | view state only; Back restores; no engineering authority |
| Select | make one subject primary; workspace | persistent highlight, Cockpit brief, followers update | selection state only; previous selection recoverable |
| Inspect | see concise information without entering a task; any representation | hover/peek or disclosure; no rival selection | none |
| Open | enter the subject or focused tool; Objects/Cockpit | breadcrumb/tool title; selection preserved | surface/navigation only; Close/Back |
| Edit | start a constrained working copy; specialized tool | edit mode, freedoms/locks, dirty state | working copy; cancel or command undo; edit capability required |
| Calculate | request alternatives/evaluation; tool | progress, inputs, residuals, candidate IDs | creates candidate/evidence, never acceptance; cancellable; service capability |
| Compare | place subjects/states in a common frame; comparison tool | A/B labels, synchronized cursor, explicit metric/context | comparison state only unless saved; no decision authority |
| Derive | create dependent working candidate; derived tool | ghost object and governing relation | working candidate; cancel; creation capability |
| Attach context | add realization/reference dependencies; mainView/workbench | plane/map transition with explicit context badge and transform report | context association; reversible command; applicability check |
| Transfer | move interpreted candidate across a boundary, e.g. import to SPOT | source and destination states both visible; new durable reference | admission/association mutation; compensating undo if allowed; explicit boundary |
| Apply | commit selected working/candidate delta to its target | before/after summary, target and scope, success record | atomic domain command; command undo or inverse; capability but not automatic engineering decision |
| Undo | reverse most recent reversible mutation in current target | preview of affected target; synchronized views refresh | inverse/restore at command boundary; cannot erase evidence/decision history |
| Trace provenance | answer “why/from where?”; evidence view | path from subject to source/calculation/decision | none |
| Reveal evidence | disclose technical/raw supporting material; evidence view | level 3–5 disclosure while selection stays stable | none |
| Return home | recover orientation; shell | close transient tools, frame universe or chosen home scope | navigation only; dirty work prompts save/discard/cancel |

## Cross-view event rules

1. A user gesture emits at most one workspace selection change.
2. Followers acknowledge with highlight and cursor; they do not echo a new
   selection event.
3. Hover/inspect uses an ephemeral highlight channel and clears on exit.
4. Focus is represented by intrinsic position/range where possible; each view
   maps it into its own coordinates and states when mapping is unavailable.
5. A tool opening does not silently change selection.
6. A tool may request a selection change, but it must use the common selection
   command and show the result everywhere.
7. Preview is visually distinct (ghost/dashed plus label) and cannot be
   mistaken for applied state.

## Mutation and recovery

The smallest meaningful domain command is the undo boundary. Pointer motion
updates a working copy; pointer release proposes one command; Apply commits one
command. Calculations create immutable candidate/evidence records. Reject keeps
the candidate provenance and records disposition; it does not delete evidence.
Irreversible or accountable actions require explicit target, effect, and
authority confirmation.

