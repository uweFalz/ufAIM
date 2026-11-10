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
- **Die Gradiente wird geladen und gezeigt.** Nach dem Fit ihrer Achse sagt
  die Zeile, um wie viel die Achse länger oder kürzer ist und dass die
  Stationen der Gradiente noch die vor dem Fit sind.

Gebaut als `src/services/axtran2/trackProject.js` (Zuordnung, Beschreibung,
Modell und Tabelle der Linien; rein bis auf das Lesen der Bytes mit den
Parsern der Produktion) und als Verdrahtung in `axtran2/app.js`. Kein Kern.

## Was nicht gebaut ist, und was es jeweils braucht

1. **Gradiente nachführen.** Nach dem Fit der Achse liegen die
   Neigungswechsel an anderer Station. Braucht: die Abbildung alte Station →
   neue Station aus dem Fit (liegt im Bericht je Element vor) und einen
   GRA-Schreiber; den gibt es nicht.
2. **Gradiente ausgleichen.** Die Höhen der Neigungswechsel an die
   gemessenen Höhen anpassen; die .pt-Liste trägt Höhen schon. Eigener
   kleiner Ausgleich (linear in den Höhen bei gehaltenen Stationen und
   Halbmessern), kein Eingriff in den Löser der Achse.
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
