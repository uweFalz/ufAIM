# MISSION REPORT

## 1. Mission

`APP-DBB-VIEWER-INTEGRATION-002`, Stream `app`, 19.09.2026. Auf Uwes „dann los“ den vorbereiteten DBB-Adapter an die vollständige bestehende GND-Importkette anschließen und einen aufrufbaren lokalen Stand bereitstellen.

## 2. Status

`partial` — Der eigenständige Viewer verarbeitet DBB jetzt über seine vorhandene MDB/GND-Auswertung einschließlich Profilen, Überhöhung und vorhandenen Stationsgleichungen. Alle fünf lokalen DBB/MDB-Paare stimmen im ausführbaren Viewer-Importcode überein. HTTP-Laufzeit bereit; sichtbarer physischer Browserimport und Wiederöffnen noch nicht abgenommen. Kein Push, kein Main-Merge, kein Austausch des 8080-Servers.

## 3. Baseline and Scope

Repository `/Users/uwefalz/Developer/ufAIM`; Fortsetzung im eigens für DBB von `origin/main` angelegten Worktree `/private/tmp/ufaim-dbb-20260919-gQfMRP`, Branch `codex/dbb-gnd-import-20260919`, Basis `6ab2763cc654e8445ae491b46734ffabc50cd514`.

Vorhandener eigener DBB-Adapter: Bericht `docs/app/architecture/MISSION_REPORT_DBB_GND_IMPORT_001.md` und seine sieben Code-/Testdateien, zuvor uncommittet. Diese Arbeit wurde erhalten, nicht neu erfunden. Neu im Umfang dieser Fortsetzung: eng begrenzter Anschluss in `technetViewer.html`, reproduzierbares Einbetten und Integrationstest. Abschließende Überschneidungsprüfung im gemeinsamen Checkout: HEAD/origin unverändert; keine uncommittierten Änderungen in `technetViewer.html` oder `src/import/`. Fremde Thesis-, Bibliographie-, Build-, `.claude`-, PUML-/Tooling- und Berichtsänderungen blieben unberührt. Kein Pull, Stash oder Merge.

Ausgeschlossen: Änderungen der fachlichen Viewer-Auswertung, Übertragung ihrer heuristischen Zuordnung in den AIM-Core, Kernel, Thesis, neue fachliche Freigabe, Umbau der gesamten Viewer-Bündelung.

## 4. Work Performed

- Belegten Anschlussfehler beseitigt: Der eigenständige Viewer enthält eine eigene Parserregistrierung und eine Dateityp-Liste; beide kannten DBB nicht. `.dbb` ist nun für Datei-, Ordner- und ZIP-Eingang zugelassen und wird unter der kompatiblen Kennung `gndEdit` verarbeitet.
- Der gemeinsame `extractGndDbb` und `parseGND_DBB` werden unverändert in einen abgegrenzten, generierten Block eingebettet. Dieser ruft die bereits vorhandene Viewer-Funktion `parseGNDSourceEnvelope` auf. Keine zweite DBB-Geometrie-/Zuordnungslogik und keine zusätzliche Laufzeitabhängigkeit; die Ein-Datei-Eigenschaft bleibt bestehen.
- `tools/sync-technet-dbb.mjs --write` regeneriert ausschließlich diesen Block. Der Aufruf ohne `--write` prüft die Synchronität. Andere Viewer-Funktionen bleiben erhalten.
- Quellbackend ist `dbb` beziehungsweise `mdb`, nicht fälschlich pauschal `xlsx`. `gndSequence`, PAD-Kontext, externe Stationen, interne Längen und die bestehende Einheitenbehandlung werden durch denselben Viewer-Pfad geführt.
- Vier Paare liefern je `alignment, alignment, profile, cant` und zwei `stationReference`-Kandidaten. `4760_48-65_DA0-V00` liefert vier Alignments, zwei `staEq`, ein Profil, eine Überhöhung und zwei `stationReference`-Kandidaten. Überhöhung trägt `unit="meter"`; die Beziehungen bleiben `accepted=false`.
- Lokaler Server aus dem isolierten Worktree auf `127.0.0.1:8226`, PID 24516. Einstieg: `http://127.0.0.1:8226/technetViewer.html`. Der vorhandene Prozess auf 8080 wurde weder beendet noch umgestellt.

## 5. Changed Files

Added in dieser Fortsetzung:

- `tools/sync-technet-dbb.mjs`
- `test/technet-viewer-dbb.test.mjs`
- `docs/app/architecture/MISSION_REPORT_DBB_VIEWER_INTEGRATION_002.md`

Modified in dieser Fortsetzung:

- `technetViewer.html`

Moved or renamed: None. Deleted: None.

Mitgeführter eigener Adapter aus Paket 001, unverändert in dieser Fortsetzung: Added `src/import/parsers/technet/gndEdit/gnd/extractGndDbb.js`, `src/import/parsers/technet/gndEdit/parseGND_DBB.js`, `test/gnd-dbb-import.test.mjs`, `docs/app/architecture/MISSION_REPORT_DBB_GND_IMPORT_001.md`; Modified `src/import/parsers/technet/gndEdit/index.js`, `src/import/parsers/technet/gndEdit/parseGND_XLSX.js`, `src/import/parsers/technet/gndEdit/gnd/validateGndSourceEnvelope.js`, `src/import/build/buildAlignmentImportOutcome.js`.

## 6. Evidence and Validation

Node `v24.10.0`, Befehle im isolierten Worktree:

- `UFAIM_DBB_SAMPLE_DIR=/Users/uwefalz/Developer/ufAIM/test/samples/Brenzbahn node --test test/gnd-dbb-import.test.mjs test/technet-viewer-dbb.test.mjs` — `passed`, 21 Tests, keine Skips. Die fünf genannten DBBs und jeweils gleichnamige MDB: `4760_2-3_DA0-V00`, `4760_5-7_DA0-V00`, `4760_10-16_DA0-V00`, `4760_38,8-46,0_DR0-R00`, `4760_48-65_DA0-V00`. Gleiche Item-Identitäten/-arten, Geometrien, Profil-/Cant-Punkte, Stationsgleichungen, Einheiten, Familien-/Strecken-/Richtungs-/Systemkontexte, Relationsziele und Status. Abgeleitete numerische Werte mit absoluter Toleranz `0.00002`; Rohfelder im Adaptertest innerhalb ihrer Druckgenauigkeit.
- `node --test test/technet-viewer-dbb.test.mjs` ohne Privatpfad — `passed`, drei öffentliche Tests; fünf private Paarprüfungen ausdrücklich übersprungen. Positiver synthetischer Import prüft die vollständige Profil-/Cant-Verknüpfung ohne private Rohdaten.
- Der Integrationstest führt den tatsächlichen eingebetteten Importcode im Node-VM aus. Ausschließlich der MDB-Browser-Workertransport wird durch den produktiven MDB-Extractor mit `mdb-reader` ersetzt. Kein DOM, keine Dateiauswahl, kein sichtbarer Nachweis.
- `node tools/sync-technet-dbb.mjs` — `passed`; eingebetteter Decoder entspricht den gemeinsamen Quellen. Syntaxprüfung des unveränderten Browser-Importbundles ebenfalls `passed`.
- `git diff --check` — `passed` nach Korrektur ausschließlich generierter Einrückung.
- Lokaler HTTP-Abruf — `passed`, Status 200, ausgelieferte Datei bytegleich mit dem Worktree. SHA-256: `fcbcaadd9fa9fc5a607861e4d307f7bf689bcae51be9bad00a842a7f6bfbb8c8`.
- `visible user journey` — `not run`. Die Bestätigung für einen erneuten Versuch nach dem zuvor dokumentierten gesperrten Mac wurde während der Integration angefragt; bis zum Bericht keine Antwort. Keine Sicherheits-/Zugriffsumgehung. HTTP und VM-Tests ersetzen den physischen Datei-Picker-/Drop-Nachweis nicht.
- `durability/reopen` — `not run`.

## 7. Kernel and Architecture Impact

Kernel impact: none

Architecture impact: conforming — weiterer Quelladapter in der bestehenden GND-Kette, keine neue fachliche Interpretation.

RefImpl impact: changed — DBB ist im eigenständigen Viewer erreichbar und auf einem lokalen Origin bereitgestellt.

Thesis impact: none

## 8. Conflicts, Risks, and Open Decisions

- `DBB-002-GATE-1`: Sichtbare Abnahme offen. Der Codevergleich belegt keine gerenderte Ansicht und keine Persistenz.
- `DBB-002-GATE-2`: Integrationsbranch ist nicht Main und nicht der bestehende Server auf 8080. Kein Push/Main-Merge ohne Prüfung des dann aktuellen Zielstands und passende Freigabe.
- `DBB-002-R1`: Die bestehende Viewer-Auswertung und der gemeinsame AIM-Source-Parser bleiben unterschiedlich. Dieser Anschluss überträgt keine Viewer-Heuristik in den Core und schließt die vollständige AIM-Delivery-Reise nicht ab.
- `DBB-002-R2`: Gleichheit mit MDB ist keine unabhängige fachliche Bestätigung der vorhandenen Viewer-Zuordnungen. Insbesondere vorhandene PAD-/Überlappungsheuristiken, nicht vollständig dekodierte Stationsadressen und nullable HSYS-Felder werden nicht nachträglich als bewiesene Engineering-Identität ausgegeben. Keine fachliche Zulassung erteilt; vorhandene Prüfgrenzen bleiben bestehen.
- `DBB-002-R3`: DBB bleibt auf den belegten AGON-v6-ASCII-Dialekt begrenzt. Andere Satzarten/Versionen werden explizit abgelehnt.
- Keine neuen Kernel- oder mathematischen Entscheidungen angefordert. Gemeinsamer Checkout und parallele Arbeit nicht verändert.

## 9. Handover

Aufrufbarer Stand: `http://127.0.0.1:8226/technetViewer.html`, Serverwurzel `/private/tmp/ufaim-dbb-20260919-gQfMRP`. Zuerst `4760_2-3_DA0-V00.DBB` über den normalen Datei-Picker laden: erwarteter Codevertrag sind zwei Lageobjekte, ein Profil, eine Überhöhung und zwei Stationsbeziehungen. Danach dieselbe Reise mit der gleichnamigen MDB vergleichen, zusätzlich das Paar 48–65 für die vorhandenen Stationsgleichungen prüfen.

Voraussetzung ist bestätigter Browserzugriff. Done-Kriterium bleibt eine sichtbare normale Reise mit Fortschritt, ehrlichem Endstatus, auswählbaren Objekten, passenden Lage-/Profil-/Cant-Ansichten, nachvollziehbaren Verknüpfungen und gesondertem Wiederöffnungsnachweis. Erst danach darf die Browserabnahme behauptet werden. Für die Main-Integration nur die hier und in Paket 001 genannten eigenen Dateien übernehmen; kein Shared-Checkout-Merge über fremde Änderungen. Viewer- und AIM-Fortschritt getrennt ausweisen.
