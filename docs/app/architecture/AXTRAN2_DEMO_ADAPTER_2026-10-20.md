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
