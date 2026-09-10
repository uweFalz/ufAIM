# MISSION REPORT

## 1. Mission

`DELIVERY1-NEW-ALIGNMENT-START-001`, Stream `app`: den sichtbar belegten
Startblocker bei `Neues Alignment` beheben und den normalen Weg von der
expliziten Namenseingabe zur ersten lokalen Geraden und zum Wiederöffnen
nachweisen. Dieses Paket bearbeitet Delivery-1-Kriterien 1, 3 und 9 aus
`docs/DELIVERY_PLAN_2026_2027.md`; es ersetzt nicht den gesamten Delivery-Beweis.

## 2. Status

`complete` — der eingegrenzte Start-Fix ist implementiert, auf frischer
Browser-Origin sichtbar geprüft und mit `8ae5176acaa01fd5b773a8b43e509234b4226431`
nach `origin/main` integriert. Delivery 1 bleibt als Gesamtlieferung offen;
die halbstündliche Schichtführung läuft weiter.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM`.
- Isolierter Worktree: `/private/tmp/ufAIM-delivery1-runtime-0910`, ursprünglich
  frisch von `origin/main` @ `32378c4c19ed7f1cfc109c588863d24b75279e8d` angelegt.
- Branch: `codex/delivery1-new-alignment-start-0910`.
- Während der Mission rückte `origin/main` auf
  `03fa9db1be85bee5f1d8507da7e23de99eb1d523` vor. Die vier eingehenden Dateien
  betrafen AXTRAN2/SQP, Korpustests und die Korpusdokumentation; keine
  Überschneidung mit den sieben Paketdateien. Der lokale Fix wurde ohne
  Konflikt auf diesen Stand rebasiert und erneut geprüft.
- Der gemeinsame Checkout blieb auf
  `6c4477f64ac66ec9dffc493a73203b00d60a1f34`. Fremde Änderungen an
  `docs/thesis/AIM/applications/contribution*.tex`, `references.bib`,
  `main*`-Buildartefakten und `.claude/` wurden weder geändert noch gestasht.
- Scope: bestehende Startverdrahtung, GND-Workbench-Namensformular,
  zugehörige Regressionstests und dieser Bericht.
- Excluded: Knowledge Kernel, Thesis, technetViewer, neue UI-Pakete,
  Solveränderungen, Importadapteränderungen, Migration und Serverwechsel
  des gemeinsamen Checkouts.

## 4. Work Performed

- Belegter Fehler: Der Startknopf rief `createAlignment()` ohne Namen auf.
  Der produktive Dienst verlangte bereits einen expliziten Namen. Die
  Ablehnung blieb im geschlossenen Workbench-Bereich unsichtbar.
- Der Startknopf ruft nun `openCreation()` auf: kompaktes Formular öffnen,
  Namensfeld fokussieren, noch nichts speichern. Das Formular ist auch bei
  vorhandenen Objekten oder vorherigen Importergebnissen erreichbar.
- Leere und fehlende Namen führen zu einer sichtbaren Fehlermeldung und
  keinem Speicheraufruf. Erst der ausdrücklich eingegebene Name wird an den
  vorhandenen kanonischen Erzeugungsdienst übergeben. Bestehende
  Save-/Readback-/Aktivierungs- und Authoring-Wege bleiben unverändert.
- Pending-Anzeige und Duplikatsperre werden im gemeinsamen Formular
  wiederverwendet; keine Geometrie, Geschwindigkeit, Stationierung oder CRS
  wird als Default erfunden.
- Normaler Browserweg auf dem finalen Stand: Startkarte → `Neues Alignment`
  → `Delivery1-Neuanlage-final-0910` eingeben → `Neues Alignment anlegen`
  → leeres lokales Alignment → im Krümmungsband `+ Gerade`, Länge `200`
  → `Element hinzufügen` → sichtbare Gerade und flaches Krümmungsband.
- Nach Tab-Schließen und Neuöffnen auf derselben Origin: Startfläche
  `Vorhandene Objekte` → gespeicherten Namen auswählen → dieselbe
  Objekt-ID, Revision, Element-ID und Länge wieder sichtbar.
- Integration: `git push origin HEAD:main` bestätigte den Fast-Forward
  `03fa9db..8ae5176`. Kein Pull, Merge oder Stash im gemeinsamen Checkout.

## 5. Changed Files

Added:

- `docs/app/architecture/MISSION_REPORT_DELIVERY1_NEW_ALIGNMENT_START_001.md`

Modified:

- `app/gndImportWorkbench/gndImportWorkbenchController.js`
- `app/gndImportWorkbench/gndImportWorkbenchView.js`
- `app/runtime/init/initFeatures.js`
- `test/app/import/data-drop-visible-import-journey.test.mjs`
- `test/app/workspace/new-alignment-start-to-canvas-boundary.test.mjs`
- `test/app/workspace/new-alignment-start-to-canvas-visible.test.mjs`
- `test/app/workspace/new-alignment-start-to-canvas.test.mjs`

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- Baseline reproduction — method: normale Startseite auf
  `http://127.0.0.1:8196/`, Root des isolierten Worktrees,
  `32378c4`, sichtbarer Klick auf `Neues Alignment`; result: `failed`;
  kein sichtbarer Erzeugungsweg. Der Quellvergleich belegt den fehlenden
  Namensparameter; der Browserfehler war nicht durch einen Test-Harness erzeugt.
- Fresh-origin hygiene — method: erster Fix auf neuer Origin
  `http://127.0.0.1:8197/`; nach Rebase eigener Repository-Root-Server
  `python3 -m http.server 8198 --bind 127.0.0.1` und neuer Tab auf
  `http://127.0.0.1:8198/`, Code `8ae5176`; result: `passed`;
  limitation: lokaler statischer Server, kein Produktions-Deployment.
- `visible user journey` — method: normale sichtbare Controls, expliziter
  Name, Erzeugen und Hinzufügen einer 200-m-Geraden; DOM-Snapshots und
  Screenshots; result: `passed`. Sofortige Bestätigung: fokussiertes
  Namensformular. Terminale Meldungen: `Natives lokales Alignment erzeugt.`
  und `Alignment aktualisiert.`. Sichtbar: Main mit lokaler Gerade,
  Krümmungsband mit einem Gerade-Element, Cockpit mit `Laenge 200`,
  `LOCAL · engineering` und `local map · no EPSG claim`.
  Limitation: Die kurze Speicheroperation war zwischen den Browseraufnahmen
  bereits abgeschlossen; die Pending-Dauer wurde nicht visuell vermessen.
  Der dauerhaft an die offene Promise gebundene Busy-/Duplikatschutz ist
  separat durch Controller-/Viewtests belegt, nicht als beobachteter
  Langläufer ausgegeben.
- `durability/reopen` — method: erst nach bestandenem Primärweg Tab schließen,
  neue App-Instanz derselben Origin, sichtbarer Startknopf
  `Vorhandene Objekte`, Namen auswählen, Objektbereich schließen;
  result: `passed`. Identisch vor/nach Reopen:
  `alignment_mtvycu11_7ykc94`, Revision `2026-09-10T20:01:04.224Z`,
  `straight_mtvyd140_r080vj`, Name `Delivery1-Neuanlage-final-0910`,
  ein Gerade-Element mit Länge `200`. Main-Screenshot zeigt wieder lokale
  Geometrie und κ=0; Cockpit bestätigt Länge. Limitation: browserlokale
  Persistenz und genau dieser einfache konstruktive Zustand, keine
  Mehrbenutzer- oder allgemeine Serialisierungsprüfung.
- Startzugang mit bereits gespeichertem Objekt — method: auf Origin 8197
  erneut `Neues Alignment` öffnen und ohne Speichern schließen;
  result: `passed`; Namensformular bleibt erreichbar, keine zusätzliche
  Neuanlage. Zusätzlicher Viewtest deckt vorherige Importergebnisse ab.
- Testumgebungs-Abgrenzung — method: zunächst wirkungslos erscheinende
  AX-Klicks auf `Vorhandene Objekte` mit normalem Playwright-DOM-Klick
  gegenprüfen; result: `passed` für den Produktzugang, auch auf frischer
  finaler Origin 8198. Kein reproduzierter Produktfehler und keine Änderung
  an diesem Zugang. Die anfängliche Verdachtsmeldung ist damit zurückgenommen.
- Regression — command:
  `node --test test/app/workspace/new-alignment-start-to-canvas.test.mjs test/app/workspace/new-alignment-start-to-canvas-visible.test.mjs test/app/workspace/new-alignment-start-to-canvas-boundary.test.mjs test/app/import/data-drop-visible-import-journey.test.mjs`;
  result: `passed`, 22 Tests, 0 Fehler auf `8ae5176`; limitation:
  gezielte Regression, kein vollständiger Repository-Testlauf.
- Browser diagnostics — method: Warn-/Fehlerlogs im finalen Reopen-Tab;
  result: `passed`, keine erfassten Warnungen/Fehler; limitation:
  diese Sitzung, kein Langzeitmonitoring.
- Diff und Integration — method: `git diff --check`, explizit gestagte
  sieben Dateien, Überschneidungsprüfung und Fast-Forward-Push;
  result: `passed`; keine fremden Dateien im Code-Commit.
- Gesamte Import-/Radius-/AXTRAN-/Fachsichtenfahrt — result: `not run` in
  diesem Paket; vorhandener scoped Beleg bleibt
  `docs/app/architecture/MISSION_REPORT_DELIVERY1_POST_MERGE_PRODUCT_PROOF_001.md`
  aus `54d3af0`. Er wird nicht auf diesen neuen Stand oder auf vollständige
  Fachzulassung ausgedehnt.

## 7. Kernel and Architecture Impact

Kernel impact: none

Architecture impact: conforming

RefImpl impact: changed

Thesis impact: none

Die bestehende UI-Orchestrierung delegiert weiterhin an denselben kanonischen
Erzeugungsdienst. Die Änderung macht dessen bereits bestehenden expliziten
Namensvertrag vom Start aus bedienbar. Keine neue fachliche Identität,
Architekturgrenze oder Zulassungsregel wurde eingeführt.

## 8. Conflicts, Risks, and Open Decisions

- Kein Dateikonflikt, keine neue fachliche Entscheidung, keine Migration.
- `D1-START-RISK-001`: Der laufende Python-Server auf Port 8080 (PID 1026)
  bedient weiterhin den gemeinsamen Checkout `6c4477f`. Ein Reload dort
  liefert diesen Fix nicht. Der isolierte aktuelle Prüfstand läuft auf
  Port 8198; der Benutzer-Server wurde weder beendet noch umgebogen.
- `D1-START-RISK-002`: Speicherstände sind originspezifisch. Der Wechsel
  von 8080 zu 8198 ist keine Migration bestehender Browserdaten.
- `D1-START-RISK-003`: Dieser Nachweis umfasst nur Neuanlage und Gerade.
  Die vollständige Delivery-1-Abdeckung, insbesondere initialer
  Querschnitt und qualifizierte Fachzustände, bleibt getrennt zu bewerten.
  Vier ungelesene Ril-800.0110-Grenzen und bestehende
  `evidence-only/admissible=false`-Beschränkungen bleiben unverändert.
- Der frühere Vorschlag im Post-Merge-Bericht, nach einer Beweisetappe die
  Schichtführung zu beenden, ist durch Uwes Neustartauftrag und den aktuellen
  Scheduler-Auftrag überholt. Diese Mission deaktiviert den Scheduler nicht.

## 9. Handover

Nächster sicherer Schritt: die verbleibende Delivery-1-Abdeckung und den
tatsächlich ausgelieferten lokalen Runtime-Stand gegen die Lieferkriterien
prüfen. Nicht nochmals das funktionierende Namensformular reparieren oder
die gesamte Importfahrt ohne relevante Änderung wiederholen.

Für den integrierten Start-Fix kann `http://127.0.0.1:8198/` verwendet werden,
solange dessen isolierter Server läuft. Ein Wechsel der bestehenden
8080-Laufzeit braucht eine explizite, datenschonende Runtime-Übergabe;
fremde Checkout-Dateien und originspezifische Speicherstände müssen erhalten
bleiben. Möglicher nächster Scope: lokale Serverzuordnung und getrennte
Delivery-Prüfberichte, nicht Thesis oder Knowledge Kernel.

Done-Kriterium dieser Runtime-Übergabe: die dem Nutzer genannte stabile URL
liefert nachweisbar den integrierten Commit, Start/Neuanlage/Objektauswahl
sind sichtbar bedienbar, und vorhandene Speicherstände werden weder gelöscht
noch still als migriert behauptet. Andere Streams können innerhalb ihrer
eigenen Ownership unabhängig weiterarbeiten. Die Schichtführung bleibt im
30-Minuten-Takt aktiv; routinemäßige unveränderte Ergebnisse bleiben still.
