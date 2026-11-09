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

Nicht gebaut: das Formular in der App statt der Datei. Der Beobachtungsweg
(`tools/axtran2/pointObservationAdapter.mjs`) nimmt weiter keine Regel aus
der Quelle an; eine Liste mit `Art` weist er dort als Abweichung des
Lesers ab, wie zuvor eine mit Toleranzvorgabe.

## Station und Bemerkung (2026-11-04)

Zwei weitere Spalten, die eine Kopfzeile nennen darf, für Aufmaß wie
Zwangspunkte: `Station` und `Bemerkung`. Ohne Kopfzeile gibt es sie nicht,
weil die vierte Zahl einer Zeile sonst nicht von der Toleranz zu
unterscheiden wäre.

Die Station ist ein Hinweis, keine Messung, in der Kilometrierung der
Datei. Der Fußpunkt-Speicher (`AlignmentPointProjection.js`, `seed`) wird
mit ihr vorbelegt: die erste Projektion sucht per Newton von dort aus statt
mit dem Scan nach dem nächsten Fuß. Das ist für eine Trasse gedacht, die
einen Punkt zweimal passiert und deren nächster Fuß auf der falschen
Passage liegt. Ein Hinweis, der weiter als Newtons Fenster (200 m) vom
wahren Fuß entfernt ist, wird nicht befolgt; dann läuft der Scan wie ohne
Hinweis, und die CLI meldet es (`the hint did not take`). Eine Station
außerhalb der Trasse wird abgewiesen (`STATION_OUTSIDE`).

Die Bemerkung wird ungelesen durchgereicht: in die Zeile des Berichts
(`remark`, daneben `stationGiven`), in die Residuenliste (letzte Spalte,
Semikolon durch Komma ersetzt) und, wenn eine Liste eine trägt, als Spalte
der App-Tabelle.

Gemessen auf dem Eifel-Plan (129 Punkte, Z1 `= L 2,000`, Endpose gegeben):

| Liste | Iterationen | rms | Fuß Z1 |
|---|---|---|---|
| ohne Station | 189 | 0,178 | 990,909 |
| Station 990,9 | 173 | 0,208 | 990,906 |
| Station 400 (falsch) | 189 | 0,178 | 990,908, Hinweis nicht befolgt |
| Station 9999 | abgewiesen | | |

Der richtige Hinweis trifft denselben Fuß wie der Scan, der Fit endet aber
an einem anderen `within_tolerance`-Halt: der erste Fuß aus Newton ist auf
1e-9 m genau, der aus dem Scan auf das, was 400 Stützstellen und 40
Verfeinerungen hergeben, und der SQP-Weg trennt sich an diesem Unterschied.
Beide Enden haben 0 Punkte außerhalb; der Halt nimmt das erste, das genügt.
Die Eifel-Linie hat keine Schleife, der eigentliche Nutzen des Hinweises
ist hier also nicht messbar, nur sein Preis: keiner.

## Gehaltene Sätze: Weichen und Radien (2026-11-06)

Anlass ist ein Anwendungsfall aus der Praxis: ein Bahnhofsgleis zwischen
zwei Weichen, 77 Ist-Gleislagepunkte im 10-m-Abstand, dazu ein Entwurf
aus 13 Sätzen (Geraden und Kreise mit runden Radien, keine Übergangsbögen,
keine Überhöhung). Die Daten sind Kundendaten und liegen nicht im Repo.

Der erste Bogen des Entwurfs ist R 190 mit L 21,025 m, gefolgt von einer
Geraden von 6,092 m: das ist der Zweig einer EW 190-1:9 mit ihrem geraden
Endstück (`R * atan(1/9)` und `d` aus Ril 800.0120A01). Der letzte Bogen,
R 300 mit L 33,197 m, ist der Zweig einer EW 300-1:9. Der Adapter gab
beide frei und verschmolz die Sätze 2+3 und 12+13 mit ihren Nachbarn
gleicher Krümmung; in der geschriebenen Datei waren die Weichengrenzen
weg, und der Fit zog R 190 auf 190,5.

Zwei Vorgaben dafür, beide Erklärung des Aufrufers:

- `hold`: Sätze, die bleiben, wie die Datei sie hat, Länge und Radius.
  Satznummern wie im TRA-Ausdruck, Bereiche (`3-5`) oder das Wort
  `turnouts` (`Weichen`). Ein gehaltener Satz wird nicht mit dem Nachbarn
  verschmolzen (`traAlignment`, Option `fixedRecords`, Kennzeichen `fixed`
  am Element; `held` bleibt den Platzhaltern des Lesers vorbehalten, die
  der Schreiber fallen lässt).
- `holdRadii`: alle Radien bleiben, der Fit verändert nur die Längen.

Die Erkennung (`src/services/axtran2/heldRecords.js`) nennt jede Weiche,
die die Datei zeigt, ob gehalten oder nicht: ein Bogen mit dem Radius einer
Regelbauart, dessen Länge auf 2 mm `R * atan(1/n)` ist, und daneben die
Gerade, deren Länge das Endstück `d` der Regelbauart ist. Sie hält nichts
von sich aus; `hold turnouts` ohne erkannte Weiche wird abgewiesen
(`NO_TURNOUT`), ein Aufruf, der nichts frei lässt, ebenso (`NOTHING_FREE`).

Gemessen auf dem Bahnhofsgleis (Toleranz 3 mm, V 40, je 0,1 s):

| Vorgabe | Sätze geschrieben | rms | max | R −1200 wird |
|---|---|---|---|---|
| der Entwurf selbst | 13 | 9,7 mm | 31,0 mm | |
| nichts gehalten | 11 | 6,3 mm | 21,1 mm | −1349, R 190 wird 190,5 |
| Weichen gehalten | 13 | 8,1 mm | 22,2 mm | −1326 |
| Radien gehalten | 11 | 8,9 mm | 30,5 mm | −1200 |
| Weichen und Radien gehalten | 13 | 8,9 mm | 30,5 mm | −1200 |

Unter den Vorgaben des Entwurfs (Weichen und runde Radien) gewinnt der
Fit 0,8 mm gegen ihn: die Zwischengerade vor R −1200 wird 13,8 m statt
10,0 m, der Bogen 41,5 m statt 44,2 m. Die ersten sieben Punkte hinter der
ersten Weiche liegen in allen gehaltenen Fällen im Mittel 15,6 mm
einseitig neben der Achse; das ist der Preis der Weiche, nicht des Fits.
Der größte Rest (30 mm) sitzt an einem Bogenanfang ohne Übergangsbogen.

Nicht gebaut: der Leser für die Punktdatei `.pt` (die Datei wird
abgewiesen, die Punkte wurden von Hand umgesetzt), Radien einzeln halten,
Voreinstellungen für Toleranz und Geschwindigkeit eines Bahnhofsgleises,
Gradiente und gemessene Überhöhung.

## Die Geschwindigkeit als Annahme (2026-11-06)

Ohne Vorgabe nahm der Adapter das schnellste Hauptbahn-Profil, das die
Trasse zulässt: für das Bahnhofsgleis V 80, ohne ein Wort dazu, und mit
6 von 7 Bögen über dem zulässigen Fehlbetrag. Plausibel sind dort 40 km/h,
und der Grund steht in der Trasse selbst: sie läuft durch den Zweig einer
EW 190-1:9, und Ril 800.0120A01 lässt dort 40 km/h zu.

Der Adapter leitet das jetzt ab und sagt es (`report.input.speed`):

- `given`: die Geschwindigkeit des Aufrufers.
- `turnout`: nicht vorgegeben, die Trasse zeigt Weichen; angenommen wird,
  was die langsamste im Zweig zulässt, ob gehalten oder nicht.
- `profile`: nicht vorgegeben, keine Weiche; wie bisher das schnellste
  Hauptbahn-Profil.

Dazu nennt der Bericht, was die Bögen selbst zulassen
(`cant.admissibleSpeedKmh`, `cant.limitingArc`): die Geschwindigkeit, bei
der der engste Bogen mit der Überhöhung, die er trägt, den zulässigen
Fehlbetrag erreicht. Am Bahnhofsgleis sind das 45 km/h (R 190 ohne
Überhöhung); die Annahme 40 liegt darunter. CLI und App zeigen beides und
verweisen auf `--speed` beziehungsweise das Feld Entwurfsgeschwindigkeit.

Gemessen am Bahnhofsgleis, Weichen gehalten: die Geometrie ist für V 25
bis V 80 dieselbe (rms 8,9 mm mit, 8,1 mm ohne gehaltene Radien). Es ändert
sich nur das Urteil über den Fehlbetrag: kein Bogen darüber bis V 40, einer
bei V 50, sechs von sieben ab V 60. Der Grund: das Hauptbahn-Profil hat in
diesem Bereich feste Schranken (Mindestradius 300 m, Mindestlänge 20 m),
und was die Datei kürzer oder enger hat, wird als Ausnahme übernommen und
darf nicht kürzer werden. Drei Zwischengeraden liegen auf dieser Schranke
(10,00 m, 18,60 m, 17,55 m). Ein Regelwerk für Bahnhofsgleise hat der
Adapter nicht; das bleibt offen.

## Der Ladefehler des Rechenprogramms (2026-11-06)

Die ausgelieferte App (nicht die Einzeldatei) meldete gelegentlich beim
ersten Lauf nur „Der Rechenlauf ist abgestürzt.“, ohne Grund. Gerechnet
hatte sie da noch nichts. Der Worker ist ein Modul und holt sein Skript
und 67 Module einzeln vom Server; kommt eine dieser Anfragen nicht an,
stirbt er, bevor er rechnet, und die Seite bekommt ein Fehlerereignis ohne
Text.

Ausgelöst hat es der Testserver: `python3 -m http.server` nimmt höchstens
5 wartende Verbindungen an und schließt nach jeder Antwort, der Browser
öffnet 6 zugleich. Gemessen am Bahnhofsgleis, 60 Läufe ohne Cache: mit
Warteschlange 5 stürzten 34 ab, mit Warteschlange 128 keiner. Im
Serverprotokoll fehlte den abgestürzten Läufen jeweils eine Moduldatei.
Die frühere Erklärung „Last durch die Testsuite“ war damit nur ein
Begleitumstand: Last macht den Server langsamer, die Ursache ist die
Warteschlange.

Die App trennt das jetzt (`src/services/axtran2/workerRun.js`):

- Fehlerereignis ohne Text, bevor der Worker `ready` gemeldet hat: das
  Skript kam nicht an. Der Start wird wiederholt, bis zu vier Mal in allem,
  mit wachsender Pause; jeder Versuch bekommt seine eigene Kopie der
  TRA-Bytes. Die Statuszeile sagt es, und das Ergebnis nennt den Versuch.
- Bleibt es dabei: „Das Rechenprogramm ließ sich nicht laden …“, mit dem
  Hinweis, dass nichts gerechnet wurde und was zu tun ist.
- Fehlerereignis mit Text, oder nach `ready`: der Rechenlauf selbst. Er
  wird nicht wiederholt (ein langer Lauf startet nicht ungefragt neu) und
  mit Text und Stelle gemeldet.

Gegen denselben schwachen Server, 60 Läufe: 42 im ersten Anlauf, 17 nach
dem zweiten bis vierten, einer gab nach vier Versuchen mit der klaren
Meldung auf. Die Einzeldatei trägt den Worker als Text in sich und lädt
nichts nach; dort kann der Fehler nicht entstehen.

Nebenbei: der Knopf Optimieren wird jetzt gesperrt, bevor die Dateien
gelesen werden. Vorher konnte ein zweiter Klick in dieser Lücke einen
zweiten Lauf starten, und der erste blieb ohne Antwort hängen.

## Das Bild und die Schlösser (2026-11-07)

Das Haltefeld (`hold`) war bis hier ein Textfeld mit Satznummern. Was es
hält, sah man erst im Bericht. Die App zeigt jetzt die Trasse als Bild und
macht das Halten zum Klick (`src/services/axtran2/alignmentPicture.js`,
reine Funktion wie das Residuenbild: Bericht rein, SVG raus).

Das Bild hat drei Zeilen über einer Stationsachse:

- oben je Satz ein Schloss, offen oder geschlossen, in zwei Reihen, sobald
  die Spalte schmaler als 9 px wird; darunter die Satzspalten, gehaltene
  Sätze hinterlegt. Ein verschmolzenes Element trägt mehrere Sätze; jede
  Satzspalte bekommt vom Element den Anteil, den der Satz vorher an der
  Länge hatte.
- die Krümmung als 1000/R, Entwurf und Fit übereinander; der Übergangsbogen
  läuft zwischen den Krümmungen seiner Nachbarn.
- die Punkte: Querabstand vorher und nachher, Toleranzband. Der Maßstab ist
  das Größere aus 1,5 Toleranzen und dem größten Rest nach dem Fit; liegt
  der Entwurf weiter als das Vierfache davon neben den Punkten, wird er
  nicht gezeichnet und das Bild sagt es.

Die Maus zeigt Station, Satz (Typ, Länge, gehalten oder frei) und den
nächsten Punkt mit vorher → nachher als Text unter dem Bild. Breiter wird
das Bild über 1×, 2×, 4×, 8× in der Spalte scrollbar; Schrift und Schlösser
behalten ihre Größe, das Bild wird neu erzeugt, nicht gestreckt.

Ein Klick auf ein Schloss schreibt das Haltefeld (`formatHold`, die Umkehr
von `parseHold`: „1-2, 7, 13“) und rechnet neu, wenn der letzte Lauf
höchstens 3 s brauchte; sonst merkt er das Schloss vor und sagt, dass
Optimieren rechnet. Weist der Kern das Schloss ab (`NOTHING_FREE`,
`OVER_CONSTRAINED`), nimmt die App es zurück und lässt das letzte Ergebnis
stehen: „Das Schloss wurde nicht gesetzt: mit ihm bliebe zu wenig frei, um
Anfang und Ende der Trasse noch zu treffen.“ Das Haltefeld bleibt die eine
Wahrheit; das Bild liest es, der Bericht nennt es.

Dafür sagt der Bericht (`fit-tra/0.10`) je Element seine Sätze
(`elements[].records`) und je Satz der Datei Typ, Länge, Radius, Element,
Haltegrund und Weiche (`planRecords`).

Gemessen am Bahnhofsgleis, 1240 px breit: 12 Schlösser in einer Reihe
(13 bei 2×), Klick auf Satz 7 → Feld „1-2, 7, 13“, Lauf 0,1 s, Text „Station
322,8 m · Satz 7 Gerade, 426,87 m, gehalten · Punkt 4130: −3,2 mm →
−2,3 mm“. Satz 11 und 12 zusätzlich zu halten weist der Kern ab, die App
nimmt es zurück. Auf der Eifel-Trasse 2631R139 (109 Sätze, 52
Übergangsbögen, 11,3 km, Vorführung mit Plan 120 m ab) zeichnet das Bild
bei 1200 px alle 109 Spalten und die Schlösser der 54 breiten; die Punkte
des Plans bleiben weg, und das Bild sagt es.

Nicht gebaut: Länge und Radius einzeln halten (der Kern kennt die Rollen je
Größe schon, die App reicht sie nicht durch), eine Elementliste zum
Bearbeiten, Bloss als Übergangsbogen im Kern.

## Länge oder Radius halten, und die Satzliste (2026-11-08)

Der Schalter „Radien halten“ hielt alle Radien, ein Schloss einen Satz mit
Länge und Radius. Dazwischen fehlte der Zugriff, den der Trassierer braucht:
die Länge eines Satzes halten (ein Weichenelement, eine Bauwerkslänge) und
den Radius freigeben, oder umgekehrt. Der Kern kannte die Rollen je Größe
schon (`length` und `curvature` je Element, `held` oder `free`); die App
reichte sie nicht durch.

Jetzt sagt das Haltefeld, was gehalten wird: `7` Länge und Radius, `7L` nur
die Länge, `7R` nur den Radius, auch als Bereich (`3-5L`), und `Weichen`
wie bisher als Ganzes (`heldRecords` 0.4, `parseHold`/`formatHold`). Ein
Satz, der in einer Größe gehalten ist, behält sein eigenes Element, die
Satzgrenze bleibt in der geschriebenen Datei. `7R` auf einer Geraden wird
abgewiesen: sie hat keinen Radius. Der Bericht (`fit-tra/0.11`) führt je
gehaltenem Satz `length` und `radius`, je Satz der Datei `heldLength` und
`heldRadius`.

Im Bild trägt ein Bogen, der breit genug ist (30 px), zwei Schlösser, L und
R; eine Gerade, ein Übergangsbogen und ein schmaler Bogen eines für das
Ganze, halb gefüllt, wenn nur eine Größe gehalten ist. Eine Weiche hat ein
Schloss: sie ist Kataloggeometrie und wird als Ganzes gehalten.

Unter dem Bild steht die Satzliste (`src/services/axtran2/recordList.js`):
jeder Satz der Datei mit Typ, Weiche, Länge und Radius vor und nach dem Fit
(fett, was sich geändert hat), je Größe ein Kästchen und der Stand. Die
Kästchen schreiben dasselbe Haltefeld wie die Schlösser; Liste, Bild und
Feld zeigen einen Zustand.

Beobachtet auf der erfundenen Bahnhofstrasse der Tests: `6L` (Bogen R 500,
Länge 0,5 m zu lang gehalten) gibt R 504 und trifft die Punkte; `4L` auf dem
ersten Bogen hinter der Weiche lässt der Löser bei R 300 stehen und meldet
`converged` mit 7 mm rms, obwohl die Variable frei ist (numerische
Ableitung: dasselbe). Das ist Löserverhalten im Kern und hier nicht
geändert; der Test hält Satz 6.

Nicht gebaut: Werte editieren (Länge, Radius als Startwerte ändern) und
Bloss als Übergangsbogen im Kern; die nächsten Stufen.

## Werte ändern (2026-11-08)

Halten sagt dem Fit, was er nicht anfassen darf. Was fehlte, war der andere
Griff des Trassierers: einen Wert selbst setzen, eine Länge auf das runde
Maß, einen Radius auf den der Nachbartrasse, und von dort aus rechnen
lassen. Dafür steht jetzt das Feld „Werte ändern“ und, in der Satzliste,
die Planwerte als Felder.

Die Schreibweise ist die der Schlösser (`src/services/axtran2/recordEdits.js`):
`7L=45,2` die Länge von Satz 7, `7R=-1250` sein Radius mit dem Vorzeichen
der Datei, mehrere mit Leerzeichen; `parseEdits`/`formatEdits` sind
zueinander invers, das Dezimalkomma wird gelesen. Geprüft wird gegen die
Datei: der Satz muss da sein und eine Länge tragen, eine Länge ist positiv,
ein Radius gehört zu einem Bogen und ist nicht null (`INVALID_EDIT`).

Der Fitter (`fit-tra/0.12`) liest die Datei wie bisher und setzt die
geänderten Werte in die Elemente, bevor die Startlage gebaut wird. Ein
geänderter Satz bleibt, wie ein gehaltener, sein eigenes Element: die
Satzgrenzen um ihn überleben. Die Datei selbst bleibt unverändert; der
Bericht nennt `input.edits` und je Satz `fileLength`, `fileRadius`,
`edited`, während `length` und `radius` das sind, womit der Fit begann.
Eine Änderung hält nichts: `7L=45,2` mit `7L` startet bei 45,2 m und
behält es; ohne das Schloss darf der Fit den Wert wieder verschieben.

In der Liste steht der Planwert als Feld; getippt und mit Enter oder
Verlassen bestätigt, schreibt er das Feld „Werte ändern“, und der Fit
rechnet neu, wenn der letzte Lauf kurz war (sonst Vormerkung, gestrichelt).
Ein geänderter Wert ist markiert und nennt den Wert der Datei; derselbe
Wert wie in der Datei löscht die Änderung. Weichen haben kein Feld: sie
sind Kataloggeometrie. Ein Wert, den der Fit nicht annehmen kann, geht
zurück, mit der Meldung, warum.

Nicht gebaut: Bloss als Übergangsbogen im Kern (Stufe 4, Kern-Go), das
Einfügen oder Entfernen von Sätzen, Werte an Weichen.

## Klothoide nach Bloss (2026-11-08)

Der Typ eines Übergangsbogens ist ein Wert wie seine Länge: `9T=Bloss` im
Feld „Werte ändern“, in der Satzliste eine Auswahl neben dem Typ. Zur
Wahl stehen Klothoide, Bloss und S-Form (Helmert), die drei, die der
TRA-Schreiber als Kz 2, 4 und 3 trägt; ein Halbwellen-Übergang (Kz 8)
behält seinen Typ. Der Fitter setzt die Familie des Elements vor der
Startlage; der Kern kennt die Familien aus seiner Registry (Momenten-
tafel je Familie), darum war dafür keine Kernänderung nötig. Der Bericht
führt je Übergangsbogen `family` (womit der Fit begann) und `fileFamily`.

Im Krümmungsband läuft der Übergangsbogen jetzt entlang seines Gesetzes:
die Klothoide als Gerade, der Bloss als 3u²−2u³, die S-Form als zwei
Parabeln; der Text unter dem Bild nennt den Typ. Geprüft auf einer
erfundenen Trasse, deren Gleis ein Bloss ist, während der Plan eine
Klothoide sagt: mit `2T=Bloss` trifft der Fit die Punkte enger, die
geschriebene Datei liest sich als Bloss zurück.

Nicht gebaut: Sätze einfügen oder entfernen, Werte und Typ an Weichen,
weitere Familien der Registry (Wiener Bogen, Sinusoide) im Schreiber.

## Sätze herausnehmen und einfügen (2026-11-08)

Der letzte Griff an der Satzliste: ein Satz geht heraus, ein neuer hinein.
Im Feld „Werte ändern“ heißt das `-5` und `+3=G:20` (nach Satz 3 eine
Gerade von 20 m; `B:-500:30` ein Bogen mit dem Vorzeichen der Datei,
`U:40:Bloss` ein Übergangsbogen), in der Liste ein − und ein + je Zeile;
unter dem + öffnet sich eine Zeile mit Art, Länge, Radius oder Typ.
Eingefügte Sätze heißen nach dem Satz, dem sie folgen, `3+1`, `3+2`; ihre
Werte sind Felder wie die der anderen, ihr − nimmt sie wieder heraus. Ein
herausgenommener Satz bleibt durchgestrichen stehen, ↩ holt ihn zurück.

Was bleibt (`src/services/axtran2/editedElements.js`): der erste und der
letzte Satz (Anfang und Ende der Trasse stehen darauf), die Sätze einer
Weiche, ein Knick; nichts vor dem ersten, nichts hinter dem letzten; und
keine zwei Übergangsbögen nebeneinander, weil der Kern die Enden eines
Übergangsbogens an seinen Nachbarn liest. Ein gehaltener oder geänderter
Satz kann nicht zugleich herausgenommen sein.

Die Datei behält ihre Sätze und Nummern; der Fit beginnt mit der
geänderten Folge. Gleiche Nachbarn, die durch das Herausnehmen
aneinanderstoßen, werden wieder ein Element, wie der Leser es hält. Die
Spanne eines herausgenommenen Satzes in der Datei trägt das Element davor
weiter (`fileSpan`), ein eingefügtes hat keine: so finden Kilometersprünge
und Überhöhungen ihren Platz weiter nach dem Abstand in der Datei, auch
wenn die Folge eine andere ist. Der Bericht (`fit-tra/0.14`) nennt
`input.structure` (herausgenommen, eingefügt mit Schlüssel und Element)
und führt eingefügte Sätze unter ihrem Schlüssel in `planRecords`; sie
haben kein Schloss, weil das Haltefeld die Sätze der Datei nennt.

Nicht gebaut: Werte und Typ an Weichen, das Einfügen ganzer Weichen aus
dem Katalog, weitere Familien der Registry im Schreiber.

## Die Punktliste .pt (2026-11-08)

Die Ist-Gleislage kam bisher als CSV; die Datei aus Verm.esn heißt `.pt`
und wurde abgewiesen (die Punkte des Bahnhofsgleises wurden von Hand
umgesetzt). Jetzt liest der Punktleser sie direkt
(`src/services/axtran2/ptListing.js`, eingehängt in `parsePointList`):
die Titelzeile `EB:`, die Vorlagenzeile, die die Spalten mit Buchstaben
markiert (`PPPP` Nummer, `YYYY.YYYY` Rechtswert, `XXXX.XXXX` Hochwert,
`HHHH` Höhe, `DDDD` Datum, `FFFF%` Text bis zum Zeilenende), dann je
Zeile ein Punkt in diesen Spalten. Die Spalten kommen aus der Vorlage,
darum übersteht ein Name mit Leerzeichen; eine Zeile, die nicht in die
Spalten passt, wird nach Worten in der Reihenfolge der Vorlage gelesen,
eine Liste ohne Vorlage ganz so. Y ist der Rechtswert, X der Hochwert,
wie bei der Kopfzeile `Y X` der CSV; F wird zur Bemerkung, die Höhe
reist als `height` mit, ohne dass der Fit sie ansieht. Zwangspunkte
kommen nicht so: eine `.pt` trägt keinen Abstand und wird dafür
abgewiesen.

Geprüft an der Datei des Bahnhofsgleises: 77 Punkte, dieselben
Koordinaten und Bemerkungen wie die von Hand umgesetzte CSV; der Fit
darauf ist derselbe.

## Weichen aus dem Katalog einfügen (2026-11-08)

Was die Erkennung seit dem 6. November in der Datei findet, lässt sich
jetzt auch hineinsetzen: eine einfache Weiche der Ril 800.0120A01 als ihr
Zweig. Im Feld „Werte ändern“ heißt das `+3=W:190-1/9:R`: nach Satz 3 die
EW 190-1:9, der Zweig nach rechts, zuerst der Zweigbogen (R, Länge
R·atan(1/n)), dann das gerade Endstück d, das der Anhang nennt (das Gleis
kommt am Weichenanfang an); `:L` legt den Zweig nach links, `:WE` setzt
das Endstück voran (Ankunft am Weichenende), `:Bogen` lässt es weg. Eine
Bauart ohne Endstück im Anhang (EW 300-1:9) ist nur der Bogen. In der
Liste bietet die Eingabezeile unter dem + die Art „Weiche“ mit Bauart (und
der zulässigen Geschwindigkeit im Zweig), Zweigseite und Lage.

Die beiden Sätze heißen `3+1a` und `3+1b` und sind gehalten, wie eine
Weiche gehalten ist: Kataloggeometrie, ohne freie Größe, ohne Schloss und
ohne Felder; das − an einer der beiden Zeilen nimmt die Weiche wieder
heraus. Der Bericht führt sie unter `input.turnouts` neben den erkannten
(`inserted` mit Stelle und Lage) und in `input.structure.turnouts`; die
Geschwindigkeitsannahme nimmt sie wie eine erkannte Weiche: eine
eingefügte EW 190-1:9 heißt V 40, wenn nichts vorgegeben ist. Das Wort
„Weichen“ im Haltefeld darf stehen, auch wenn die Datei keine hat.

Nicht gebaut: Kreuzungsweichen (EKW/DKW) und Bogenweichen aus dem
Katalog, der Einbau in den Stammgleis-Strang (dort ist die Weiche eine
Gerade), Werte und Typ an Weichen.

## Kreuzungsweichen und Bogenweichen (2026-11-08)

Zwei Griffe mehr am Einfügen, beide aus dem, was der Kern schon konnte
(`TurnoutCatalogue.crossing`, `crossingElement`, `bentOnto`):

- **Kreuzungsweiche** `+7=K:DKW:190-1/9:R`: die Fahrt durch eine EKW oder
  DKW der Ril 800.0120A01 als ein Satz. Die Bogenfahrt ist der
  Verbindungsbogen R·atan(1/n) auf das kreuzende Gleis (rechts oder `:L`),
  `:gerade` die gerade Fahrt über die Kreuzung, 2R·tan(α/2) zwischen den
  Tangentenpunkten. Zulässig ist im Bogen die Zweiggeschwindigkeit des
  Anhangs (40 km/h bei 190-1:9), geradeaus die des Stammgleises (100); die
  Annahme der Geschwindigkeit nimmt die eingefügte Fahrt wie eine erkannte
  Weiche. Welche Diagonale die EKW krumm hat, weiß der Plan, nicht die
  Bezeichnung; von einem Ende her liest sich die Fahrt gleich.
- **Bogenweiche** `+7=W:190-1/9:R:auf-800`: dieselbe EW, auf ein
  Stammgleis mit R −800 (Vorzeichen der Datei) gebogen. Die Krümmung des
  Zweigs ist die der Weiche plus die der Strecke: gleicher Drehsinn ergibt
  die Innenbogenweiche (enger), entgegengesetzter die Außenbogenweiche (der
  Zweig kann gerader werden als die Strecke oder anders herum drehen). Die
  Bogenlänge bleibt die der geraden Weiche, das Endstück folgt dem Zweig.
  Der Anhang nennt für gebogene Weichen keine Zeile, darum trägt die
  Bogenweiche keine Zweiggeschwindigkeit; die Annahme fällt auf das Profil
  zurück und sagt es.

In der Liste bietet die Eingabezeile die Art „Kreuzungsweiche“ (Bauart mit
beiden Geschwindigkeiten, Fahrt, Seite des kreuzenden Gleises) und bei der
Weiche das Feld „auf Stammgleis R“. Die Sätze heißen wie bisher (`7+1`,
`7+1a`/`7+1b`), sind gehalten und ohne Schloss; `input.turnouts` nennt
`kind` (EW, IBW, ABW, EKW, DKW), die Fahrt und die Biegung.

Nicht gebaut: Bogenweichen mit zwei Zweigradien des Anhangs (keine Zeile
mit `radiusEnd` ist eine einfache Weiche), Kreuzungen (Kr) ohne Weiche,
Werte und Typ an Weichen.

## Weichen mit zwei Zweigradien (2026-11-08)

Der Anhang führt zwei Weichen, deren Zweig aus zwei Radien besteht: die
EW 60-7000/6000-1:42 und die EW 60-6000/3700-1:32,5 (beide fb, Zweig 200
bzw. 160 km/h). Bisher wies `heldRecords` sie ab, und der Kern hält sie
nicht (`COMPOUND_BRANCH`). Jetzt sind sie Bauarten wie die anderen:

- **Geometrie aus den Tangentenlängen.** Der Anhang nennt lt (vom
  Weichenanfang bis zum Schnitt der Anfangs- mit der Endtangente) und lt2
  (von dort bis zum Weichenende). Mit R1, R2 und dem Kreuzungswinkel
  α = atan(1/n) bleibt nur der Winkel α1 des ersten Bogens frei; er ist so
  gewählt, dass die erste Tangente lt trifft (`compoundBranch`, Bisektion),
  der zweite Bogen dreht den Rest. Die Probe an lt2: bei der 7000/6000
  stimmt sie auf 0,1 mm (Bögen 80,00 m und 74,26 m), bei der 6000/3700
  bleibt ein Rest von 0,31 m (`tangentResidual` der Bauart) – ihr Zweig
  hat vermutlich einen Übergang zwischen den Radien, den die Spalten des
  Anhangs nicht tragen. Annahme: zwei reine Kreisbögen (21,20 m R 6000,
  100,74 m R 3700), der Rest steht an der Bauart und im Bericht.
- **Einfügen** `+7=W:7000/6000-1/42:R`: zwei Sätze `7+1a` (R1) und `7+1b`
  (R2), beide gehalten, `part` „arc“ und „arc2“; mit `:WE` läuft der Zweig
  rückwärts (R2 vor R1, ein Endstück voran). Ein Endstück hat der Anhang
  für diese Bauarten nicht; wo es eines gibt, heißt der dritte Satz `7+1c`.
  `:auf-800` biegt beide Bögen um die Streckenkrümmung (`bent.branchRadii`).
- **Erkennen** in der Datei: zwei benachbarte Bögen gleichen Drehsinns mit
  den beiden Radien und Längen sind die Weiche, in beiden Reihenfolgen;
  `turnouts[].arcs` nennt die Sätze, `arc` den des ersten Radius.
- Die Liste bietet beide Bauarten in der Auswahl; `input.turnouts` trägt
  `radiusEnd` und `arcs`.

Nicht gebaut: Kreuzungen (Kr) ohne Weiche, Werte und Typ an Weichen,
Klothoiden im Zweig (der Kern kennt im Zweig nur Bögen).

## Kreuzungen ohne Weiche (2026-11-09)

Der Anhang führt zwei Kreuzungen mit starrem Doppelherzstück, Kr 1:9
(lw 33,23 m, 100 km/h) und Kr 1:7,5 (26,50 m, 80 km/h). Eine Kreuzung
hat keinen Zweig: zwei gerade Gleise schneiden sich unter 1:n, und das
Gleis durch sie ist die Gerade von Kreuzungsanfang bis -ende, das lw des
Anhangs.

- `+7=K:Kr:1/9` setzt diese Gerade als Satz `7+1` ein, gehalten, ohne
  Seite und ohne Fahrt (beides hat die Kreuzung nicht); zulässig ist das
  V des Anhangs, und die Geschwindigkeitsannahme nimmt sie wie eine
  erkannte Weiche. `input.turnouts` nennt `kind` „Kr“, `radius` null,
  `route` „straight“, `side` null.
- In der Liste steht die Kreuzung in der Auswahl der Kreuzungsweichen;
  Fahrt und Seite werden für sie nicht gelesen.
- Nicht erkannt wird sie in der Datei: eine Gerade von 33,23 m ist keine
  Kreuzung, nur weil sie so lang ist. Wer eine hat, hält den Satz oder
  fügt die Kreuzung ein.

Nicht gebaut: Werte und Typ an Weichen (der nächste Abschnitt), Klothoiden
im Zweig (der Kern kennt im Zweig nur Bögen).

## Typ und Werte an Weichen (2026-11-09)

Die Erkennung sagt, welche Weiche sie in der Datei sieht; bisher war das
nicht zu widersprechen, und eine Weiche hatte keine Felder. Jetzt ist der
Typ einer Weiche ein Wert wie die Länge eines Satzes
(`src/services/axtran2/recordEdits.js`, `heldRecords.js`):

- **Umtypen** `3W=300-1/9`: Satz 3, der Bogen des Zweigs, ist eine
  EW 300-1:9. Die dort erkannte Weiche wird ersetzt; Radius (mit dem
  Vorzeichen der Datei), Zweiglänge R·atan(1/n) und das Endstück d sind
  von da an die des Katalogs (`declareTurnouts`). Ein Typ ohne Endstück
  im Anhang (die 300-1:9) gibt das Endstück frei: der Satz ist wieder
  eine Gerade der Datei mit Feldern.
- **Erklären**: derselbe Satz auf einem Bogen, den die Erkennung nicht
  für eine Weiche hielt (Länge mehr als 2 mm daneben, oder gebogen), macht
  ihn zu einer. Das Endstück ist die Gerade daneben, wenn ihre Länge ein d
  des Typs ist; `:WA` oder `:WE` nennen den Satz dahinter oder davor
  ausdrücklich, `:Bogen` keinen. Bei zwei Zweigradien ist der zweite Bogen
  der Nachbar gleichen Drehsinns.
- **Biegen** `:auf-800`: jeder Bogen des Zweigs um die Streckenkrümmung,
  wie beim Einfügen (`bentOnto`, IBW/ABW); ein Endstück, das in der Datei
  ein Bogen ist, folgt, eine Gerade bleibt eine. Die Bogenweiche trägt
  keine Zweiggeschwindigkeit (keine Zeile im Anhang).
- **Aufheben** `3W=keine`: dort ist keine Weiche; die Sätze behalten die
  Werte der Datei und bekommen ihre Felder.

Der Fit (`fit-tra/0.17`) rechnet mit der erklärten Liste: das Wort
„Weichen“ hält, was erklärt ist, und nicht mehr, was aufgehoben ist; die
Katalogwerte sind Startwerte wie andere Änderungen, gehalten wird mit dem
Schloss. Der Bericht nennt an `input.edits` den Typ (`turnout`, null für
„keine“), an `input.turnouts` `declared` (Satz, was erkannt war, Biegung),
die aufgehobenen unter `input.releasedTurnouts`; `planRecords` tragen
`fileTurnout`, auf dem Bogen des Zweigs `turnoutRef` und `turnoutMain`.

In der Liste ist die Spalte Weiche auf jedem Bogen der Datei eine Auswahl:
der erkannte Typ, ein anderer aus dem Katalog, – für keine; daneben das
Feld „auf R“ für das Stammgleis. Eine Wahl, die von der Erkennung
abweicht, ist markiert und nennt, was erkannt war; die Sätze einer Weiche
haben weiter keine Felder für Länge und Radius – ihre Werte sind der Typ.

Geprüft auf der erfundenen Bahnhofstrasse der Tests: `1W=300-1/9` setzt
Satz 1 auf R 300 und 33,20 m und gibt Satz 2 (6,09 m) als Gerade frei;
`1W=keine` nimmt die EW 190-1:9 aus der Liste; `4W=190-1/9` macht den
freien Bogen R 300 (39,5 m) zur Weiche, mit „Weichen“ gehalten.

Nicht gebaut: Klothoiden im Zweig (der nächste Abschnitt), das Endstück
einer Datei-Weiche von Gerade zu Bogen wechseln (ein Satz behält seinen
Typ).

## Klothoiden im Zweig (2026-11-09, Kern-Go)

Die Probe am 8. November ließ bei der EW 60-6000/3700-1:32,5 einen Rest
von 0,31 m an der zweiten Tangentenlänge: zwei reine Kreisbögen treffen
die Spalten des Anhangs nicht. Jetzt löst der Kern die beiden Längen mit
einer Klothoide zwischen den Radien (`TurnoutCatalogue.compoundBranch`,
Version 0.3): der Winkel des ersten Bogens trifft lt, die Länge der
Klothoide lt2, beides durch Bisektion, die Klothoide nach ihrem
Krümmungsgesetz (Simpson). Das Ergebnis ist eindeutig und spricht für
sich: der erste Bogen hat die Länge null – der Zweig **beginnt am
Weichenanfang mit der Klothoide von R 6000 auf R 3700**, 44,00 m, dann
folgt der Bogen R 3700 mit 78,24 m; beide Tangentenlängen stimmen auf
0,1 mm. Das ist die Klothoidenweiche, die der Anhang in seinen Spalten
nicht nennt und deren zwei Zahlen sie doch festlegen. Die 7000/6000
braucht keine Klothoide (zwei Bögen auf 0,1 mm).

- **Kern.** `turnout()` nimmt die Doppelradien an (`radiusEnd`, auch aus
  der Zeile des Anhangs oder aus der Bezeichnung `EW 60-7000/6000-1:42`),
  liefert `branchParts` (Bogen, Klothoide, Bogen), `curvatureEnd`,
  `transitionLength`, `tangentResidual`; `COMPOUND_BRANCH` gibt es nicht
  mehr. `bentOnto` biegt beide Krümmungen, die Klothoide bleibt eine.
  `turnoutElements` gibt `branchParts` als gehaltene Elemente, darunter
  einen Bogen der Länge null: der Kern liest die Krümmungen eines
  Übergangsbogens an seinen Nachbarn ab, und ein Zweig, der mit einer
  Klothoide aus R 6000 beginnt, braucht den Nachbarn, der diese Krümmung
  trägt. Das ist dasselbe Mittel, mit dem der Leser seit Oktober zwei
  aneinanderstoßende Übergangsbögen trennt.
- **Leser** (`traAlignment.js`). Der Krümmungsträger steht jetzt überall,
  wo R1 oder R2 eines Übergangsbogens nicht die Krümmung des Nachbarn ist
  – nicht nur zwischen zwei Übergangsbögen. Das war überfällig: zehn
  Dateien des Korpus, die der Kern bisher am Ende um 0,11 bis 104,5 m
  verfehlte (Eifel, Landshut, Büchen, 6100 RE/KM), erreichen ihr
  aufgezeichnetes Ende jetzt auf 0,1 mm; keine andere Datei ändert sich.
  Der Satzauszug (`records`) trägt an Übergangsbögen `radiusStart` und
  `radiusEnd`. Befund dazu: dieselben zehn Dateien weist der Import der
  App (`buildSparseFromLandFAT`, „inconsistent TRA-like radius“) ab – der
  Vertragstest nimmt sie darum aus dem Vergleich beider Leser heraus; den
  App-Import anzufassen ist ein eigener Auftrag.
- **Einfügen** `+1=W:6000/3700-1/32,5:R`: drei Sätze `1+1a` (Anfangs-
  krümmung, 0 m, R 6000), `1+1b` (Klothoide 44,00 m), `1+1c` (Bogen R 3700
  78,24 m), alle gehalten; `:WE` kehrt die Folge um. Die geschriebene Datei
  lässt den Satz von 0 m weg und trägt R1 6000 / R2 3700 an der Klothoide;
  gelesen steht der Träger wieder, und die Erkennung findet die Weiche.
- **Erkennen und Erklären** laufen über das Muster des Zweigs
  (`branchPattern`: die Teile mit Länge, vorwärts oder rückwärts); eine
  Klothoide der Datei muss nach Länge und – wo der Leser sie hergibt –
  nach R1/R2 passen. `3W=6000/3700-1/32,5` auf dem Bogen R 3700 erklärt den
  Übergangsbogen davor zur Klothoide der Weiche, wenn er in der Datei bei
  R 6000 beginnt; beginnt er woanders (etwa bei R 0 aus der Geraden), ist
  das kein Wertewechsel, sondern eine andere Geometrie, und wird abgelehnt
  – gebogen ebenso.

Nicht gebaut: das Endstück einer Datei-Weiche von Gerade zu Bogen wechseln
(der übernächste Abschnitt). Der App-Import für R1/R2 ungleich Nachbar
folgt im nächsten.

## App-Import: R1/R2 ungleich Nachbar (2026-11-09, Go)

Der Import der App (`buildSparseFromLandFAT`) las die Krümmung eines
Übergangsbogens bisher am Nachbarn ab und wies eine Datei ab, deren R1 oder
R2 nicht die Krümmung des Nachbarn war („inconsistent TRA-like radius“, die
Regel vom 31. Oktober). Der Befund vom Klothoiden-Auftrag zählt nach: **18
der 292 Korpusdateien** tragen so einen Übergangsbogen (Eifel, Landshut,
metroB, Hamburg/1234, 6100 RE/KM, Büchen), fast immer gegen einen Bogen oder
eine Gerade, einmal (metroB Gl 4) zwischen zwei Übergangsbögen. Der Import
las 274 Dateien, der Leser des Lösers seit dem 9. November alle 292.

Jetzt gilt im Import dasselbe wie im Leser: **die Datei hat recht.** Wo R1
oder R2 eines Übergangsbogens (TRA-artig, aufgelöst) von der Krümmung des
Nachbarn abweicht – über 1e-9 in der Krümmung, die Schranke des Lesers –,
setzt der Import einen Bogen der Länge null mit der Krümmung des
Übergangsbogens an die Naht (`meta.insertedBy: "traLikeJunction"`,
`junction: "start" | "end"`, `sourceIndex` des Übergangsbogens,
`zeroLength`). `enforceAlternation` stellt zwischen den Bogen der Datei und
den Träger die sofortige Krümmungsänderung (`immediate`), die die Datei
meint. Zwei Übergangsbögen, die zueinander passen, und ein Übergangsbogen
an einem Knick brauchen keinen eigenen Träger – dort bleibt der Träger der
Alternation, der seine Krümmung wie bisher in
`bindTraLikeEndpointCurvatures` bekommt. Was die Datei nicht hergibt,
bleibt abgewiesen: ein R1/R2, das keine Zahl ist („invalid TRA-like“).

Ergebnis: der Import liest alle 292 Dateien, der Endpunkt der App-Achse
trifft den aufgezeichneten Endpunkt der Datei in allen 18 Fällen auf
0,1 mm (vorher für die zehn, die der Leser erreichte: abgewiesen; für die
übrigen acht, darunter metroB und Hamburg/1234, hatte der Leser andere
Gründe). Der Vertragstest der beiden Leser (`tra-roundtrip-contract`)
nimmt keine Datei mehr aus dem Vergleich heraus. Für die Bedienung der App
ist der Träger ein gehaltener Satz der Länge null, wie ihn der Editor seit
dem 31. Oktober kennt (`zeroLength`): nicht änderbar, keine freie Größe.

Geändert: `src/import/build/buildSparseFromLandFAT.js` (`junctionHolders`,
`boundaryCurvature`, `JUNCTION_TOLERANCE`; der Bindeschritt überspringt
Nicht-Übergangsbögen); Tests in `test/import/tra-junction-curvature.test.mjs`
(die vier Fälle, die bisher „fail closed“ waren, tragen jetzt den Träger;
Geometrie der Naht; Toleranz; die Korpusdatei Landshut 5632R000-002 mit
Satz 5) und `test/axtran2/tra-roundtrip-contract.test.mjs` (Ausnahme
entfernt).

## Endstück Gerade→Bogen an Datei-Weichen (2026-11-09)

Bisher behielt ein Satz der Datei seinen Typ: wer die EW 190-1:9 der Datei
mit `1W=190-1/9:auf-800` auf das Stammgleis bog, bekam den Zweigbogen
gebogen (R 249,18 auf R −800), das Endstück aber blieb die Gerade der
Datei, 6,09 m – anders als beim Einfügen, wo das Endstück einer gebogenen
Weiche von Anfang an der Bogen mit dem Endradius des Zweigs ist
(`editedElements`). Jetzt ist der **Typ des Endstücks ein Wert der
Erklärung** wie seine Länge:

- `declareTurnouts` nimmt als Endstück eine Gerade oder einen Bogen gleichen
  Drehsinns der Datei (wo das Endstück erkannt war, wo `:WA`/`:WE` ihn
  nennen, oder wo die Länge ein d ist) und gibt ihm den Typ der Erklärung:
  **gebogen ein Bogen** mit dem Endradius des Zweigs über d, **gerade eine
  Gerade** von d – in beide Richtungen, auch ein Bogen der Datei wird wieder
  die Gerade der geraden Weiche. `values` trägt `type` (und am Bogen
  `radius`), die Weiche `endPieceType`.
- Der Fit (`fit-tra/0.19`) wechselt das Element: aus der Geraden der Datei
  ein Bogen mit der gegebenen Krümmung, aus dem Bogen eine Gerade; andere
  Wechsel (ein Übergangsbogen) lehnt er ab. `planRecords` tragen `fileType`
  und `edited.type`; ein Satz, der nicht mehr Bogen ist, hat `radius` null.
- Die Liste (0.9) zeigt den Typ markiert mit „In der Datei: Gerade“ (oder
  Bogen); die Felder bleiben weg, weil die Weiche gehalten ist. Die
  geschriebene Datei trägt den Satz mit dem neuen Kz; gelesen und als
  gerade Weiche erklärt, wird aus dem Bogen 6,09 m die Gerade zurück, und
  die Erkennung findet die EW 190-1:9 wieder.

Geprüft auf der erfundenen Bahnhofstrasse: `1W=190-1/9:auf-800` setzt
Satz 2 auf Bogen R 249,18, 6,09 m, gehalten; die zurückgelesene Datei hat
zwei Bögen; `1W=190-1/9` auf dieser Datei macht Satz 2 wieder zur Geraden,
und die Erkennung sieht die EW 190-1:9 auf 1–2.

Nicht gebaut: ein Endstück als Übergangsbogen (gibt es im Anhang nicht).
