# AXTRAN2: die Längenstufe reproduzierbar machen (2026-11-12)

Die Längenstufe der Stufenfolge (`solveAlignmentLexicographic`, Ziel
`accumulated-length` unter dem Korridor der Punkte) verlor ihr Urteil bei
rund vier von zehn kleinen Trassen je nach der letzten Stelle einer Eingabe
(`AXTRAN2_EXACT_RAMP_RULE_2026-11-10.md`, Abschnitt 7). Dieses Dokument hält
fest, woran das lag, was geändert ist und was gemessen wurde. Kern-Go von
Uwe am 12. November („Längenstufe stabilisieren“).

Der Dienst rechnet in der Voreinstellung die Ordnung „points“ ohne
Längenstufe; betroffen sind die Ordnungen „reference“, „strict“ und
„budget“.

## 1. Wie gemessen wird

Ein Lauf ist eine Stichprobe. Auf den Korpusplätzen 130–221 (92
Bahnhofsgleise, 7–33 Elemente) kippt eine Änderung der Punkttoleranz um
10 Pikometer 11 bis 15 Urteile, auf ein und demselben Löser. Jede Zahl
unten ist deshalb das Mittel aus sechs Rechnungen mit der Toleranz
0,15 m und 0,15 m ± 10, 20, 30 pm; daneben steht die Streuung. Ein
Unterschied zweier Löserstände zählt erst, wenn er deutlich über der
Streuung liegt.

Das gilt rückwirkend: die Vergleiche der Korrekturregeln vom 22. und
23. September (`AXTRAN2_LEXICOGRAPHIC_CORPUS_2026-09-10.md`, „225 gegen
227“, „ein Tausch von vierzehn“) waren Einzelläufe. Die großen Abstände
dort (209 oder 206 gegen 225) tragen, die kleinen nicht.

Der Korpusläufer nimmt dafür jetzt `--tolerance`
(`test/axtran2/corpus/runCorpus.mjs`).

## 2. Was los war

Die Spur ist auf jeder der 92 Trassen dieselbe:

1. **Der Ausflug.** Der Warmstart liegt tief im Korridor (rms 0,1). Der
   erste Schritt ist klein. Sein Teilproblem hält die Korridorzeile nicht
   und gibt für sie den Multiplikator null zurück; damit hat das nächste
   Modell entlang der Zeile keine Krümmung mehr (die Krümmung der Zeile
   geht mit dem Multiplikator des letzten Teilproblems in die Hesse-Matrix,
   μ · 2J'J/N). Die Länge ist linear – das Modell ist dann ein lineares
   Programm in den Richtungen, die die Punkte bestimmen, und sein Schritt
   läuft bis an den Rand der Region. Auf 90 von 92 Trassen stand die Stufe
   nach wenigen Schritten bei rms 3 bis 10; die Filterdecke (das
   Hundertfache) ließ es zu.
2. **Der Rückweg.** Achtzig bis zweihundert Schritte. Der Filter hat
   unterwegs Punkte mit kleiner Verletzung und größerer Länge gesammelt; ein
   kleiner Schritt zurück in den Korridor macht die Länge größer, ohne die
   Verletzung unter die gesammelten Werte zu bringen, und wird abgelehnt.
   Nur ein voller Schritt mit Korrektur zweiter Ordnung kommt durch.
3. **Der Zusammenbruch.** Die Liniensuche findet nichts, die Region
   halbiert sich Durchgang um Durchgang (im Mittel 1262 Halbierungen je
   Lauf über die 92 Trassen), bis das Teilproblem ganz entspannt
   zurückkommt und das Urteil `infeasible_subproblem` fällt. Die
   Wiederherstellung holt die Stelle in zwei bis fünf Schritten zurück –
   und setzt alles auf Anfang, auch den Multiplikator: der Ausflug beginnt
   von vorn. Nach zwei Wiederherstellungen ist die dritte nicht mehr
   erlaubt.

Welche Trasse dabei durchkommt, entscheidet die letzte Stelle.

Dazu ein zweiter, davon unabhängiger Verlust: eine Stufe, die mit
`merit_stationary` endet, stand an der relativen Zulässigkeit des Lösers
(Endpose 2e-8 bis 2e-7 m) und fiel am Tor der Stufenfolge (1e-8 m) durch.
`converged` und `objective_settled` schlossen vor dem Ende auf die
verlangte Genauigkeit, `merit_stationary` und der Nullschritt nicht – und
so enden die meisten Längenstufen.

## 3. Was geändert ist

Vier Änderungen, jede für sich gemessen (Plätze 130–221, sechs
Rechnungen, „mit Urteil“ = die Stufenfolge endet `converged`):

| Stand | mit Urteil von 92 | Streuung | Trassen mit schwankendem Urteil | Schritte der Längenstufe |
|---|---|---|---|---|
| origin/main (`2bd21b1`) | 76,7 | 2,1 | 33 | 19 106 |
| nur Filterdecke 1 | 83,0 | 1,9 | 24 | 18 039 |
| nur Krümmung gehalten (ab Beginn) | 86,5 | 1,4 | 13 | 16 768 |
| beides | 90,0 | 1,8 | 9 | 16 167 |
| dazu Schließen am Ende | 91,3 | 0,8 | 2 | 16 167 |
| **Endstand** (Krümmung erst nach Rückgabe gehalten, gesetztes Fenster) | **91,7** | **0,5** | **1** | **13 252** |

1. **Die Krümmung der Korridorzeile bleibt im Modell**
   (`AlignmentSQPSolver`, `corridorCurvature: "held"`, Voreinstellung).
   Hält ein Teilproblem die Zeile nicht, wiegt der letzte positive
   Multiplikator, den ein Teilproblem zurückgegeben hat. Die Länge hat kein
   inneres Optimum; wo der Korridor sie aufhält, ist die Zeile an der
   Antwort gehalten und ihr Multiplikator positiv. Bevor ein Teilproblem
   die Zeile je gehalten hat, gilt wie bisher der zurückgegebene Wert.
   `"multiplier"` ist das alte Verhalten.
2. **Die Filterdecke ist unter dem Korridor seine eigene Breite**
   (`filterCeiling: 1` für die Längenstufe statt 100): die Zeile ist
   rms² − 1, eine Verletzung von eins ist rms 1,41.
3. **Ein Urteil, das den Lauf beendet, schließt auf die verlangte
   Genauigkeit** (`solveSQP`): auch `merit_stationary` und der Nullschritt
   schließen jetzt wie `converged` auf `objectiveSettled.feasibility`. Die
   Wiederherstellung rechnet dabei unter den Schranken des aktuellen
   Schritts, nicht nur den erklärten: eine Rampenzeile, die als Schranke
   reist, sah sie sonst nicht (gemessen an der exakten Rampenregel: ein
   Übergangsbogen 1,1e-7 m unter seiner Rampenlänge).
4. **Eine Länge, die sich knapp neben den Bedingungen gesetzt hat, gilt
   als gesetzt** (`objectiveSettled.within`, für die Längenstufe 1e-5 – der
   Korridor bei rms 1,000005). Die Stufe kriecht am Korridor einige 1e-6
   außerhalb, und an der relativen Zulässigkeit des Lösers gemessen füllte
   sich das Fenster „ein Millimeter über zwanzig Schritte“ spät oder nie.
   Nach dem Schließen muss die Länge dort stehen, wo sie sich gesetzt
   hatte, sonst beginnt das Fenster neu.

## 4. Gemessen und nicht genommen

- **Krümmung von Beginn an gehalten** (Gewicht eins, bevor ein Teilproblem
  die Zeile je gehalten hat). Auf den Bahnhofsgleisen so gut wie der
  Endstand, aber: auf den 130 kleinsten Trassen (3–7 Elemente), wo
  Schranken die Länge aufhalten und der Korridor nie erreicht wird, kroch
  die Stufe unter einer Krümmung, für die sie keinen Beleg hatte – die
  2,5-fache Schrittzahl, und 252 von 778 Stufen endeten mehr als einen
  Millimeter zu lang (bis 6 mm). Und mit einem einseitigen Zwangspunkt
  neben dem Korridor (Neun-Elemente-Trasse) stand die Stufe ab Schritt 127
  an ihrer Antwort, kroch weiter und verließ sie bei 143: drei von sechs
  Rechnungen ohne Urteil. Mit dem Endstand: sechs von sechs, 69 Schritte.
- **Krümmung nur im Inneren des Korridors gehalten** (Schlupf über 1e-2):
  84,7 von 92 (Streuung 2,8) gegen 83,3 ohne – nichts. Der Gewinn liegt
  am Rand, nicht im Inneren.
- **Filterdecke 10** statt 1: 89,2 gegen 90,0, kein Unterschied; genommen
  ist die Zahl mit der Begründung.
- **Fenster 1e-4** statt 1e-5: halbe Schrittzahl, aber ein Zehntel der
  Stufen endet mehr als einen Millimeter zu lang.
- **Ohne das gesetzte Fenster** (Endstand sonst gleich): 90,7 von 92
  (Streuung 1,5, sechs schwankende Trassen), ein Zehntel mehr Schritte,
  keine Länge mehr als 0,7 mm anders.

## 5. Über den Korpus

Alter Stand origin/main `2bd21b1`, neuer Stand der Endstand; je sechs
Rechnungen, die mittleren Trassen je drei.

| Bereich | Trassen | mit Urteil alt | mit Urteil neu | schwankend alt / neu | Schritte der Längenstufe alt / neu |
|---|---|---|---|---|---|
| Plätze 0–129 (3–7 Elemente) | 130 | 129,7 | 130,0 | 1 / 0 | 1 760 / 1 652 |
| Plätze 130–221 (7–33 Elemente) | 92 | 76,7 | 91,7 | 33 / 1 | 19 106 / 13 252 |
| Plätze 222–252 (33–119 Elemente) | 31 | 30,7 | 30,7 | 1 / 1 | 7 308 / 4 126 |
| Plätze 130–221, strikte Ordnung | 92 | 76,7 | 91,7 | 33 / 1 | 19 106 / 13 252 |

Die erreichte Länge ist dieselbe: wo die Längenstufe in beiden Ständen
endet, ist der Unterschied im Median null; auf den Bahnhofsgleisen liegt
er bei acht von zehn Rechnungen innerhalb ±0,5 mm, und die größten
Ausschläge (−17 mm, +27 mm) sind so groß wie der Abstand zweier
Rechnungen des alten Standes auf derselben Trasse (27 mm). Auf den
kleinsten Trassen ist keine Stufe länger, zwölf von 778 sind 1 bis 2 mm
kürzer.

Was auf den Bahnhofsgleisen bleibt: Platz 213 (29 Elemente) verliert in
zwei von sechs Rechnungen die Längenstufe an eine zusammengefallene
Region nach 500 bis 650 Schritten.

Die dreizehn größten Trassen (ab 146 Elementen, je Stunden) werden
einmal gerechnet, nicht sechsmal; siehe Abschnitt 6.

## 6. Der ganze Korpus, ein Lauf

Ein Lauf über alle 266 Trassen mit dem Endstand
(`runCorpus.mjs --objectives lexicographic --ramp bound`), verglichen mit
dem Lauf von origin/main vom 11. November – beides Einzelläufe, also je
eine Stichprobe.

| Elemente | Trassen | mit Urteil alt | neu | Schritte der Längenstufe alt | neu |
| --- | ---: | ---: | ---: | ---: | ---: |
| 3–7 | 130 | 130 | 130 | 1 735 | 1 664 |
| 7–33 | 92 | 77 | 91 | 17 789 | 13 658 |
| 33–119 | 31 | 31 | 31 | 6 657 | 4 267 |
| 146–238 | 13 | 12 | 9 | 6 428 | 5 892 |
| zusammen | 266 | 250 | 261 | 32 609 | 25 481 |

**Bis 119 Elemente** (253 Trassen): 252 mit Urteil gegen 238; vierzehn
gewonnen (Plätze 170 bis 219, alle im alten Lauf `infeasible_subproblem`
oder `restoration_failed` in der Längenstufe), keine verloren; die eine
ohne Urteil ist in beiden Läufen dieselbe (Platz 213). Schritte über alle
Phasen 29 513 gegen 36 105.

**Die großen Trassen** (Plätze 253 bis 265, 146–238 Elemente) zeigen ein
anderes Bild:

- Plätze 253 bis 261 (146–164 Elemente): alle neun mit Urteil wie zuvor,
  sieben davon mit weniger Schritten in der Längenstufe, zwei mit mehr.
- Platz 262 (237 Elemente): alt mit Urteil (`stationary` nach 725
  Schritten), neu ohne Längenbudget – `restoration_failed` nach 647.
- Platz 263 (238 Elemente): alt mit Urteil (`stationary` nach 914), neu
  ohne Längenbudget – die Längenstufe läuft in die Grenze von 1 000
  Schritten.
- Platz 264 (238 Elemente): in beiden Läufen ohne Urteil
  (`restoration_failed` in der Längenstufe, alt nach 741, neu nach 474
  Schritten).
- Platz 265 (238 Elemente): dieselbe Trasse wie Platz 263 aus einer
  zweiten Lieferung – beide Läufe enden dort bis auf die letzte Stelle
  wie auf Platz 263, also alt mit Urteil, neu ohne. Als eigene
  Stichprobe zählt sie nicht.

Zwei der drei verschiedenen größten Trassen verlieren also im
Einzellauf ihr Urteil. Ob das Rauschen ist oder an den Änderungen liegt,
sagt ein Einzellauf nicht (Abschnitt 1): die Plätze 262 und 263 sind
darum je zweimal mit dem neuen und dem alten Stand wiederholt, die
Toleranz um 10 pm gestört (0,15 m ± 10 pm).

Platz 262, drei Rechnungen je Stand (Einzellauf und zwei Wiederholungen):

| Toleranz | alt | neu |
| --- | --- | --- |
| 0,15 m (Einzellauf) | Urteil, `stationary` nach 725 | ohne Längenbudget, `restoration_failed` nach 647 |
| + 10 pm | Urteil, `stationary` nach 694 | Urteil, `stationary` nach 628 |
| − 10 pm | Urteil, `stationary` nach 617 | ohne Längenbudget, `line_search_failed` nach 575 |
| mit Urteil | 3 von 3 | 1 von 3 |

Platz 263, ebenso:

| Toleranz | alt | neu |
| --- | --- | --- |
| 0,15 m (Einzellauf) | Urteil, `stationary` nach 914 | ohne Längenbudget, Grenze von 1 000 Schritten |
| + 10 pm | Urteil, `stationary` nach 664 | ohne Urteil, `restoration_failed` nach 320 |
| − 10 pm | Urteil, `stationary` nach 701 | Urteil, `stationary` nach 868 |
| mit Urteil | 3 von 3 | 1 von 3 |

Beide Trassen zeigen dasselbe: der alte Stand endet in allen sechs
Rechnungen mit Urteil, der neue in zwei von sechs, und seine vier
Abbrüche sind drei verschiedene (`restoration_failed` zweimal,
`line_search_failed`, Schrittgrenze). Wären beide Stände gleich gut,
käme ein so deutlicher Unterschied nur in etwa 3 % der Fälle zustande
(exakter Test nach Fisher, einseitig). Wo beide Stände ein Urteil haben, ist es dasselbe
(Platz 262 bei + 10 pm: Länge kostet 4,98 m, Restfehler 0,151 m; Platz
263 bei − 10 pm: 4,95 m, 0,190 m).

Damit gilt für den Endstand: er macht die Längenstufe auf den
Bahnhofsgleisen verlässlich (Abschnitt 5, sechsfach gerechnet) und verliert bis
164 Elemente kein Urteil, auf den Trassen mit 237 und 238
Elementen aber unzuverlässiger als zuvor. Welche der vier Änderungen das
bewirkt, ist nicht untersucht.

Nachtrag vom 13. November: Es ist untersucht (Abschnitt 10). Keine der
vier Änderungen bewirkt es; der Unterschied zwischen den Ständen hält
einer zweiten Stichprobe nicht stand, und die Schwäche steckt in beiden.

Über alle 266: 261 mit Urteil gegen 250, Schritte über alle Phasen 40 912
gegen 48 040. Was die Punkte in Länge kosten, ändert sich auf den 247
Trassen mit Urteil in beiden Läufen um höchstens 3 cm, im Median nicht.

## 7. Tests

`test/axtran2/length-tier-stability.test.mjs`, ohne Korpus:

- die Längenstufe verlässt den Korridor nicht um mehr als seine Breite
  (alt: Verletzung über 5; neu: höchstens 1), bei gleicher Länge;
- mit einem einseitigen Zwangspunkt neben dem Korridor endet die Folge
  für drei Ziele, die sich in der zehnten Stelle unterscheiden, auf
  derselben Länge;
- ein Urteil am Ende schließt auf die verlangte Genauigkeit (`solveSQP`,
  zwei Unbekannte);
- das Fenster zählt Schritte knapp neben den Bedingungen (`solveSQP`,
  zwei Unbekannte);
- `corridorCurvature` nimmt zwei Werte.

AXTRAN2-Tests 385, davon 384 grün und einer übersprungen. Gesamtsuite
2460 Tests, 2437 grün, 13 übersprungen, 10 rot – dieselben zehn Namen wie
ohne die Änderung (App-Seite).

Nachtrag vom 13. November (Abschnitt 10):
`test/axtran2/restoration-curved-row.test.mjs`, acht Tests ohne Korpus –
eine einzelne stark gekrümmte Zeile lässt die Wiederherstellung ohne
ihre Krümmung stehen und schließt mit ihr in wenigen Schritten; die
Krümmung wird nur für verletzte Zeilen gefragt und skaliert wie die
Hesse-Matrix; eine Region, die neben den Bedingungen zusammenfällt,
geht an die Wiederherstellung, mit `restoration: "off"`, an der Grenze
der Wiederherstellungen und an einem zulässigen Punkt bleibt es das
Urteil. Gesamtsuite 2482 Tests, 2459 grün, 13 übersprungen, 10 rot –
dieselben zehn Namen.

## 8. Offen

- **Die exakte Form der Rampenregel** (`rampLengthAs: "constraint"`) ist
  mit dem neuen Stand nicht über den Korpus gerechnet. Ihre zwei Tests
  auf der Neun-Elemente-Trasse laufen; ob die Längenstufe ihr auf großen
  Trassen jetzt hilft, ist nicht gemessen.
- **Was die Änderungen sonst treffen.** Das Punkte-Ziel ist nicht
  berührt: die Änderungen 1, 2 und 4 gelten nur unter dem Korridor (auch
  für ein einzelnes Längenziel mit `corridor: true`, das nicht eigens
  gemessen ist), und Änderung 3 schließt nur, wo ein Aufrufer
  `objectiveSettled.feasibility` setzt – das tut allein die Längenstufe.
  Die Wiederherstellung unter den Schranken des Schritts trifft jede
  Wiederherstellung, bei der der Auswerter eine Schranke nennt; das ist
  nur die exakte Form der Rampenregel.
- **Platz 213** und die Frage, warum die Region dort zusammenfällt:
  beantwortet in Abschnitt 10 (dieselbe Falle wie auf den größten
  Trassen).
- **Die größten Trassen** (237 und 238 Elemente): Ursache und Abhilfe
  in Abschnitt 10.
- **Die Stufe endet nicht an ihrer Antwort.** Auf Platz 213 steht die
  Länge ab etwa Schritt 600 auf den Millimeter fest, die Stufe läuft
  aber bis Schritt 989 weiter: das Fenster von `objectiveSettled` füllt
  sich nicht, weil jeder zweite Schritt um mehr als 1e-5 neben dem
  Korridor endet. Das kostet Schritte und gibt der Falle aus Abschnitt
  10 Gelegenheiten; es ist nicht angefasst.

## 9. Nachrechnen

```sh
# sechs Stichproben eines Standes, Plätze 130–221, Stufenfolge
for t in 0.15 0.15000000001 0.14999999999 0.15000000002 0.14999999998 0.15000000003; do
  node test/axtran2/corpus/runCorpus.mjs --from 130 --to 222 --objectives lexicographic --tolerance $t
done
# das alte Verhalten zum Vergleich: solver { corridorCurvature: "multiplier", filterCeiling: 100 }
```

Die Protokolle der Messungen liegen außerhalb des Repos, weil die
Dateinamen des Korpus Kundendaten sind:
`/Users/uwefalz/Developer/ufAIM-handover-7l/lt/`, die Einzelrechnungen
zu Abschnitt 10 samt Vorrichtung und Sonde in
`/Users/uwefalz/Developer/ufAIM-handover-7l/gt/`.

## 10. Die größten Trassen: Ursache und Abhilfe (13. November)

Auftrag von Uwe am 13. November („Ursache auf Platz 262 suchen,
Kernel-Go erteilt“).

### 10.1 Der Unterschied alt/neu trägt nicht

Die Längenstufe von Platz 262 ist einzeln nachgerechnet: der Warmstart
(Punkte-Ziel) einmal je Toleranz gerechnet und abgelegt, die Stufe dann
von dort, mit dem Stand von #121 („neu“), dem Stand davor („alt“) und
den abschaltbaren Änderungen einzeln.

| Toleranz | alt | neu |
| --- | --- | --- |
| 0,15 m | Urteil nach 650 | Urteil nach 651 |
| + 10 pm | `restoration_failed` nach 511 | Urteil nach 568 |
| − 10 pm | `line_search_failed` nach 651 | Urteil nach 757 |
| + 20 pm | – | Urteil nach 665 |
| − 20 pm | – | Urteil nach 514 |
| + 30 pm | – | Urteil nach 509 |
| mit Urteil | 1 von 3 | 6 von 6 |

Das ist das umgekehrte Bild zu Abschnitt 6 (dort alt 3 von 3, neu 1 von
3 auf demselben Platz). Zusammen: alt 4 von 6, neu 7 von 9. Der Befund
„der neue Stand verliert auf den größten Trassen Urteile“ hält damit
nicht; beide Stände verlieren dort Urteile.

Warum dieselbe Rechnung zweimal verschieden ausgeht: im Korpuslauf erbt
die Längenstufe das Fußpunktgedächtnis des Projektors
(`createFootMemory`) aus dem Warmstart im selben Prozess, in der
Einzelrechnung beginnt sie ohne. Die Fußpunkte unterscheiden sich in
den letzten Stellen, und das genügt (Abschnitt 1). Auf Platz 213 ist es
dasselbe: mit geerbtem Gedächtnis `line_search_failed` nach 648, ohne
Urteil nach 473. Ob das geerbte Gedächtnis über die letzten Stellen
hinaus etwas ändert, ist nicht untersucht.

Von den vier Änderungen aus #121 ändert auf Platz 262 nur die Decke des
Filters den Weg früh. Ohne gehaltene Krümmung und ohne `within` sind
die Rechnungen über Hunderte von Schritten schrittgleich mit dem neuen
Stand; mit der alten Decke folgen sie dem alten Stand.

### 10.2 Was geschieht

Mit einer Sonde im Löser aufgezeichnet (je Schritt: der volle Schritt,
die Korrektur, der Grund der Ablehnung im Filter, die Zahl der
Filtereinträge, der Verlauf der Wiederherstellung), an zwei
gescheiterten Rechnungen von Platz 262 und an Platz 213.

1. **Die Stufe geht neben dem Korridor.** Jeder Schritt verletzt die
   Gleichungen in zweiter Ordnung; die Korrektur schließt sie und lässt
   den Korridor offen (Abschnitt 2). Der angenommene Punkt liegt 1e-5 bis
   1e-3 außerhalb, ist ein h-Typ-Schritt und legt den verlassenen Punkt
   in den Filter. Nach 500 Schritten stehen dort 400 bis 570 Einträge,
   aufgereiht am Rand des Korridors.
2. **Ein Schritt kauft Länge mit Verletzung.** Der Filter nimmt einen
   Punkt an, dessen Länge fällt, wie weit die Verletzung dabei auch
   steigt, solange sie unter der Decke bleibt: gemessen von 9e-4 auf
   5e-3 und von 4e-4 auf 4,5e-3, für 0,6 bis 1 mm Länge. Jede Rechnung
   auf Platz 262 tut das zwölf- bis fünfzehnmal, ob sie mit Urteil endet
   oder nicht.
3. **Der Rückweg ist versperrt.** Zurück in den Korridor kostet Länge –
   der Multiplikator der Korridorzeile ist 2,4, also 1 cm für 4,5e-3.
   Jeder Punkt auf dem Rückweg hat damit mehr Länge als die Einträge vom
   Rand und, solange er nicht unter rund 2e-5 landet, auch mehr
   Verletzung: er ist dominiert, von 20 bis 110 Einträgen zugleich.
   Volle Schritte verletzen dort die Gleichungen um 0,2 bis 2, die
   Korrektur schließt sie und öffnet den Korridor weiter; angenommen
   werden nur Rückzugsschritte mit einem Hundertstel der Länge, die
   Verletzung zwischen Gleichungen und Korridor hin- und herschieben.
4. **Die Region fällt zusammen.** Sie stand bei 1e4 bis 1e6 und halbiert
   zwanzigmal, bevor sie den Schritt überhaupt begrenzt, dann bis 1e-10.
   Heraus kommt die Stufe nur, wenn ein korrigierter Schritt zufällig
   unter allen Einträgen landet (in einem Fall bei 1,7e-6). Sonst endet
   sie mit `line_search_failed` (Region am Boden) oder, wenn das
   Teilproblem vorher fünfmal voll relaxiert zurückkommt, in der
   Wiederherstellung.
5. **Die Wiederherstellung versagt dort.** Sie nimmt Gauss-Newton-Schritte
   auf die verletzten Zeilen. Für eine einzelne stark gekrümmte Zeile
   ist das ihre Gradientenrichtung, die Richtung der stärksten Krümmung:
   auf Platz 262 Gradient 1e3, Krümmung entlang 6e9; der Schritt von
   2e-6, der die linearisierte Zeile schließt, öffnet sie in zweiter
   Ordnung wieder, die Suche nimmt ein Achtel davon. Dreißig Schritte
   bringen die Verletzung von 2,7e-3 auf 4,6e-4 und von 1,30e-4 auf
   1,25e-4. Der erste Punkt hätte zum Weitergehen gereicht – so weit
   neben dem Korridor steht die Stufe bei jedem Schritt –, wurde aber an
   der zusammengefallenen Region (1e-8) gemessen und verworfen.

Das ist die Falle eines Filterverfahrens ohne tragfähige
Wiederherstellung. Sie ist keine Folge von #121 und nicht auf große
Trassen beschränkt (Platz 213, 29 Elemente, endet genauso). Große
Trassen trifft sie öfter: der Korridor ist dort steifer (die Summe der
Quadrate über 42 km gegen eine Richtung am Anfang), die Stufe braucht
500 bis 750 Schritte und macht ein Dutzend Ausflüge.

### 10.3 Was geändert ist

`restoreFeasibility` 0.2, `solveSQP` 0.4, `variableScaling` 0.3,
`AlignmentSQPSolver` 0.5.

1. **Die Wiederherstellung kennt die Krümmung der Zeile.** Der Auswerter
   kann für gekrümmte Ungleichungen deren zweite Ableitung nennen
   (`rowCurvature()`, auf Anfrage); die Wiederherstellung nimmt für eine
   verletzte Zeile g deren Newton-Term g · ∇²g hinzu – die Hesse-Matrix
   von ½ max(0, g)² ist ∇g ∇gᵀ + g ∇²g, und Gauss-Newton behält nur den
   ersten Teil. Für den Korridor ist ∇²g = (2/N) JᵀJ der Punktresiduen:
   der Schritt wird der Gauss-Newton-Schritt der Residuen, so skaliert,
   dass er die Zeile schließt. Gemessen: 2,7e-3 → 7,6e-6 und
   2,1e-3 → 4,8e-6 in je einem Schritt (Platz 262), 1,5e-2 → 2,7e-8 in
   zwei (Platz 213).
2. **Eine Region, die neben den Bedingungen zusammenfällt, geht an die
   Wiederherstellung** statt das Urteil zu sein (`region_collapsed` im
   Protokoll, dann `restored`). Sie zählt gegen dieselbe Grenze
   (`restorationLimit`, zwei). An einem zulässigen Punkt und mit
   `restoration: "off"` bleibt alles wie zuvor.
3. **Beurteilt wird die Wiederherstellung an der Region, mit der es
   weitergeht**, nicht an der zusammengefallenen.

Nichts davon ändert eine Rechnung, die nicht in eine Wiederherstellung
oder einen Zusammenfall läuft.

### 10.4 Gemessen

Je Stand dieselben Toleranzen (Abschnitt 1); „vorher“ ist der Stand von
#121.

| Plätze | Rechnungen | mit Urteil vorher | jetzt | verändert | verloren |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0–129 (3–7 Elemente), sechsfach | 780 | 780 | 780 | 0 | 0 |
| 130–221 (92 Bahnhofsgleise), sechsfach | 552 | 550 | 552 | 14 | 0 |
| 222–252 (33–119 Elemente), dreifach | 93 | 92 | 93 | 1 | 0 |

Die zwei gewonnenen Rechnungen der Bahnhofsgleise sind Platz 213 (vorher
`line_search_failed` nach 648 und 489, jetzt Urteil nach 989 und 762);
die zwölf anderen veränderten liefen schon vorher durch eine
Wiederherstellung und enden mit derselben Länge auf 2 mm. Die eine der
mittleren Trassen ist Platz 249 (vorher `restoration_failed`). Schritte
der Längenstufe auf den Bahnhofsgleisen 80 524 gegen 79 513.

**Die größten Trassen.** Nachgerechnet sind die Rechnungen des neuen
Stands, die in Abschnitt 6 ihr Urteil verloren hatten, so wie der
Korpuslauf sie rechnet (Warmstart und Längenstufe in einem Prozess,
Voreinstellung); die Warmstarts treffen die früheren auf den Schritt.

| Platz | Toleranz | vorher | jetzt | Wiederherstellung |
| --- | --- | --- | --- | --- |
| 262 | 0,15 m | `restoration_failed` nach 647 | Urteil nach 990 | bei 647: 7,4e-3 → 2,6e-5 in einem Schritt |
| 262 | − 10 pm | `line_search_failed` nach 575 | Urteil nach 895 | bei 575 (Region am Boden): 6,8e-3 → 1,3e-8 in zwei |
| 263 | + 10 pm | `restoration_failed` nach 320 | Urteil nach 741 | bei 320: 1,7e-2 → 1,2e-7 in zwei |

Alle drei enden mit `objective_settled`. Die Längen auf Platz 262 sind
41 829,694 und 41 829,681 m; die neun Urteile ohne Abhilfe aus Abschnitt
10.1 liegen zwischen 41 829,692 und 41 829,716 m.

Nach der Wiederherstellung läuft die Stufe einmal bis an die Decke des
Filters hinaus (Verletzung 0,92 bis 0,99) und ist nach 20 bis 50
Schritten zurück; bis zum Urteil braucht sie von der Wiederherstellung
an 320 bis 420 Schritte. Die erste Rechnung endet zehn Schritte vor der Grenze von
1 000.

Die vierte verlorene Rechnung aus Abschnitt 6 (Platz 263 bei 0,15 m,
Grenze von 1 000 Schritten) und Platz 264 (in beiden Ständen ohne
Urteil) sind nicht nachgerechnet, ebenso wenig der ganze Korpus.

Dazu die zwei Rechnungen, die in der Einzelrechnung von Abschnitt 10.1
mit abgeschalteten Einzeländerungen scheiterten: ohne gehaltene Krümmung
(vorher `restoration_failed` nach 477) jetzt Urteil nach 903; mit der
alten Decke des Filters (vorher `line_search_failed` nach 612) holt die
Wiederherstellung die Stufe zurück (2,1e-3 → 4,8e-6 in einem Schritt),
der Ausflug danach geht aber bis 99 und kostet das Budget.

### 10.5 Gemessen und nicht genommen

**Das Krümmungsmodell über die Wiederherstellung behalten**, wenn sie
in der Nähe bleibt (statt wie bisher neu zu beginnen): auf den
Bahnhofsgleisen 550 von 552 statt 552, eine Rechnung verloren – mit
demselben Modell läuft die Stufe in dieselbe Falle und verbraucht ihre
zwei Wiederherstellungen. Der Neubeginn kostet dafür einen Ausflug bis
an die Decke des Filters: unter der Voreinstellung (Decke 1) 20 bis 50
Schritte, mit der alten Decke (100) 180 Schritte und das Budget der
Stufe. Die Decke aus #121 ist damit Voraussetzung dieser Abhilfe.

### 10.6 Offen

- Die Stufe geht weiter neben dem Korridor und in Ausflüge; die Abhilfe
  holt sie zurück, wo sie nicht von selbst zurückfindet, und verhindert
  die Ausflüge nicht. Eine Korrektur, die den Korridor mit schließt,
  ist am 22. und 23. September gemessen und nicht genommen
  (`AXTRAN2_LEXICOGRAPHIC_CORPUS_2026-09-10.md`).
- Nach einer Wiederherstellung braucht die Stufe 320 bis 420 Schritte
  bis zum Urteil; greift die Falle später als etwa Schritt 650, kann die
  Grenze von 1 000 Schritten das Urteil kosten (Platz 262: Urteil nach
  990).
- Der ganze Korpus ist mit der Abhilfe nicht gerechnet.
- Die Stufe endet nicht an ihrer Antwort (Abschnitt 8).
