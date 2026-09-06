# MISSION REPORT

## 1. Mission

Mission `APP-DELIVERY1-MAP-STAGE-005`, stream `app`: replace the empty LOCAL technical canvas with a visible, interactive map stage while preserving fail-closed project georeference claims.

## 2. Status

`complete`

The normal empty AIM start visibly opens on a Germany-scale map. No project coordinate system or qualified geographic placement is claimed before import evidence exists.

## 3. Baseline and Scope

- Repository root: `/private/tmp/ufAIM-delivery1-map-stage`
- Branch: `codex/delivery1-map-stage`
- Baseline: fresh `origin/main` at `621ba4d`
- Authorized scope: empty Workspace map activation, MapLibre loading repair, initial map composition, focused regression evidence, mission report
- Excluded: shared checkout, Viewer/technetViewer, Thesis, `.claude/`, `docs/knowledgeKernel/`, geolocation permission, AXTRAN, import semantics, persistence, and new packages

## 4. Work Performed

- Activated the existing MapLibre adapter when the Workspace has no active object.
- Added a distinct `MAP` start state and `map-context` readback instead of making a `GEO` or EPSG claim.
- Centered the neutral start map at Germany scale without requesting or fabricating user location.
- Cleared former geographic primitives before presenting the neutral start map.
- Repaired the existing MapLibre import-map target to use its ESM distribution and loaded the matching stylesheet.
- Restyled the start content as subordinate map controls so the spatial stage remains visible and interactive.
- Preserved the existing qualified-georeference transition for imported Alignments and the LOCAL fallback when map activation fails.

## 5. Changed Files

Modified:

- `app/controllers/viewController.js`
- `app/controllers/adapters/geo/MapLibreThreeAdapter.js`
- `app/styles/app.css`
- `config/importmap.external.json`
- `index.html`

Added:

- `test/app/workspace/alignment-workspace-map-start-visible.test.mjs`
- `docs/app/architecture/MISSION_REPORT_DELIVERY1_MAP_STAGE_005.md`

Moved, renamed, or deleted: none.

## 6. Evidence and Validation

- Browser acceptance on a fresh server at `http://localhost:8140/`: visible Germany map, full `1280 × 720` MapLibre canvas, `MAP` badge, `is-spatial-start` stage, closed Import Workbench, and zero-width Cockpit.
- Browser title evidence: `Wo soll deine Trassierung entstehen?`; the rejected phrase is absent.
- Geographic claim evidence: badge title is `Startkarte · noch ohne Projektgeoreferenz`; no geolocation permission was requested.
- Focused Delivery-1, import, coordinated-camera, and georeference suite: passed, 37/37.
- JavaScript syntax and `git diff --check`: passed.

## 7. Kernel and Architecture Impact

Kernel impact: none

Architecture impact: conforming

The existing MapLibre adapter and existing geographic qualification authority remain authoritative. The new state is presentation-only map context and cannot qualify imported engineering geometry.

RefImpl impact: changed

Thesis impact: none

## 8. Conflicts, Risks, and Open Decisions

- The start basemap uses the existing remote MapLibre demo style and therefore requires network access.
- Map labels follow the demo style language; localization is not part of this gate.
- Imported geometry without qualified CRS evidence correctly returns to the LOCAL engineering view rather than being placed on the basemap.
- Delivery 1 remains RED: the complete import → edit → AXTRAN → synchronized views → save → reopen journey is not yet visibly proven.

## 9. Handover

Publish the isolated package to `origin/main`, restart the canonical `localhost:8080` server from that worktree, then continue with the physical import visibility package. Done criterion met for this stage: AIM opens on a real map without an automatic tool overlay, without a dominant Cockpit, and without a false project-georeference claim.
