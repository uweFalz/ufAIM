# MISSION REPORT

## 1. Mission

`APP-DBB-GND-IMPORT-001`, Stream `app`, 19.09.2026. Einen ersten DBB-Eingang für die bestehende GND-Verarbeitung bereitstellen und Uwes drei Anschlussbedingungen prüfen: Objekt-/Sequenzkontext, kompatible Parser-Kennung sowie Einheiten und PAD-basierte Beziehungen. Die fünf bereitgestellten Brenzbahn-DBBs mit den zugehörigen lokalen MDBs vergleichen.

## 2. Status

`partial` — Der DBB-Adapter und der gemeinsame Importpfad funktionieren im Node-Nachweis. Alle fünf Paare liefern dieselben konstruktiven Lageobjekte und dieselben Quellenbeziehungs-Kandidaten innerhalb der DBB-Druckgenauigkeit. Die vollständige Viewer-Objektform mit `profile`, `cant`, `staEq` und `stationReference` sowie die sichtbare Browserkette sind nicht nachgewiesen. Kein Commit, Push, Merge oder Deployment.

## 3. Baseline and Scope

Repository: `/Users/uwefalz/Developer/ufAIM`. Frischer Worktree: `/private/tmp/ufaim-dbb-20260919-gQfMRP`; Branch `codex/dbb-gnd-import-20260919`; Basis `origin/main` @ `6ab2763cc654e8445ae491b46734ffabc50cd514`.

Scope: `src/import/`, ein DBB-Vertragstest unter `test/`, dieser Bericht. Gemeinsamer Checkout, `technetViewer.html`, Kernel, Thesis, Server und Scheduler nicht verändert. Fremde Thesis-Quellen, Bibliographie und Build-Artefakte sowie vorhandene Änderungen unter `tools/`, `.claude/`, `docs/architecture/`, `docs/reports/`, `test/tools/` blieben unangetastet. Abschließende Nur-Lese-Prüfung: gemeinsamer HEAD und `origin/main` weiterhin auf derselben Basis; keine uncommitteten Überschneidungen in `src/import/`, `technetViewer.html` oder dem neuen Test.

## 4. Work Performed

- Bounded DBB-Dialekt: Header `00 6AGON GND-Edit Export`, ASCII, LF/CRLF, Satzarten 11/12/13/21/22/23/24 → PP/PL/PH/EL/EH/EU/EK im vorhandenen `GndTypedSourceEnvelope`. Keine neue fachliche Zwischenarchitektur.
- Rohzeilen, Dateifingerprint, Zeilennummern, Zelllexeme und Dezimalstellen bleiben erhalten. Fehlende Familien sind leere Tabellen, keine erfundenen Datensätze. Nicht interpretierte Restfelder bleiben in `rawRecord`; Datumsfelder behalten ihren Quelltext. Das Envelope behauptet keine vollständige Originaldatei-Aufbewahrung (`originalSourceRetained=false`).
- Unbekannte Satzarten, andere Header, Nicht-ASCII, beschädigte Zahlen und zu kurze Kernfelder werden explizit zurückgewiesen. Größen-/Zeilen-/Laufzeitgrenzen und Abbruch zwischen Fortschritts-Batches sind vorgesehen.
- `.dbb` wird durch das vorhandene `gndEdit`-Modul erkannt. `parseGND_DBB` führt zum gleichen `parseGNDSourceEnvelope` wie MDB. Quelle: `source.format="DBB"`, `meta.sourceBackend="dbb"`; Parser-ID weiterhin `gndEdit`.
- Vorhandenes `extras.gndSequence` wird jetzt in `payload.extended.gndSequence` übernommen; `family`, `strecke`, `strRikz`, `lsys`, `hsys` und PAD-Enden bleiben dadurch am Lageobjekt verfügbar. Anfangs-/Endkoordinaten verbleiben in `payload.coordGeom.elements`.
- `element.extras.externalStation` enthält eine Kopie des vorhandenen `staStart`-Quellwerts. Dies ist ausdrücklich **keine** Dekodierung gepackter Stationsadressen und **keine** Umstellung auf eine lokale intrinsische Achse.
- `envelope.dbb.cantParameterUnit="meter"`: EUPAR2/EUPAR3 bleiben in der belegten GND-Konvention unverändert; keine zusätzliche Millimeter-Umrechnung. Referenz: `src/import/parsers/technet/sharedTechnet.js`, numerischer Abgleich mit den fünf MDB-Paaren.

Festgestellte Anschlusslücke: Die eingebettete GND-Auswertung in `technetViewer.html` ist weiter als der gemeinsame Source-Parser. Der gemeinsame Pfad liefert hier ausschließlich sichere horizontale `alignment`-Items. EH/EU und Kilometrierungssprünge bleiben Quellenbelege; identische PAD-Ketten können unbestätigte `gndSourceEvidenceAssociation`-Kandidaten erzeugen, **keine** konstruktiven `stationReference`-Relationen. Diese Grenze wurde nicht durch eine DBB-Sonderbehandlung umgangen.

## 5. Changed Files

Added:

- `src/import/parsers/technet/gndEdit/gnd/extractGndDbb.js`
- `src/import/parsers/technet/gndEdit/parseGND_DBB.js`
- `test/gnd-dbb-import.test.mjs`
- `docs/app/architecture/MISSION_REPORT_DBB_GND_IMPORT_001.md`

Modified:

- `src/import/parsers/technet/gndEdit/index.js`
- `src/import/parsers/technet/gndEdit/parseGND_XLSX.js`
- `src/import/parsers/technet/gndEdit/gnd/validateGndSourceEnvelope.js` — formatneutrale Fehlermeldung statt ausschließlich „MDB“.
- `src/import/build/buildAlignmentImportOutcome.js`

Moved or renamed: None. Deleted: None.

Nur lokale Testumgebung: zwei ignorierte `node_modules`-Symlinks nutzen vorhandene Abhängigkeiten aus dem gemeinsamen Checkout (`test/gnd-mdb-spike/` und `src/import/parsers/technet/gndEdit/mdb/`). Keine Paketinstallation, keine Lockfile-Änderung, keine Kopie privater Beispieldaten.

## 6. Evidence and Validation

Arbeitsverzeichnis für Befehle: oben genannter Worktree; Node `v24.10.0`.

1. `UFAIM_DBB_SAMPLE_DIR=/Users/uwefalz/Developer/ufAIM/test/samples/Brenzbahn node --test test/gnd-dbb-import.test.mjs` — `passed`: 13 Tests, keine Skips. Extraktion, Fehler-/Abbruchpfad, normale Import-Pipeline und alle fünf lokalen DBB/MDB-Paare geprüft. Öffentlicher synthetischer Testdatensatz enthält keine kopierten Bahn-Rohdaten.
2. `node --test test/gnd-dbb-import.test.mjs` — `passed`: acht öffentliche Tests; fünf private Paarprüfungen ausdrücklich übersprungen, wenn der Pfad fehlt. Skips zählen nicht als Paarbeweis.
3. `node --test test/gnd-*.test.mjs test/services/alignment/gnd-station-frame-chainage-candidate-service.test.mjs test/services/alignment/gnd-station-frame-chainage-candidate-boundary.test.mjs` — `passed`: 84 Tests, fünf private Paarprüfungen übersprungen. Bestehende MDB-/XLSX-, Quellen-, Beziehungs- und Stationsgrenzen bleiben bestehen.
4. `git diff --check` — `passed`.
5. `visible user journey` — `not run`. Kein normaler physischer Datei-Picker-/Drop-Durchlauf im Browser. Der synthetische Drop-Dispatch-Test ist lediglich Regressionsevidenz. Der zuletzt bekannte native Zugriffsblocker wurde in dieser Mission nicht erneut geprüft oder umgangen; aktueller Browserzugriff daher nicht bestätigt.
6. `durability/reopen` — `not run`; kein Ersatz für den fehlenden primären Browsernachweis.

Paarquelle: `/Users/uwefalz/Developer/ufAIM/test/samples/Brenzbahn/`; jeweils identischer Basisname mit `.DBB` und `.MDB`:

| Basisname | DBB-Datensätze | Gemeinsame Pipeline: Lage-Items | Zahlenabweichungen > 1e-8 |
| --- | ---: | ---: | ---: |
| `4760_2-3_DA0-V00` | 47 | 2 | 0 |
| `4760_5-7_DA0-V00` | 82 | 2 | 0 |
| `4760_10-16_DA0-V00` | 272 | 2 | 2 |
| `4760_38,8-46,0_DR0-R00` | 294 | 2 | 274 |
| `4760_48-65_DA0-V00` | 595 | 1 | 0 |

Insgesamt 1.290 Rohdatensätze; alle 276 erkannten numerischen Abweichungen liegen innerhalb einer halben Einheit der letzten gedruckten Dezimalstelle zuzüglich Gleitkommatoleranz. Paarprüfung betrifft PAD-/System-/Streckenidentität und ausgewählte numerische Geometrie-/Stationsparameter; keine Behauptung vollständiger textueller MDB/DBB-Gleichheit. Abgeleitete Geometrien zusätzlich mit absoluter Zahlentoleranz `0.00002` verglichen. Reihenfolge, Familienkontext, Objektarten/-namen, Anzahl unaufgelöster Anhänge und Quellenbeziehungs-Kandidaten stimmen überein.

Erste Anschlussprobe: `4760_2-3_DA0-V00.DBB`, SHA-256 `746d3afe017b391216ff9f7c408263dba39be24256adda47c1af4177fe5614a8`.

## 7. Kernel and Architecture Impact

Kernel impact: none

Architecture impact: conforming — zusätzlicher Quelldecoder vor dem bestehenden typisierten GND-Envelope und derselben Import-Pipeline; keine neue fachliche Relation oder Freigabe.

RefImpl impact: changed — DBB-Erkennung/Extraktion und Erhalt vorhandener GND-Sequenzmetadaten im kanonischen Lage-Payload.

Thesis impact: none

## 8. Conflicts, Risks, and Open Decisions

- `DBB-001-R1`: GND-Source-Parser und gebündelter Viewer sind funktional verschieden. Die gewünschte vollständige Item-Kette einschließlich produktiver `stationReference` fehlt im gemeinsamen Pfad. Quellenkandidaten dürfen nicht als bestätigte Zuordnung oder „Identität (PAD, GND)“ ausgegeben werden.
- `DBB-001-R2`: Stationsadressen sind unverändert Rohbelege; kein Nachweis metrischer Differenzen oder intrinsischer Bindung. LSYS/HSYS werden erhalten, nicht allein dadurch als fachlich zugelassen erklärt. Admission-/CRS-Schranken unverändert.
- `DBB-001-R3`: Erstimplementation ist auf die belegten AGON-v6-ASCII-Satzarten begrenzt. Andere DBB-Versionen, Zeichensätze und zusätzliche Satzarten benötigen eigene Belege; aktuelle Reaktion ist explizite Ablehnung.
- `DBB-001-R4`: Kein Browser-/Wiederöffnungsbeweis; keine Änderung des Delivery-Status aufgrund dieser Parserprüfung. Aktueller Browser-/Serverstand enthält diese uncommittierten Worktree-Änderungen nicht.
- Keine neue fachliche Entscheidung von Uwe angefordert, keine Überschneidung mit fremden Dateien. Alte Commit-/Merge-Freigaben wurden nicht auf dieses neue Paket übertragen.

## 9. Handover

Adapter für den vom Nutzer angebotenen Viewer-Anschluss: Export `extractGndDbb({ bytes, fileName, limits, signal, onHeartbeat })` aus `src/import/parsers/technet/gndEdit/gnd/extractGndDbb.js`. Er liefert dasselbe typisierte Envelope-Format wie `extractGndMdb`. Die sieben Tabellen können von der bestehenden GND-Auswertung übernommen werden; DBB darf kein eigener fachlicher Interpretationspfad werden. Für den gemeinsamen App-Eingang ist `parseGND_DBB` bereits im `gndEdit`-Modul registriert. Keine neue Parserfamilie nötig; eine spätere Familiennormalisierung bleibt separate Viewer-Arbeit.

Nächster sicherer Schritt: Viewer-Verantwortlicher übernimmt den Decoder in den bestehenden Build-/Importweg und fährt `4760_2-3_DA0-V00.DBB` sowie die gleichnamige MDB nacheinander über den normalen physischen Import. Voraussetzungen: freier Datei-Ownership, verfügbarer Browserzugriff und frischer lokaler Origin des vereinbarten Standes. Der laufende Server auf 8080 wurde nicht angefasst.

Done-Kriterium: sichtbarer Import mit Fortschritt und ehrlichem Endstatus; gleiche fachliche Objekte/Geometrien innerhalb Quellpräzision, gleiche Strecke/Seite und LSYS/HSYS; Überhöhung korrekt in Metern; gültige PAD-basierte `stationReference` ohne verwaiste Profile/Überhöhungen oder erfundene Stationsgleichungen; Auswahl in den vorgesehenen Ansichten und anschließend verlustfreies Speichern/Schließen/Wiederöffnen. Erst dieser Kettentest belegt die gewünschte Integration. Thesis/Kernel müssen dafür nicht verändert werden. Weiterarbeit anderer Streams bleibt unabhängig und zählt nicht als dieser Beweis.
