# MISSION REPORT

## 1. Mission

Mission `APP-DELIVERY1-VERMESN-IMPORT-VISIBILITY-001`, Stream `app`: Den Delivery-1-Importpfad so reparieren, dass physische vermEsn-Importkandidaten ohne GND-Result-Evidence nicht nach erfolgreichem Parsing verschwinden, sondern im normalen AIM-Arbeitsraum sichtbar, übernehmbar und anschließend als Alignment-Objekt auffindbar sind. Package identifier: `DELIVERY1-VERMESN-IMPORT-VISIBILITY-001`.

## 2. Status

`complete` — Der autorisierte Import-Sichtbarkeitsfehler ist behoben und mit einer realen Landshut-TRA-Datei im Browser validiert. Delivery 1 als Ganzes bleibt bis zum ununterbrochenen sichtbaren Nachweis der vollständigen Nutzerreise `ROT`.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM`
- Isolierter Arbeitsbaum: `/Users/uwefalz/Developer/ufAIM-delivery1-recovery-0908`
- Branch: `codex/delivery1-recovery-0908`
- Baseline bei Erstellung des Arbeitsbaums: `origin/main` @ `5f6241d`
- Vorhandene, in diesen Arbeitsbaum übernommene Delivery-1-App-Bausteine: `bc54984`, `a104d7e`, `b7d2b11`, `2d114aa`, `bf01aa4`, `4dcab40`
- Autorisierter Scope: Import-Commit-Handoff, Darstellung unpromoteter Importgeometrie, lokale Ansicht ohne behauptete Georeferenz sowie zugehörige App-/Service-Tests.
- Excluded: `docs/knowledgeKernel/`, Thesis, `technetViewer.html`, IVHW, AXTRAN2-Kernarbeit, fremde `.claude/`- und Build-Artefakte.
- Der gemeinsame Checkout enthielt fremde Thesis-, PDF-, Bibliografie-, `technetViewer.html`- und `.claude/`-Änderungen; er wurde weder gepullt, gemergt, gestasht noch verändert.
- Während der Mission rückte `origin/main` auf `3f303d8` vor. Die Überschneidungsprüfung `git diff --name-only 5f6241d..origin/main` zeigte ausschließlich AXTRAN2-Dateien und keine Überschneidung mit diesem Paket.

## 4. Work Performed

- Ursache behoben: `app/controllers/importController.js` sendet `Import.CommitJob` nun auch für geparste Kandidaten ohne GND-Publikation. Eine fehlende GND-Evidence bleibt dabei wahrheitsgemäß fehlend.
- `src/shared/messaging/service/ImportSessionService.js` akzeptiert nicht-GND-Kandidaten mit gültigen Item-Arrays, validiert sie weiterhin fail-closed und qualifiziert quelllokale IDs mit Batch und Job. Dadurch kollidieren wiederholte Parser-IDs aus mehreren Dateien nicht.
- Fehlerhafte vorhandene Publication-Objekte bleiben unzulässig; GND-Evidence-Verträge wurden nicht aufgeweicht oder simuliert.
- Noch nicht übernommene Importgeometrie wird anhand ihrer Bounding Box in einer lokalen Three-Ansicht gefittet. Der geografische Kartenstart weicht nur für tatsächlich vorhandene lokale Importgeometrie und behauptet keine EPSG-Lage.
- Der Three-Adapter reicht Track-Stile durch. Physische Importtracks werden klar türkis, deckend und über dem lokalen Raster dargestellt.
- Nach `Übernehmen & anzeigen` erscheint das Alignment im aktiven Arbeitskontext und in der Objektliste.

## 5. Changed Files

Added:

- `test/app/workspace/import-visible-tracks-three-adapter.test.mjs`
- `docs/app/architecture/MISSION_REPORT_DELIVERY1_VERMESN_IMPORT_VISIBILITY_001.md`

Modified:

- `app/controllers/adapters/geo/ThreeMainViewControllerAdapter.js`
- `app/controllers/importController.js`
- `app/controllers/viewAuxTracks.js`
- `app/controllers/viewController.js`
- `src/shared/messaging/service/ImportSessionService.js`
- `test/app/workspace/alignment-workspace-map-start-visible.test.mjs`
- `test/gnd-import-evidence.test.mjs`
- `test/import/import-job.test.mjs`

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- JavaScript-Syntaxprüfung: `node --check` für alle fünf geänderten Produktionsmodule; result: `passed`.
- Fokussierte Regression: `node --test test/app/workspace/import-visible-tracks-three-adapter.test.mjs test/app/workspace/alignment-workspace-map-start-visible.test.mjs test/app/workspace/alignment-bim-workspace.test.mjs test/gnd-import-evidence.test.mjs test/import/import-job.test.mjs`; result: `passed`, 31/31 Tests, 0 failed.
- Import-Service-Vertrag: Tests belegen die Beibehaltung nicht-GND-basierter Kandidaten ohne erfundene Result-Evidence, eindeutige Quell-ID-Qualifizierung und unveränderte Ablehnung fehlerhafter Publications; result: `passed`.
- Browser-Akzeptanz auf frischem Origin: Repository-root server `/Users/uwefalz/Developer/ufAIM-delivery1-recovery-0908`, Port `8130`, URL `http://localhost:8130/`; reale Quelle `/Users/uwefalz/Developer/ufAIM/test/samples/Landshut/W467-468.TRA`; result: `passed`. Beobachtet wurden `2 Kandidaten`, sichtbare türkisfarbene Importgeometrie, Badge `LOCAL`, Übernahme von `W467-468`, aktiver Arbeitskontext mit `5` Elementen und danach `1 Objekte` in der Objektliste.
- Browser-Wahrhaftigkeit: Badge-Tooltip `Importgeometrie · lokales Koordinatensystem · keine EPSG-Aussage`; result: `passed`. Für die vermEsn-Datei wurde keine GND-Evidence erzeugt.
- Whitespace-/Patchprüfung: `git diff --check`; result: `passed`.
- Limitierung: Der Browser-Nachweis verwendete die repräsentative reale Datei `W467-468.TRA`, nicht erneut den gesamten Ordner mit 81 Dateien. Der Mehrdatei-/ID-Kollisionspfad ist durch Service-Regressionstests abgedeckt; ein vollständiger 81-Dateien-Durchlauf bleibt Bestandteil der Delivery-1-Endfahrt.
- Erweiterter Workspace-/Import-Glob-Lauf: result: `failed` wegen einer bereits fehlenden `mdb-reader`-Runtime-Datei und vorbestehender Quelltext-Vertragsassertionen außerhalb dieses Reparaturpakets; er wurde nicht als Akzeptanzsignal verwendet. Die fokussierte betroffene Suite ist vollständig grün.

## 7. Kernel and Architecture Impact

Kernel impact: none

Architecture impact: conforming — Die bestehende Trennung zwischen Importkandidaten und evidenzgestützter GND-Publikation bleibt erhalten; dieses Paket korrigiert nur den Reference-Application-Handoff und die Darstellung.

RefImpl impact: changed — Nicht-GND-Importkandidaten werden nun behalten, sichtbar dargestellt, übernommen und als Alignment-Objekte geführt.

Thesis impact: none

## 8. Conflicts, Risks, and Open Decisions

- `RISK-D1-VIS-001`: Der vollständige Landshut-Ordner mit 81 Dateien und 163 gemeldeten Kandidaten wurde nach der Reparatur noch nicht als kompletter Browserlauf wiederholt.
- `RISK-D1-VIS-002`: `origin/main` ist seit der Arbeitsbaum-Baseline auf `3f303d8` vorgerückt. Vor Integration ist ein kontrollierter Rebase-/Merge-Abgleich erforderlich; die derzeit eingegangenen AXTRAN2-Dateien überlappen dieses Paket nicht.
- `RISK-D1-VIS-003`: Die erweiterte Testmenge enthält vorbestehende Umgebungs-/Vertragsfehler; diese dürfen die fokussierten grünen Importtests nicht verdecken, müssen aber vor einem globalen Release-Gate getrennt bewertet werden.
- Open decisions: None.

## 9. Handover

Nächster sicherer Schritt ist die vollständige Delivery-1-Browserfahrt mit dem gesamten versionierten Landshut-Datensatz: importieren, sichtbares Alignment auswählen, Radius ändern, AXTRAN-Folgen sichtbar prüfen, Horizontal-/Vertical-/Cant-/Chainage-/Querschnittsansichten synchron prüfen, speichern, schließen und verlustfrei wiederöffnen. Voraussetzung ist die kontrollierte Integration dieses Branches auf den dann aktuellen `origin/main` ohne Vereinnahmung des schmutzigen gemeinsamen Checkouts. Berührt werden dürfen nur die Delivery-1-App-/Testpfade und das zugehörige Missionsprotokoll; Thesis, `technetViewer.html`, IVHW und `docs/knowledgeKernel/` bleiben ausgeschlossen. Der Thesis-Stream kann unabhängig fortfahren. Done-Kriterium des Folgepakets: Eine ununterbrochene normale Browser-Nutzerreise mit allen 81 Landshut-Dateien zeigt mindestens ein übernommenes Alignment, eine sichtbare Radiusänderung samt klar als `evidence-only/admissible=false` markierten AXTRAN-Folgen, synchronisierte Fachansichten und identischen Zustand nach Schließen/Wiederöffnen.
