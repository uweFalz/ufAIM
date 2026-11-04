# AXTRAN2 Vorführung durch den Adapter (2026-10-20)

Die Vorführung, die der Anwender des alten AXTRAN den Kollegen zeigen
kann: eine echte Trasse, ein Aufmaß, ein Zwangspunkt, ein Plan, der
daneben liegt, ein Aufruf. `tools/axtran2/demo.mjs` führt sie auf einer
beliebigen Verm.esn-TRA aus und schreibt alles in einen Ordner, mit einer
`summary.md`, die die Zahlen erzählt. Die Korpusdateien sind Kundendaten
und bleiben außerhalb des Repositoriums; die Vorführung liest sie nur.

## Was die Vorführung tut

1. Die TRA ist die aufgemessene Trasse, die Geometrie, die das Feld hat.
2. Daraus entsteht ein Aufmaß: alle 25 m ein Punkt mit 4 cm Querstreuung.
   Für die Korpusdateien gibt es kein echtes Aufmaß; die Zusammenfassung
   sagt das, damit es niemand für eines hält.
3. Ein Zwangspunkt 2 m links der Achse bei einem Drittel der Länge, als
   Gleichung, wie eine Bahnsteigkante oder ein Mast vorgegeben würde.
4. Der Plan ist absichtlich daneben: jede freie Länge um ±2 %, jede
   Bogenkrümmung um ±3 % verstellt, mit wechselndem Vorzeichen. Über
   3 km summiert sich das zu Dutzenden Metern.
5. Die Endpose ist die der Anschlusstrasse, hier das Ende der aufgemessenen
   Trasse, über `--end-pose` übergeben. Ohne sie hielte der Adapter das
   Ende des Plans, und der Fit könnte nur noch dorthin, wo der Plan endet:
   gemessen auf der Eifel-Trasse blieb er so bei 17 m rms stehen. Das ist
   die Lehre des Altfalls, Anschlusstrassen vorn und hinten sind die
   Vorgabe, nicht der Plan.
6. Der Adapter: `fitTra.mjs` mit Plan, Aufmaß, Zwangspunkt und Endpose.
   Punkte, die jenseits eines Endes des Plans liegen, haben auf ihm keinen
   Fußpunkt; sie werden ausgeschlossen und im Bericht benannt, ebenso
   Punkte innerhalb des anderthalbfachen Endversatzes, wie es der Korpus
   hält. Auf dem Maßstab lag der letzte Punkt 293 m neben dem verlängerten
   Planende; ohne die Regel brach der Lauf dort ab.

## Eifel, 2631R142: 42 Elemente, 3,3 km

| | |
|---|---|
| Aufmaß | 131 Punkte, davon 129 im Fit (zwei ohne Fußpunkt am Plan), V 80 km/h, 11 vererbte Ausnahmen |
| Plan vorher | bis 72,9 m neben dem Aufmaß, rms 23,7 m, Endpunkt 78 m daneben |
| Verdikt | stationary / within_tolerance nach 156 Schritten in 2,6 s |
| Aufmaß nachher | max 4,5 cm, rms 2,2 cm, 0 von 129 außerhalb 0,15 m |
| Endpose | 8e-12 m |
| Zwangspunkt | 2,0000 m, verlangt 2,000 m |
| Achse gegen die Trasse | größter Querabstand 3,3 cm zwischen erstem und letztem Punkt, alle 10 m gemessen; 1 mm auf den 117 m ohne Punkte an den Enden |
| Elementgrößen | Länge und Radius einzelner Elemente deutlich anders; Richtungen, die die Punkte nicht bestimmen, nennt der Bericht |

Die letzte Zeile ist der Satz, den die Vorführung erklären muss: die
Punkte bestimmen die Achse, nicht ihre Aufteilung in Elemente. Wo ein
Übergangsbogen beginnt oder wie weit ein Radius von 5 000 m ist, sieht
ein Aufmaß mit 4 cm Streuung nicht, und der Bericht nennt diese
Richtungen (`diagnostics.determinacy`). Wer die Aufteilung des Plans
halten will, nimmt den Längen-Prior des Beweisdienstes
(AXTRAN2_LENGTH_PRIOR_PROPOSAL.md); der Adapter fittet, was die Punkte
sagen.

## Der AXTRAN-Maßstab, 1280_043-049: 164 Elemente, 22 km

| | |
|---|---|
| Aufmaß | 884 Punkte alle 25 m, davon 863 im Fit: 21 ohne Fußpunkt am Plan, dessen Ende 336 m neben der Trasse liegt |
| Plan vorher | bis 306 m neben dem Aufmaß, rms 147 m |
| Verdikt | stationary / within_tolerance nach 284 Schritten in 414 s, 228 freie Größen |
| Aufmaß nachher | max 6,4 cm, rms 2,4 cm, 0 von 863 außerhalb 0,15 m |
| Endpose | 9e-8 m |
| Zwangspunkt | 2,0000 m, verlangt 2,000 m |
| Achse gegen die Trasse | größter Querabstand 6,5 cm zwischen erstem und letztem Punkt; 44 cm auf den 590 m an den Enden ohne Punkte, wo nur die Endpose hält |
| Elementgrößen | Länge bis 10 m, Radius bis 9 288 m anders; 120 von 228 Richtungen von den Punkten nicht bestimmt |

Die 44 cm am Ende sind die Lehre, nicht ein Fehler: wo kein Punkt
liegt, hält nur die Endpose, und ein Plan, der 336 m daneben begann,
wird dort nur bis auf die Endpose zurückgeholt. Wer das Ende braucht,
misst es auf.

## Der Aufruf

```bash
node tools/axtran2/demo.mjs --tra <strecke.TRA> --out <ordner>
```

und darin, wie die Zusammenfassung ihn zeigt:

```bash
node tools/axtran2/fitTra.mjs --tra plan.TRA --points aufmass.csv --zwang zwangspunkte.csv --end-pose "E,N,T" --out fitted.TRA --report report.json --csv residuen.csv
```

`test/axtran2/demo.test.mjs` führt die Vorführung auf einer kleinen
Korpusdatei aus und prüft, was ein Kollege fragen würde: der Plan lag
sichtbar daneben, die Achse liegt wieder auf dem Aufmaß, der Zwangspunkt
ist getroffen, die Dateien sind da.

## Die Überhöhung (2026-11-01)

Der Fit verändert die Überhöhung nicht: U1/U2 gehen so in die Datei
zurück, wie sie kamen, denn die Überhöhung ist eine Entscheidung einer
anderen Disziplin. Was der Adapter seit Version 0.5 tut: er beurteilt
jeden Bogen mit seiner getragenen Überhöhung am gefitteten Radius. Bei der
Geschwindigkeit des Profils ist die Ausgleichsüberhöhung u0 = s·V²/(g·R)
(11,8·V²/R mm), der Fehlbetrag u_f = u0 − u, und Ril 800.0110 Tab. 5
begrenzt ihn auf 130 mm. Der Bericht (`report.cant`) listet jeden Bogen
vorher und nachher, zählt die Überschreitungen und nennt die Quellen der
Grenzen; die getragene Überhöhung selbst wird an der EBO-Grenze von 180 mm
gemessen, nicht an den 130 mm, die das Profil für seinen Radius-Boden
annimmt. Kommandozeile und App geben eine Zeile aus.

Gemessen auf der Eifel-Vorführung (V 80 km/h, 19 Bögen): vor dem Fit
liegen 3 Bögen über 130 mm Fehlbetrag, nach dem Fit 1 (E0: R 301 m mit
u 100 mm, u_f 151 mm, vorher wie nachher). Der Fit hat E6 (136 → 127 mm)
und E30 (138 → 129 mm) unter die Grenze gebracht, weil er die Radien
weitete. Kein Bogen trägt mehr als 180 mm. Die Marke 1280_043-049 trägt
keine Überhöhung; dort sagt der Bericht, welcher Fehlbetrag bei V ohne
Überhöhung stünde.

Nicht beurteilt: der Überhöhungsüberschuss (u > u0) und die Rampen gegen
die getragene statt der angenommenen Überhöhung. Beides braucht Zahlen,
die das Profil nicht erklärt, und bleibt deshalb unerklärt.

## Der Mindestabstand (2026-11-04)

Ein Zwangspunkt wird auf drei Arten gehalten. `=` ist die Gleichung: die
Achse geht genau im Sollabstand vorbei (Nachbargleisachse). `min` ist der
Mindestabstand, `max` der Höchstabstand: die Regel, die ein Mast, ein
Pfeiler oder eine Bahnsteigkante tatsächlich stellt. Die Liste sagt es in
einer Spalte `Art` oder vor dem Abstand (`>= L 2.20`); die Seite steht als
Vorzeichen (links positiv) oder als Buchstabe (`L 2.20`, `R 2.20`). Eine
Liste ohne Regel trägt keine; der Adapter hält sie dann als Gleichung.

Im Kern ist der Mindestabstand eine Ungleichung `g <= 0` auf dem
Seitenabstand, neben der Rampenregel und dem Korridor, nicht eine
Gleichung: er kostet keinen Freiheitsgrad, und ein Punkt mit Spiel kostet
den Fit nichts. Die Verletzung steht in Metern im Bericht
(`fit.boundPoints[].violation`, negativ um das Spiel), die Gatestufe 0
zählt sie wie eine verletzte Gleichung. Die Residuenliste trägt die Regel
in der Spalte `rule`, `within` ist einseitig.

Eifel, `plan.TRA` aus der Vorführung, 129 Punkte, V 80 km/h, derselbe
Punkt Z1 bei Station 990,9, 2,00 m links der Achse:

| Zwang | Urteil | Iterationen | s | rms | außerhalb | Z1 |
|---|---|---|---|---|---|---|
| keiner | stationary/within_tolerance | 172 | 3,0 | 0,150 | 0 | – |
| `= 2,00` | stationary/within_tolerance | 189 | 2,9 | 0,178 | 0 | 2,0000 |
| `min 1,70` | stationary/within_tolerance | 232 | 3,1 | 0,147 | 0 | 2,0087, 0,309 m Spiel |
| `min 2,30` | max_iterations | 1000 | 43,2 | 0,278 | 2 | 2,3000, an der Grenze |
| `= 2,30` | stationary | 458 | 20,7 | 0,272 | 2 | 2,3000 |
| `max 1,70` | stationary | 733 | 24,2 | 0,348 | 5 | 1,7000, an der Grenze |
| `= 1,70` | max_iterations | 1000 | 47,7 | 0,349 | 5 | 1,7000 |

Mit Spiel liegt das Ergebnis beim freien Fit (rms 0,147 gegen 0,150).
Ohne Spiel wird die Grenze auf den Zehntelmillimeter gehalten, und die
Punkte zahlen dafür. Dass die geschobenen Fälle lange laufen, liegt an der
Aufgabe, nicht an der Ungleichung: die Gleichung an derselben Stelle
braucht ebenso lange oder länger. Ein Punkt 0,3 m gegen das Aufmaß zu
schieben lässt Punkte außerhalb der Toleranz, und dann greift der
„within_tolerance"-Halt nicht mehr.

Nicht gebaut: eine Station als Hinweis für Schleifen, eine Bemerkung je
Punkt, das Formular in der App statt der Datei. Der Beobachtungsweg
(`tools/axtran2/pointObservationAdapter.mjs`) nimmt weiter keine Regel aus
der Quelle an; eine Liste mit `Art` weist er dort als Abweichung des
Lesers ab, wie zuvor eine mit Toleranzvorgabe.

