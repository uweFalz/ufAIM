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
- **Platz 213** und die Frage, warum die Region dort zusammenfällt.
- **Die größten Trassen** (237 und 238 Elemente): der Endstand verliert
  dort Urteile – in der Wiederholung 2 von 6 gegen 6 von 6 mit Urteil
  (Abschnitt 6); eine dritte Trasse hat in beiden Ständen keines. Welche
  der vier Änderungen das bewirkt und ob sie sich für diese Größe
  zurücknehmen oder nachbessern lässt, ist offen und zu entscheiden.

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
`/Users/uwefalz/Developer/ufAIM-handover-7l/lt/`.
