# MISSION REPORT

## 1. Mission

`DELIVERY1-RECEIPT-REOPEN-001`, stream `app`, 2026-09-11.
Preserve the already visible horizontal/AXTRAN consequence receipt through a
normal tab close and object-list reopen. Scope is the demonstrated loss after
the W467-468 radius edit in `DELIVERY1-MAIN-LOCAL-PROJECTION-001`; no new solver,
engineering approval, source association, or Kernel concept is introduced.

## 2. Status

`partial` — receipt storage and exact-context restoration work and were observed
in the browser. The implementation is integrated in `origin/main` as
`afffb805778b17a58b2dd5a5b153db19d54c984a`. Delivery 1 remains ROT: the full
normal-import progress gate and complete multi-domain journey are not established
by this mission. Target remains 30 September 2026.

## 3. Baseline and Scope

- Repository: `/Users/uwefalz/Developer/ufAIM`.
- Isolated worktree: `/private/tmp/ufAIM-delivery1-receipt-reopen-0911`.
- Branch: `codex/delivery1-receipt-reopen-0911`.
- Fresh `origin/main` baseline: `89aa721bc043bad29df0be41ea8cecf755a9e75f`,
  also verified by `git ls-remote` before work and before integration.
- Shared checkout remained at `6c4477f64ac66ec9dffc493a73203b00d60a1f34`.
  Foreign contribution EN/DE, thesis build artifacts, references.bib and
  untracked `.claude/` were not edited, staged, stashed, merged or served instead.
- Authorized scope: editor receipt bridge/helper, existing shared Spot command
  and persistence boundary, focused regression test and this report.
- Exclusions: `docs/knowledgeKernel/`, Thesis, technetViewer, IVHW, geographic
  qualification, solver mathematics, profile source interpretation and app-wide
  layout redesign. No dependency or side-package was added.

## 4. Work Performed

- The bridge previously rendered a local receipt after geometry persistence,
  then discarded it on refresh/reopen. It now archives the supplied before/after
  sparse snapshots and original receipt in
  `SpotObject.data.extended.horizontalRealizationReceipts`.
- `Spot.StoreHorizontalReceipt` checks current object, target element, geometry
  revision and exact post-edit sparse state before merging only this extension.
  Its acknowledgement follows the existing IndexedDB transaction; no storage
  means no durable-receipt success. Geometry, source refs, Kernel payload,
  unrelated extension data and engineering revision are not rewritten by it.
- Existing object mutations are serialized at their shared persistence boundary
  so a failed receipt write cannot roll back another queued object's mutation.
  Rename reads its current snapshot within that boundary.
- Reopen validates the archive against the selected element, object and exact
  current sparse state, then checks the stored difference using the existing
  receipt builder. It does not rerun AXTRAN. Stale, malformed, foreign-context,
  or differently labelled/admissible receipts do not restore as verified.
- Historical entries remain in the extension; identical writes do not duplicate
  them, and conflicting receipts for the same revision/element are rejected.
  Old objects without an archive do not receive fabricated historical evidence.
- If evidence storage fails after a successful geometry commit, the UI reports
  `Geometrie gespeichert · Konsequenzbeleg nicht gesichert`; it does not claim
  that geometry failed or that evidence is durable.

## 5. Changed Files

Added:

- `test/shared/messaging/horizontal-receipt-durable-reopen.test.mjs`
- `docs/app/architecture/MISSION_REPORT_DELIVERY1_RECEIPT_REOPEN_001.md`

Modified:

- `app/controllers/bridges/alignmentEditorBridge.js`
- `app/domain/workspace/buildHorizontalRealizationChangeReceipt.js`
- `src/shared/messaging/CommandContract_v1.js`
- `src/shared/messaging/SharedMessagingWorker.js`
- `src/shared/messaging/service/SpotService.js`

Moved or renamed: None. Deleted: None.

## 6. Evidence and Validation

### Visible user journey

Method: normal in-app browser, fresh `http://127.0.0.1:8203/`, server rooted at
`/private/tmp/ufAIM-delivery1-receipt-reopen-0911` using
`python3 -m http.server 8203 --bind 127.0.0.1`. Physical file chosen through
`Daten hineinziehen` and the normal file chooser:
`/Users/uwefalz/Developer/ufAIM/test/samples/Landshut/W467-468.TRA`, SHA-256
`5053fe9fb13820fe662d9334a27410416305cf9bc39b7e4735e7be99cfcbce0a`.
The ignored local fixture was neither changed nor committed.

- `passed`: terminal import showed two candidates: an Alignment and a partial,
  non-promotable Cant finding. The Cockpit toggle exposed the import action;
  `Übernehmen & anzeigen` produced one selectable W467-468 object, visible Main
  geometry and the five-element signed-curvature band.
- `passed`: first-arc edit from the normal Cockpit element action, radius
  272.33 m (displayed derived radius) to entered 300 m. The draft showed
  `Nur Vorschau`; `Anwenden` ended with `Alignment neu berechnet`, radius 300 m,
  observed target/downstream changes and visible non-admissible AXTRAN evidence.
- `not run` to completion: import immediate acknowledgement and persistent busy
  observation. The file-chooser tool returned only after 1193.0464 seconds,
  despite its requested timeout. This is automation-control latency, not a
  measured application import duration. Apply also reached its terminal state
  before the next snapshot, so a persistent apply-busy interval was not observed.
- Therefore the complete policy-level visible user journey gate is NOT claimed
  passed. No synthetic state injection, E2E flag, controller invocation or reload
  substituted for importing the physical file.

### Durability/reopen

`passed` as a separately observed, scoped durability result, not an upgrade of
the incomplete primary import-progress gate: tab 24 was closed; tab 25 opened
the same origin normally, then `Vorhandene Objekte` → W467-468 → close list →
direct Main canvas click selected the first arc. No import or edit was repeated.

- Exact object ID before/after:
  `alignment_w467_468__src_acbd715c-6bdc-4372-b8b3-86f57fd69476_c7226c2d-78b7-4608-9b17-cc1455b76167`.
- Exact element: `el_0001`; revision: `2026-09-11T08:59:13.438Z`.
- Radius: 300; curvature: `0.0033333333333333335`; five source elements retained.
  Lengths: `41.51400218`, `0`, `19.67443926`, `0`, `41.5939144`.
  End intrinsic distance: `102.78235584000001`.
- Whole rendered receipt text compared exactly equal before close and after
  reopen using read-only DOM text, supplemented by scrolled visual inspection.
- Producer `alignment-axtran-evidence/0.3`; proposal `stationary`; objective
  `points`; fit `keep-plan`, sigma 5%; undetermined `el_0005`; `admissible=false`;
  iterations 13; end-pose residual `9.313225746154785e-10` m; derived-point RMS
  `4.989697485288865e-8`. These are solver evidence, not engineering approval.
- Selecting `el_0003` hid the receipt; returning to `el_0001` restored identical
  text. The reopened tab is left available as the demonstrated result.

### Regression and integration

`passed`: 72 tests, exit 0:

```sh
node --test test/services/alignment/*.test.mjs test/shared/messaging/*spot*.test.mjs test/shared/messaging/horizontal-receipt-durable-reopen.test.mjs test/shared/persistence/indexeddb-spot-state-adapter.test.mjs test/app/workspace/horizontal-realization-change-receipt*.test.mjs test/app/alignment-profile/alignment-radius-edit*.test.mjs
```

The new tests cover fresh-store hydration, preserved geometry/refs/extensions,
non-finite evidence preservation, exact context and stale/malformed/admissible
rejection, write failure, memory-only rejection, duplicate/conflict handling,
retained historical evidence, and queued-rename survival after receipt rollback.
Test doubles are regression evidence, not normal-browser acceptance.

`passed`: `git diff --check`; shared-checkout status/path overlap check showed
only the same foreign changes. `git push origin HEAD:refs/heads/main` advanced
remote main `89aa721..afffb80`, without force or shared-checkout integration.

## 7. Kernel and Architecture Impact

Kernel impact: none
Architecture impact: conforming
RefImpl impact: changed
Thesis impact: none

The existing App evidence stays non-authoritative and is persisted through the
existing shared object storage boundary. No IndexedDB version/store migration,
new geometry definition, source release or engineering admission is introduced.
The reference implementation now restores the exact saved consequence receipt.

## 8. Conflicts, Risks, and Open Decisions

- No new human decision or Kernel contradiction. Existing scoped App integration
  approval was used; foreign changes remain excluded.
- `RECEIPT-REOPEN-RISK-001`: full import-progress acceptance is still missing due
  to the blocked chooser call; do not present 1193 seconds as an App benchmark.
- `RECEIPT-REOPEN-RISK-002`: Cockpit appeared almost collapsed after import at
  the observed narrow viewport. Its normal toggle exposed the action, but the
  layout/accessibility mismatch and horizontal overflow remain unresolved.
- `RECEIPT-REOPEN-RISK-003`: geometry and evidence use successive durable writes.
  A crash/write failure between them preserves geometry but may leave no receipt;
  the live failure path is explicit. This is not an atomic geometry-plus-solver
  transaction. General stale full-object upserts across concurrent editors remain
  outside this bounded receipt command's compare/write protection.
- `RECEIPT-REOPEN-RISK-004`: historical receipt snapshots increase storage usage;
  there is no silent truncation or destructive migration.
- `RECEIPT-REOPEN-RISK-005`: no complete new Vertical/Cant/Chainage/q-local/section
  browser proof, no source approval, and no full-browser-process shutdown proof.
  The four unread Ril limits continue to require evidence-only/admissible=false.
- The shared checkout and localhost:8080 still do not automatically receive
  this origin/main change; the demonstrated isolated origin is port 8203.

## 9. Handover

Continue Delivery 1 with the existing 30-minute Rock heartbeat. Next safe work:
close the demonstrated normal-import action/progress gap, first checking whether
the Cockpit width/toggle mismatch is an App defect or browser-control artifact.
Use a fresh worktree from current `origin/main`; any App change must stay tied to
that visible gap. Candidate areas: existing import entry, Cockpit visibility and
layout, plus focused tests. Do not start a general UI redesign.

Done criterion: physical import initiated through normal controls immediately
acknowledges, remains visibly busy while active, ends truthfully, and exposes an
actually visible `Übernehmen & anzeigen` action without unexplained empty width;
the resulting Alignment, its radius consequences and preserved receipt remain
reachable. Then complete the still-open synchronized multi-domain evidence with
qualified source data. Separate read-only source research may proceed, but is
not a Delivery-1 substitute; Thesis/Viewer work is not authorized by this report.
