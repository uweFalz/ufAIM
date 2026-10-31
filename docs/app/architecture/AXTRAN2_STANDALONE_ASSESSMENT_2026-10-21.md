# alignmentOS als Modul, AXTRAN2 als eigene App: Prüfung (2026-10-21)

Gefragt war, ob alignmentOS als Modul extrahierbar ist und AXTRAN2 als
eigene App aufgesetzt werden kann, wie die Vorführung es zeigt: ein
Rechenkern AIM, darauf AXTRAN2 als die Rechnung, die über Gleis-zu-Welt
und Welt-zu-Gleis hinausgeht. Geprüft am Importgraphen des Repositoriums
(Stand `origin/main` nach #76), nichts geändert.

> Stand 2026-10-23: Schritt 1 (#79) und 2 (#80) sind gebaut; der Paketschnitt
> ist mit `package.json` (`alignment-os`, `exports`, `type: module`), relativen
> Importen in `src/` und dem Grenztest `test/package/alignment-os-package.test.mjs`
> umgesetzt. Die App-Hülle ist gebaut (2026-10-24): `axtran2/index.html`,
> `app.js`, `worker.js` auf `src/services/axtran2/fitTraCore.js`, dem aus
> dem Werkzeug gehobenen Rechenkern des Adapters, den die Kommandozeile teilt.
> Abbruch (2026-10-31): ein Knopf „Abbrechen" neben „Optimieren", sichtbar
> nur während des Laufs; er beendet den Worker, die Rechnung muss nichts
> davon wissen, die Seite meldet „Abgebrochen nach n s. Der Plan ist
> unverändert." Geprüft an der Marke 1280_043-049 im Modul-Betrieb und im
> Einzeldatei-Bündel, Neustart nach dem Abbruch läuft.
> Ordnung (2026-10-31): Auswahl „Ordnung" unter Vorgaben: Punkte allein
> (Vorgabe), Rangfolge mit Länge als Referenz, streng, oder mit Längenbudget
> in Metern. Die Rangfolge läuft über `solveAlignmentLexicographic`; der
> Bericht nennt jede Phase und was die Punkte an Länge kosten. Zahlen in
> `AXTRAN2_LEXICOGRAPHIC_CORPUS_2026-09-10.md`, Abschnitt „In the adapter and the app".

## Urteil

Beides geht, und beides ist näher, als der Baum aussehen lässt.
`src/` hat keine einzige Kante nach `app/`, `test/` oder `tools/`
(313 Dateien im Abschluss); `src/aim-core` ist bereits ein in sich
geschlossenes Modul ohne Außenkanten, mit Barrel und Grenztests.
Der Abschluss von AXTRAN2 ist 71 Dateien, rund 15 700 Zeilen, und zieht
nichts aus `app/`, `src/model/spot`, `src/shared/messaging` oder der
Persistenz. Was fehlt, ist keine Architektur, sondern Paketierung:
es gibt kein `package.json`, keine `exports`, und die Aliase `@src/`,
`@kimport/` werden im Browser über eine Import-Map
(`app/bootstrap/loadImportMaps.js`) und in Node über einen Hook im
Korpus-Lader aufgelöst. Zwei Schönheitsfehler sitzen in AXTRAN2 selbst
und sind in einem Tag behoben.

## alignmentOS als Modul

Das Programm (ALIGNMENT_KNOWLEDGE_WORK_PROGRAM.md, E) sagt: Anwendungen
bauen auf alignmentOS, sie definieren AIM Core nicht. Im Repositorium
ist alignmentOS der ganze Baum `src/`; die App `app/` sitzt darauf.

| Befund | Stand |
|---|---|
| `src/` → `app/`, `test/`, `tools/` | keine Kante |
| `src/aim-core` → außerhalb | keine Kante; 60 Dateien, `index.js` als Barrel, Grenztests in `test/aim-core/module-boundaries` |
| Aliase in `src/` | `src/import/parsers/**` und `src/model/spot/**` importieren über `@kimport/`, `@spot/`, `@src/`; `src/domain`, `src/lib`, `src/aim-core` relativ |
| Node-Abhängigkeiten außerhalb von git | `src/import/parsers/technet/gndEdit/mdb/node_modules` (mdb-reader), `test/gnd-mdb-spike/node_modules` (xlsx); nur der GND-Import braucht sie |
| Paketierung | kein `package.json`, kein Build; die App wird statisch bedient |

Der Schnitt ist damit vorgezeichnet: `src/` als ES-Modul-Paket
`alignment-os` mit einem `package.json`, dessen `exports` die Bereiche
benennen (`./aim-core`, `./domain/transition`, `./domain/optimization`,
`./lib/math`, `./import/parsers/vermEsn`, `./import/build`), und die
Aliase in `src/` durch relative Importe ersetzt, damit das Paket ohne
Import-Map lädt; die Import-Map bleibt der App. Der GND-Import mit
seinen Node-Modulen wird ein optionaler Export oder bleibt in der App.

## AXTRAN2 als eigene App

Der Abschluss von `src/domain/optimization`, `src/lib/math/optim`,
`tools/axtran2` und dem Beweisdienst:

| Bereich | Dateien | Zeilen | Rolle |
|---|---|---|---|
| `src/domain/optimization` | 19 | 5 207 | Problem, Zwänge, Residuen, Jacobi-Kette, Projektion, Katalog, Profile, Löser-Hülle, Lexikografie |
| `src/lib/math/optim` | 15 | 3 304 | SQP, QP, Filter, Merit-Gewichte, Restauration |
| `src/aim-core` | 16 von 60 | 2 688 | Geometrie, Aggregate-Fabrik, Sparse-Builder, Übergangsbogen |
| `src/domain/transition` | 3 | 558 | Registry, Krümmungsfunktionen, `transitionLookup.json` |
| `src/import/parsers/technet/vermEsn` + `parsers` + `landfat` | 8 | 2 669 | TRA lesen |
| `src/import/build` | 1 | 229 | `sparseWriter` für die Produktionsgeometrie |
| `src/services/alignment` | 1 | 283 | Beweisdienst (App-Pfad) |
| `tools/axtran2` | 4 | 877 | Adapter, Listen, TRA-Schreiber, Vorführung |
| `test/axtran2/corpus` | 2 | 341 | Lader mit Hooks, Szenario-Fabrik (`deps`, `momentsFor`, `chooseProfile`) |

Nichts davon braucht `app/`, SPOT, die Messaging-Schicht, den
SharedWorker oder IndexedDB, an denen die Haupt-App im Browser hängt.
Die zwei Schönheitsfehler: der Adapter importiert den Korpus-Lader aus
`test/` (Hooks und Dateisystem) und die Szenario-Fabrik aus
`test/axtran2/corpus/createTraScenario.mjs` (`deps`, `momentsFor`,
`chooseProfile`). Beides gehört nach `src/domain/optimization/alignment`,
wie der TRA-Leser mit #72 nach `src/import` gehoben wurde; der Hook
bleibt bei Node-Aufrufern.

Die App selbst ist die Reise des Adapters, im Browser: TRA, Aufmaßliste
und Zwangspunktliste per Dateidialog (der Parser liest Bytes, kein
Dateisystem), Endpose, gehaltene Posen und Weichen aus dem Katalog als
Deklaration, der Lauf mit Fortschritt und Verdikt, die gefittete TRA
und der Bericht zum Herunterladen (der Schreiber liefert Bytes). Keine
kanonische Trasse, keine Persistenz, kein Worker: eine statische Seite
auf dem Paket. Das wahrt das Grenzdokument, nach dem AXTRAN2 eine
Dienstschicht ist und nie kanonische Wahrheit wird.

## Was es kostet

| Schritt | Aufwand |
|---|---|
| Lader und Szenario-Fabrik nach `src/domain/optimization` heben | 1 Tag |
| `package.json` mit `exports`, Aliase in `src/` relativ, Grenztest „`src/` zeigt nicht nach außen" | 2 Tage |
| AXTRAN2-App-Hülle: Dateidialoge, Deklarationen, Lauf, Download | 2 bis 3 Tage |
| Vorführung und Korpus-Tests gegen das Paket statt gegen den Baum | 1 Tag |

Risiken: die Alias-Importe im Parser, die beim Herauslösen zu finden
sind (ein Test über alle Importe in `src/` findet sie); die
Rechenzeit im Browser-Hauptthread, wo ein 22-km-Lauf sieben Minuten
blockiert und ein Worker im eigenen Paket die Antwort ist; die
Katalogmaße mit Status „catalogue" sind aus der Richtlinie abgetippt
und nicht gegen das Dokument maschinell geprüft.

## Was nicht geprüft wurde

Ob die Haupt-App nach dem Schnitt unverändert läuft, ist eine Frage an
ihre E2E-Reise, nicht an diesen Graphen; und ob alignmentOS als Paket
außerhalb von ufAIM veröffentlicht werden soll, ist eine Entscheidung,
keine Prüfung.
