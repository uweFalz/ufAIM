# MISSION REPORT

## 1. Mission

`DELIVERY1-COCKPIT-VISIBILITY-001`, stream `app`, 2026-09-11.
Remove invisible Cockpit actions from the accessibility surface while preserving
deliberate opening and the L/profile workspace. This addresses the observed
post-import visibility mismatch from `DELIVERY1-RECEIPT-REOPEN-001`, not a general
Cockpit redesign or automatic overlay opening.

## 2. Status

`complete` for this bounded visibility correction. Code integrated on
`origin/main` as `a962ceb49a3008f0321f0415866461156933007b`.
Delivery 1 remains ROT and due 30 September 2026; no new complete import or
multi-domain acceptance is claimed.

## 3. Baseline and Scope

- Repository: `/Users/uwefalz/Developer/ufAIM`.
- Worktree: `/private/tmp/ufAIM-delivery1-cockpit-visibility-0911`.
- Branch: `codex/delivery1-cockpit-visibility-0911`.
- Fresh remote-verified baseline: `5ccf11968444b11cba8e481f85826b3444391b29`.
- Shared checkout stayed at `6c4477f64ac66ec9dffc493a73203b00d60a1f34`, with the
  same foreign contribution EN/DE, thesis artifacts, references.bib and `.claude/`
  paths reported by `git status --short`. None was edited, staged, stashed,
  merged, pulled or adopted.
- Scope: existing Cockpit CSS, one focused regression test and this report.
  Excluded: Kernel, Thesis, Viewer, import interpretation, solver, persistence,
  source qualification, new packages, broad layout changes and port 8080.

## 4. Work Performed

The old collapsed-panel rule set width zero and opacity zero, with pointer
events disabled only on its header/body. The panel was visually closed but its
actions remained exposed in the accessibility tree; the observed two-pixel strip
was its collapsed box, not proof of missing imported data.

Added `visibility: hidden` to the existing collapsed Cockpit rule. Added an
explicit `visibility: visible` exception in the existing collapsed-L rule,
because L uses that panel as its primary profile workspace. Opening via the
existing Cockpit button remains unchanged. No automatic opening or additional
overlay was introduced, and panel contents are not deleted.

## 5. Changed Files

Added:

- `test/app/workspace/collapsed-cockpit-visibility.test.mjs`
- `docs/app/architecture/MISSION_REPORT_DELIVERY1_COCKPIT_VISIBILITY_001.md`

Modified:

- `app/styles/app.css`

Moved or renamed: None. Deleted: None.

## 6. Evidence and Validation

### Visible user journey

`passed` for the bounded visibility action. Fresh browser origin
`http://127.0.0.1:8204/`, served by
`python3 -m http.server 8204 --bind 127.0.0.1` from the isolated worktree.
The first sandboxed server attempt was denied; an approved loopback-only start
succeeded before the origin was opened.

Normal controls: `Neues Alignment` → name `Cockpit Sichtbarkeit` → create →
close editor → open Cockpit → close Cockpit → L → Main. Object
`alignment_mtwqkrg4_zrsjky`, revision `2026-09-11T09:10:54.196Z`, was created by
the UI only for this control-state check. No engineering/source data were injected.

- Main closed: computed `visibility: hidden`; Cockpit headings/actions absent
  from the accessibility tree, including after returning from L.
- Deliberately open: the named object, normal actions and panel were visible
  in both screenshot and accessibility tree.
- Close: panel and its actions disappeared from the accessibility tree.
- L with the sidebar's collapsed flag retained: computed `visibility: visible`;
  profile/chainage/cant regions and initial cross-section visibly remained.
  Their missing engineering data were labelled absent/not available, not created.
- Visibility toggles were immediate; no asynchronous busy stage applies.
- A q-local click on this empty object did not produce a q-local view. No
  q-local or qualified cross-section success is inferred from this empty fixture.

The pre-change accessibility exposure was independently read on the previous
Landshut receipt-proof tab at port 8203. This new empty-object check is NOT an
import acceptance substitute. Physical import acknowledgement/progress was
`not run` in this mission; the prior long file-chooser call remains an acceptance
environment limitation, not an App import-duration measurement.

### Durability/reopen

`not run`: this CSS-only package does not change persistence or stored objects.
The previous W467-468 radius/receipt reopen evidence remains documented in
`MISSION_REPORT_DELIVERY1_RECEIPT_REOPEN_001.md`; it is not relabelled as new proof.

### Regression and integration

`passed`: 12 focused tests, exit 0:

```sh
node --test test/app/workspace/collapsed-cockpit-visibility.test.mjs test/app/import/import-object-cockpit-overlay*.test.mjs test/app/workspace/gnd-route-workspace-cockpit-visible.test.mjs test/app/workspace/gnd-route-workspace-cockpit-boundary.test.mjs
```

The two new source-rule assertions preserve collapsed visibility and the L
exception. They are supplemented by the real browser checks, not presented as
browser simulation.

`failed`: a wider glob also selected
`test/app/workspace/gnd-route-workspace-cockpit.test.mjs`, which could not start
because the fresh worktree lacks the ignored local `mdb-reader` dependency under
`src/import/parsers/technet/gndEdit/mdb/node_modules/`. No parser or dependency
repair was initiated for this CSS package. All other selected tests passed.

`passed`: `git diff --check`, unchanged shared-checkout path/status check, and
normal non-force push `5ccf119..a962ceb` to remote main using the existing scoped
App push/merge approval.

## 7. Kernel and Architecture Impact

Kernel impact: none
Architecture impact: none
RefImpl impact: changed
Thesis impact: none

Only presentation visibility changed. No engineering meaning, admission,
provenance, geometry, parser, source association or persistent state was changed.

## 8. Conflicts, Risks, and Open Decisions

No new decision, ownership conflict or Kernel contradiction.

- `COCKPIT-VISIBILITY-RISK-001`: this does not certify physical import progress,
  full keyboard sequencing or the complete multi-domain Delivery-1 journey.
- `COCKPIT-VISIBILITY-RISK-002`: narrow-layout horizontal overflow and other
  startup/layout behavior are not redesigned by these two visibility rules.
- `COCKPIT-VISIBILITY-RISK-003`: the optional MDB-dependent regression could not
  start in this fresh worktree; its missing dependency is explicitly not counted
  as a passing test or a new production defect.
- Localhost:8080 still serves the unchanged shared checkout. Port 8204 is only
  this isolated verification origin; prior user proof tabs remain untouched.

## 9. Handover

Continue the existing 30-minute Delivery-1 heartbeat. Next safe work is the
remaining real-import acknowledgement/progress evidence using a responsive normal
file/drop control path, then the open qualified multi-domain synchronization
checks. Inspect current state first; do not repeatedly run a blocking browser
file chooser and call its elapsed time App performance.

Any next App change needs a demonstrated journey blocker and a fresh worktree
from current `origin/main`. Relevant scope is the existing import-entry/result
control path, not a new import package or general Cockpit redesign. Done means
an actual physical file action visibly acknowledges, stays busy while active,
terminates truthfully and reaches the selectable imported Alignment. Independent
read-only source work is possible, but this report authorizes no Thesis/Viewer
or source-admission changes.
