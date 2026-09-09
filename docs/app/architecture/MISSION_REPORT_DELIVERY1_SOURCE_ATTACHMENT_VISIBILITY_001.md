# MISSION REPORT

## 1. Mission

`APP-DELIVERY1-SOURCE-ATTACHMENT-VISIBILITY-001`, Stream `app`: source-declared LandXML/SCx-Profile-, Cant- und StaEquation-Daten exakt an das importierte Alignment binden und in der normalen Delivery-1-Browserfahrt gemeinsam mit Horizontalgeometrie, Radiusänderung, AXTRAN-Folgen, Speichern und verlustfreiem Wiederöffnen sichtbar machen.

## 2. Status

`complete` — das autorisierte Integrationsziel ist implementiert und am realen SCx-Beispiel sichtbar validiert. Der Merge in `main` bleibt ein separates Commit-/Merge-Gate.

## 3. Baseline and Scope

- Repository: `/Users/uwefalz/Developer/ufAIM`
- Isolierter Worktree: `/private/tmp/ufAIM-delivery1-profile-0909`
- Branch: `codex/delivery1-source-attachments-0909`
- Baseline: `origin/main` @ `54e41e8ac1d1df491bb9bc2358469c8acf4244b2`
- Scope: LandXML-Importaufbau, SPOT-Promotion/Readback, Alignment-Profile-Projektion, synchronisierte App-Controller und sichtbare Longitudinal-/Cant-Ansichten sowie zugehörige Tests.
- Ausgeschlossen und unverändert: `docs/knowledgeKernel/`, Thesis, IVHW, `technetViewer.html`, Viewer-Nebenarbeiten sowie der fremd geänderte gemeinsame Checkout. Es wurde dort nicht gepullt, gemergt, gestasht oder editiert.

## 4. Work Performed

- Der Alignment-Import führt source-declared `Profile`, `Cant`, `StaEquation`, Startstation, Länge, Einheiten und Quellenidentität in `import/source-declared-alignment-attachments/0.1` am exakt zugehörigen Alignment mit.
- Die SPOT-Promotion erhält diese Attachments verlustfrei und installiert `profileState` mit fail-closed erzeugter exakter Chainage-Abbildung. Inkonsistente oder unvollständige Station Equations werden nicht konstruktiv geraten.
- Repository- und Static-Reader transportieren die Source Attachments in denselben revisionsgebundenen Profil-Snapshot.
- Die gemeinsame Projektion liefert source-declared Vertical- und Cant-Stützstellen am intrinsischen Cursor ausschließlich als `evidence-only` und `admissible=false`; es findet keine Interpolation und keine erfundene Rail-Pair-Konstruktion statt.
- Longitudinal-, Cant-/Querschnitt- und Chainage-Ansichten zeigen denselben Cursor. Scalar Cant bleibt klar als unvollständige Evidenz mit `PAIRED_RAIL_CONSTRUCTION_NOT_AVAILABLE` und `pairedRails.status=unknown` markiert.
- Workspace-Rehydrate und Intelligence-Ansicht prüfen und zeigen die Source Attachments nach kanonischem SPOT-Readback.

## 5. Changed Files

Added:

- `test/app/import/source-declared-alignment-attachments.test.mjs`
- `docs/app/architecture/MISSION_REPORT_DELIVERY1_SOURCE_ATTACHMENT_VISIBILITY_001.md`

Modified:

- `app/controllers/alignment-profile/createCantCrossLevelViewController.js`
- `app/controllers/alignment-profile/createLongitudinalProfileController.js`
- `app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js`
- `app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js`
- `app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js`
- `app/view/alignment-profile/AlignmentCantCrossLevelView.js`
- `app/view/alignment-profile/AlignmentLongitudinalProfileView.js`
- `src/import/build/buildAlignmentImportOutcome.js`
- `src/import/build/buildImportResultFromParsed.js`
- `src/model/spot/mutate/promoteImportItems.js`
- `src/services/alignment/RepositoryAlignmentProfileStateReaderAdapter.js`
- `src/services/alignment/StaticAlignmentProfileStateReaderAdapter.js`
- `src/services/alignment/createSynchronizedAlignmentProfileProjection.js`

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- Focused plus dependent automated suite: `node --test test/app/import/source-declared-alignment-attachments.test.mjs test/app/workspace/promoted-alignment-workspace-journey.test.mjs test/app/alignment-profile/*.test.mjs test/services/alignment/*.test.mjs test/gnd-import-evidence.test.mjs` — `passed`, 325 tests, 0 failures.
- Whitespace/error scan: `git diff --check` — `passed`.
- Fresh browser origin: repository-root server `python3 -m http.server 8149` in the isolated worktree, URL `http://127.0.0.1:8149/` — `passed`; the origin had not loaded the pre-change modules.
- Real source import: `test/samples/SCx/SCx_1720.xml` — `passed`; UI reported 12 candidates, accepted `A101720R` was visible in the object workspace with 331 horizontal elements and exact source identity.
- Visible synchronized state on `A101720R` at shared `s=1000` — `passed`: 147 Vertical records, 52 Cant records, Longitudinal and Cant both `evidence-only · admissible=false`, Cant cross-section `pairedRails.status=unknown`, and evaluated Chainage address `1000.543023`.
- Visible radius/AXTRAN step — `passed`: `el_0005` was edited through the normal Alignment Editor to radius `6220`; the verified receipt showed target curvature `0.00016103059581320451 → 0.0001607717041800643`, downstream pose changes beginning with `el_0006`, and `AXTRAN2 consequence evidence · evidence-only · not an admissible engineering answer.`
- Save/reopen — `passed`: an independent fresh application page reopened the persisted object and read back radius `6220`, curvature `0.0001607717041800643`, the same source Vertical/Cant evidence and Chainage address `1000.543023`.
- Limitation: the real 331-element SCx radius application took approximately 10–17 seconds before all dependent views settled, and its exact downstream receipt is very large. This does not invalidate the readback but remains a responsiveness risk.

## 7. Kernel and Architecture Impact

Kernel impact: conforming — existing Alignment/Profile/Chainage/Cant contracts are used; source evidence is not promoted to an admitted constructive state and `docs/knowledgeKernel/` is unchanged.

Architecture impact: conforming — import, SPOT, application-service projection and App presentation remain separated; source association and fail-closed admission status cross those existing boundaries explicitly.

RefImpl impact: changed — imported source profile attachments now survive promotion/reopen and render in the synchronized Alignment workspace.

Thesis impact: none.

## 8. Conflicts, Risks, and Open Decisions

- No file overlap or conflict with the foreign Thesis-, technetViewer- or `.claude/` changes in the shared checkout.
- `RISK-APP-D1-ATTACH-001`: large imported alignments currently produce a slow radius-apply refresh and a very long exact downstream receipt. This is a bounded responsiveness/presentation risk; correctness and persistence readback passed.
- The four unread Ril-800.0110 limits remain outside this package. They correctly keep source Vertical/Cant and AXTRAN results `evidence-only` / `admissible=false` and do not block the visible journey.
- Open technical decisions: None.

## 9. Handover

Next safe step: review and merge the single local commit from `codex/delivery1-source-attachments-0909` into `main` after explicit Merge-Gate approval. It may touch only the files listed in section 5; `docs/knowledgeKernel/`, Thesis, IVHW, Viewer/technetViewer and the dirty shared checkout remain excluded. Another stream may proceed independently if it does not edit those files. Done criterion for the merge package: commit applies without overlap, the 325-test command and `git diff --check` remain green, and the SCx browser journey retains the exact radius, evidence-only labels, synchronized `s`, Chainage address and fresh-page readback described above.
