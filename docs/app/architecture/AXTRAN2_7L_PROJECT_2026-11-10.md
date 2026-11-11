# AXTRAN2: das 7L-Projekt in der Standalone-App (2026-11-10)

Bisher nahm die Standalone-App eine Linie: eine TRA, ein Aufmaß. Ein
Trassenprojekt ist aber bis zu sieben Linien, die zusammengehören:

| Linie | was | steht in |
|---|---|---|
| km-TRA | Kilometrierungslinie | …_KM.TRA |
| re-TRA, li-TRA | Achse des rechten und des linken Gleises | …_RE.TRA, …_LI.TRA |
| re-UEB, li-UEB | Überhöhung je Gleis | U-Spalten der TRA des Gleises und Rampenkonstruktionen in seiner GRA – keine eigene Datei |
| re-GRA, li-GRA | Gradiente je Gleis | …_RE.GRA, …_LI.GRA |

Fünf Dateien, sieben Linien. Im Korpus: 14 KM-TRA, 8 RE-TRA, 6 LI-TRA,
8 RE-GRA, 6 LI-GRA; Dateien mit der Endung UEB gibt es dort nicht.

## Stufe 1 (dieser Stand): das Projekt laden, die Achsen optimieren

- **Laden.** Ein Feld nimmt mehrere Dateien auf einmal. KM, RE oder LI als
  eigenes Wort im Namen sagt die Linie (`…_RE.TRA`, `Gleis-li.gra`,
  „rechts“, „links“); die Endung sagt TRA oder GRA. Eine Datei ohne das
  nimmt die nächste freie Linie ihrer Art (re, li, dann km) und steht als
  „angenommen“ in der Tabelle – eine Annahme, gezeigt, zu ändern, indem die
  Datei ihren Namen bekommt. Zwei Dateien für eine Linie: die erste bleibt,
  die zweite wird genannt und nicht geladen.
- **Die Tabelle der sieben Linien** zeigt je Linie Datei, Inhalt und Stand:
  eine TRA mit Sätzen, Länge, Stationen und Kilometersprüngen; eine GRA mit
  Neigungswechseln, Ausrundungen, Stationen und Höhen; die Überhöhung mit
  der Zahl der Sätze, die eine tragen, ihrem größten Wert und den
  Rampenkonstruktionen der GRA.
- **Optimiert werden die drei Achsen**, jede für sich mit dem vorhandenen
  Fit (`fitTraCore`), ihrem eigenen Aufmaß und ihren eigenen Vorgaben.
  „bearbeiten“ holt eine Achse in die Felder darunter; Aufmaß, Vorgaben und
  Ergebnis bleiben an ihrer Linie und kommen beim Zurückwechseln wieder.
  „Alle Achsen mit Aufmaß rechnen“ rechnet sie nacheinander.
- **Die Überhöhung wird mit ihrer Achse geprüft, nicht verändert**: nach dem
  Fit steht an re-UEB und li-UEB, wie viele Bögen bei der Geschwindigkeit
  über dem zulässigen Fehlbetrag liegen, vorher und nachher (der Bericht
  des Fits trägt das seit Oktober).
- **Die Gradiente wird geladen und gezeigt** (ausgeglichen in Stufe 2).
  Nach dem Fit ihrer Achse sagt die Zeile, um wie viel die Achse länger oder
  kürzer ist und dass die Stationen der Gradiente noch die vor dem Fit sind.

Gebaut als `src/services/axtran2/trackProject.js` (Zuordnung, Beschreibung,
Modell und Tabelle der Linien; rein bis auf das Lesen der Bytes mit den
Parsern der Produktion) und als Verdrahtung in `axtran2/app.js`. Kein Kern.

## Stufe 2: die Gradiente an gemessene Höhen ausgleichen (2026-11-10)

„ausgleichen“ an re-GRA oder li-GRA passt die Höhen der Neigungswechsel an
die gemessenen Höhen an. Stationen und Ausrundungen bleiben.

- **Die GRA, wie sie gelesen wird** (`gradientProfile.readGra`): 36-Byte-
  Sätze, Station, Höhe, Halbmesser, Tangentenlänge. Der Kopfsatz nennt die
  Zahl der Neigungswechsel; Sätze dahinter sind Rampenkonstruktionen und
  werden unverändert mitgeführt. **Ein Satz mit R = 0 und T = 1000 ist ein
  Kilometersprung**: derselbe Punkt folgt mit der Station nach dem Sprung.
  Im Korpus liest sich das ausnahmslos so (247 Dateien, 38 Sprünge in 17
  Dateien, jedes Mal dieselbe Höhe im Folgesatz). Die Gradiente läuft darum
  über eine eigene Lauflänge ab dem ersten Neigungswechsel, die Sprünge
  herausgenommen; eine Station ist nur der Name eines Orts darauf.
- **Was an einer Ausrundung gehalten wird.** Die Datei trägt R und T. Welche
  der beiden der Entwurf gewählt hat, zeigt sich daran, welche eine runde
  Zahl ist (R −16000 mit T 22,084, oder T 10,000 mit R 14453,5); die bleibt,
  die andere folgt den neuen Neigungen (T = |R|·|Δn|/2). Im Korpusprojekt:
  48 Halbmesser, 32 Tangentenlängen, 63 Neigungswechsel ohne Ausrundung.
- **Wo ein Punkt auf der Gradiente liegt** (`fitGraCore`): sein Fußpunkt auf
  der Achse, an der die Gradiente stationiert ist – die Kilometrierungslinie,
  wo sie die Stationen der Gradiente trägt, sonst die Achse des Gleises.
  Gezählt wird die Lauflänge ab dem Ort, an dem die Gradiente beginnt.
  Probe am Korpus: die Gradiente 6100 RE und ihre Kilometrierungslinie
  tragen dieselben sechs Kilometersprünge an denselben Stellen.
- **Der Ausgleich** (`gradientProfile.fitGradient`): kleinste Quadrate in
  den Höhen. Mit festen Tangentenlängen ist das Profil linear in den Höhen;
  wo ein Halbmesser gehalten ist, folgt die Tangentenlänge den neuen
  Neigungen, und der Schritt wird wiederholt, bis sie steht. Der erste und
  der letzte Neigungswechsel bleiben (Anschluss); weitere hält das Feld
  „Neigungswechsel halten“. **Ein Neigungswechsel, den keine Messung
  erreicht, bleibt beim Plan** (schwache Vorinformation, σ 1 m gegen
  Toleranzen von Zentimetern), und der Bericht nennt ihn.
- **Die Höhen** kommen aus dem Aufmaß der Achse desselben Gleises: eine .pt
  trägt sie, eine CSV braucht eine Spalte H oder Höhe (`pointLists`, nur mit
  Kopfzeile – eine vierte Zahl ohne Kopf bleibt die Toleranz). Liegt das
  Aufmaß um ein festes Maß über der Gradiente, nimmt ein Feld es ab.
- **Heraus:** die GRA mit den neuen Höhen (`writeGraHeights`: die Bytes der
  Datei, nur Höhen und – wo sich Neigungen geändert haben – die folgende
  Größe der Ausrundung ersetzt; unveränderte Höhen geben die Datei Byte für
  Byte zurück), Bericht, Höhenliste, Tabelle der Neigungswechsel, Kurve des
  Höhenabstands.

Kein Kern: ein eigener kleiner Ausgleich neben dem der Achse. Befund am
Rand: der Import der App (`parseTRA_GRA`) sortiert die Neigungswechsel nach
Station und erkennt den Sprungsatz nicht; hinter einem Rücksprung stehen
sie dort in falscher Folge. Nicht angefasst.

## Was nicht gebaut ist, und was es jeweils braucht

1. **Gradiente nachführen.** Nach dem Fit der Achse liegen die
   Neigungswechsel an anderer Station – wenn die Gradiente an der Achse des
   Gleises stationiert ist; an der Kilometrierungslinie bleiben sie. Braucht:
   die Abbildung alte Station → neue Station aus dem Fit. Stationen
   schreiben kann `writeGraHeights` noch nicht.
2. **Stationen und Ausrundungen der Gradiente ausgleichen.** Gebaut sind
   die Höhen; die Lage eines Neigungswechsels und der Halbmesser bleiben.
3. **Überhöhung nachführen.** Die Rampen an die Übergangsbögen des Fits
   binden und die U-Werte der Bögen behalten; in die TRA geschrieben wird
   die Überhöhung heute schon mit dem Abstand vom Anfang, nicht mit dem
   Element.
4. **Kilometrierungslinie.** Sie hat kein Aufmaß; zu klären ist, ob sie
   gehalten wird und die Gleise auf sie stationiert werden, oder ob sie den
   Gleisen folgt.
5. **Gleise zueinander.** Gleisabstand zwischen re und li als Bedingung
   oder wenigstens als Prüfung; das ginge in den Löser.
6. **Alles auf einmal herunterladen.** Heute lädt man je Achse.

Reihenfolge und Zuschnitt sind Uwes Entscheidung.
