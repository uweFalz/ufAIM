# MISSION REPORT

## 1. Mission

`DELIVERY1-MAIN-LOCAL-PROJECTION-001`, responsible stream `app`, coordinated by Rock. Repair the demonstrated Main rendering/picking boundary for imported Landshut geometry; prove normal import, direct Main element selection, radius editing and the scoped geometry/identity reopen behavior. Continue Delivery 1 without changing source authority.

## 2. Status

`partial` — selectable Main primitives now share the local renderer origin, and the normal physical W467–468 import can be selected directly in Main before any edit. Radius 272.33 → 300 m and geometry/identity reopen were demonstrated. The full Delivery 1 journey is not complete: reopened AXTRAN evidence is still unavailable, source domain coverage remains partial, and import progress was not observed during the blocking file-chooser tool call. Delivery 1 remains ROT.

## 3. Baseline and Scope

- Repository `/Users/uwefalz/Developer/ufAIM`; fresh isolated worktree `/private/tmp/ufAIM-delivery1-main-projection-0911`.
- Branch `codex/delivery1-main-projection-local-0911` from `origin/main` at `c165b95d1f3d7f2ffa94eeb1ceb3e8883aa7d01c`. Worktree clean before editing; remote main checked before publication and still at that baseline.
- Implementation integrated into `origin/main` as `c8c6fab7fbd7c3834a469ab4d16bc62fc0b1da4e`, using existing scoped App push/merge authorization. No forced update.
- The shared checkout remains at `6c4477f64ac66ec9dffc493a73203b00d60a1f34`, with foreign Thesis source/bibliography/generated artifacts and `.claude/` changes. No pull, merge, stash, file edits or localhost:8080 replacement there.
- Scope: existing Three Main adapter, focused adapter regression and this report. Exclusions: import parsing, Kernel, source associations, AXTRAN solver, persistence schema, Thesis, technetViewer and new packages.

## 4. Work Performed

- Reproduced the predecessor's missing selectable Main geometry by normally reopening the saved W467–468 on port 8201. Its band and cursor existed, but no element boundaries were visible.
- Identified the inconsistent rendering boundary: `setTrackFromWorldPolyline` and markers applied `GeoTransform`, while `setAlignmentProjection` forwarded engineering-coordinate segment lines and boundary nodes unchanged. The viewer draws and hit-tests these primitives in local coordinates. Large source coordinates therefore placed those elements outside the local camera frame.
- The existing adapter now copies and converts the detailed projection's polyline, segment points/endpoints, boundary points, overall endpoints and bounding box/center with the same floating origin. Stable IDs, intrinsic stations and georeference evidence are retained. The input projection remains unmodified for engineering/geographic consumers.
- In the fresh normal-start browser, explicit import promotion exposes Main boundaries and element lines. Direct canvas picking opens `el_0001` and selects its curvature interval. A normal radius edit changes the displayed plan and produces existing evidence-only AXTRAN output. After closing the tab, the same persisted object/revision/radius can again be selected directly in Main.

## 5. Changed Files

Added:

- `docs/app/architecture/MISSION_REPORT_DELIVERY1_MAIN_LOCAL_PROJECTION_001.md`

Modified:

- `app/controllers/adapters/geo/ThreeMainViewControllerAdapter.js`
- `test/app/workspace/import-visible-tracks-three-adapter.test.mjs`

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

### visible user journey

Tested source root `/private/tmp/ufAIM-delivery1-main-projection-0911`; server `python3 -m http.server 8202 --bind 127.0.0.1`; previously unused origin `http://127.0.0.1:8202/`. The patched modules were first loaded from this origin. No E2E query, controller call, storage mutation, synthetic page state or event injection was used for acceptance.

Physical fixture `/Users/uwefalz/Developer/ufAIM/test/samples/Landshut/W467-468.TRA`; SHA-256 `5053fe9fb13820fe662d9334a27410416305cf9bc39b7e4735e7be99cfcbce0a`. Ignored local engineering input, not a newly versioned or published data file. This package reran one file, not the entire 81-file Landshut batch.

- Normal start → “Daten hineinziehen” → native multi-file chooser with the declared physical file → terminal two candidates: `passed` for the file/control path and terminal outcome. The alignment candidate is promotable; the separate Cant finding remains partial/not promotable. Immediate acknowledgement and persistent progress while the file tool was blocked: `not run` as visual observations. The roughly six-minute tool-call wall time is not an App latency measurement.
- “Übernehmen & anzeigen” → rendered Main boundary nodes, connecting element lines and five-element curvature band, before editing: `passed`, via accessibility text and screenshots. LOCAL/no EPSG claim remains explicit. Compacting the band with its normal button shows the whole local line; no camera/state injection was required.
- Direct canvas click on the first arc → editor `el_0001 · Bogen`, arc length `41.51400218`, curvature `0.0036719607435594394`, R `272.33 m`: `passed`. This directly closes the inability to pick the imported Main segment in this fixture.
- Radius input `300` → visible preview → “Anwenden” → disabled Apply observed during processing → “Alignment neu berechnet”: `passed`. Main and band reflect the change; source identity does not change. No newly introduced save button is claimed; Apply invokes the existing persisted edit path.
- Existing AXTRAN receipt after edit: `passed`, visible UI text and scrolled screenshot. Producer `alignment-axtran-evidence/0.3`, evidence-only, `Admissible false`, 13 iterations, end-pose residual `9.313225746154785e-10` m, derived-point RMS `4.989697485288865e-8`, undetermined length `el_0005`. These are displayed evidence, not engineering approval or a new solver validation.
- Shared Vertical/Cant/Chainage/q-local/cross-section completeness: `not run` as a newly repaired behavior. This display adapter does not qualify missing source associations.

Object identity: `alignment_w467_468__src_30fa09bb-7881-48b9-a84b-fde25df71edb_4c38552d-cf00-41ec-adb0-88dba9eac3e1`. Persisted revision after edit: `2026-09-11T07:43:21.129Z`. Sequence remains five elements; arc lengths `41.51400218`, `19.67443926`, `41.5939144`, with two zero-length immediate transitions. Post-edit intrinsic endpoint `102.78235584000001` m.

### durability/reopen

- Close the edited browser tab → new tab on the same origin → “Vorhandene Objekte” → W467–468 → close object list → direct Main click: `passed` for geometry visibility, picking and the scoped UI identity comparison. Exactly the object ID and revision above, `el_0001`, R `300 m` and curvature `0.0033333333333333335` were displayed again; the other two arc curvatures remained `0.0015915864237577909` and `-0.00033285343939512264`.
- Reopened AXTRAN receipt: `failed` for the full lossless user journey; editor shows “Kein verifizierter Konsequenzbeleg verfügbar.” This is the known predecessor gap, not fixed by origin conversion. No claim of lossless complete engineering-state reopen is made.
- Initial imported object's revision before editing remains `unknown`; no identity/revision migration is included.

### Regression and integration checks

- Added origin regression against the unpatched adapter: `failed` as expected, exposing engineering values `4510600/5379100` instead of local `-50/-20` in selectable geometry.
- Same regression after the adapter change: `passed`, including agreement with marker/base track, ID/station/georeference preservation, repeated origin changes without accumulated offsets, unchanged source input and null projection clearing.
- `node --test test/app/workspace/import-visible-tracks-three-adapter.test.mjs test/app/workspace/main-horizontal-projection-readback.test.mjs test/app/workspace/alignment-cross-view-element-selection.test.mjs test/app/workspace/import-curvature-band-intervals.test.mjs`: `passed`, 12 tests. Tests are regression evidence, not the visible acceptance substitute.
- `git diff --check`: `passed`.
- `git ls-remote origin refs/heads/main` before publication: `passed`, `c165b95d1f3d7f2ffa94eeb1ceb3e8883aa7d01c`.
- `git push origin HEAD:refs/heads/main`: `passed`, `c165b95..c8c6fab`, without touching the shared checkout. This report follows as a report-only commit.

## 7. Kernel and Architecture Impact

Kernel impact: none
Architecture impact: conforming
RefImpl impact: changed
Thesis impact: none

The established Main adapter now applies its existing documented floating-origin responsibility to selectable primitives as well as the base track/cursor. This is coordinate conversion for rendering/picking, not a CRS resolution, new architectural concept or canonical-state rewrite.

## 8. Conflicts, Risks, and Open Decisions

- `RISK-MAIN-LOCAL-001`: fixed local-origin mismatch is demonstrated on one physical alignment; the full 81-file batch and qualified geographic fixtures were not rerun. No broader acceptance is inferred.
- `RISK-MAIN-LOCAL-002`: import progress observations remain missing at the browser file-tool boundary; tool wait time must not be reported as App computation time.
- `RISK-LANDSHUT-002/003`: detached source profile/Cant findings and absent reopened consequence receipt remain open. Full Delivery 1 remains ROT, target 30 September 2026.
- `RISK-MAIN-LOCAL-003`: expanded band can obscure the line's last part at the tested viewport; the normal compact control reveals it. This package does not redesign layout, line styling or fit policy.
- No file overlap with another mission, irreversible migration or new Uwe decision was found. Existing evidence-only/admissible=false constraints remain binding.

## 9. Handover

Implementation is integrated on `origin/main` as `c8c6fab7fbd7c3834a469ab4d16bc62fc0b1da4e`; the tested runtime is `http://127.0.0.1:8202/`, not the dirty shared checkout's port 8080. Reopened browser tab is left as a partial user-facing proof, not a completed Delivery 1 demonstration.

Next safe work: inspect why the visible AXTRAN receipt is absent after normal reopen of this exact persisted edit; preserve the distinction between missing evidence presentation and missing persisted engineering state. Use a fresh current-main worktree and stay within the existing editor/persistence/evidence path. Source-domain association work remains separately bounded; do not infer pairing from file names or geometry. Thesis and Research may proceed within their own scopes but do not count as this delivery evidence.

Done criterion for the next reopen package: normal physical import → visible Main selection → radius edit → evidence-only/admissible=false consequence receipt → persisted Apply → tab close → normal object-list reopen, with the same object/revision/geometry and matching traceable consequence evidence. The separate complete cross-domain journey remains required for Delivery 1. The 30-minute Rock scheduler continues.
