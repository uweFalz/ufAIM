# AXTRAN2: die exakte Rampenregel – Stand der Messung (2026-11-10)

Die Rampenregel L ≥ m·Δu reist im Löser auf zwei Wegen
(`AlignmentConstraintBuilder`, `rampLengthAs`):

- **`bound`** (Standard): Δu an seinem größten Wert, als untere Schranke der
  Länge des Übergangsbogens. Strenger als nötig, wo ein Übergangsbogen nicht
  den ganzen Überhöhungsbereich durchläuft.
- **`constraint`**: die exakte Form, Δu zwischen den Krümmungen der
  Nachbarn, als allgemeine Ungleichung, die eine Länge an zwei Krümmungen
  koppelt.

Im Constraint-Builder steht seit dem 3. September 2026 (Commit `a1f9cce`),
die exakte Form sei „not yet safe to run": der Punkte-Fit ende auf der
Neun-Elemente-Trasse bei 2,47 rms statt 0,083. Dieses Dokument hält fest,
was davon am 10. November noch stimmt. Gebaut ist nichts; der Kern ist
nicht angefasst.

## 1. Woher die 2,47 kommt

Aus dem Lauf vom 3. September auf `test/axtran2/fixtures/nineElementScenario.mjs`
(Bögen R 700 und R 900, Bloss-Übergangsbögen 90 und 80 m, 12 Punkte), „from
a feasible start with margin"; welcher Start das war, ist nicht
überliefert. Die Zahl hat nichts mit dem Löserbefund „4L" vom 9. November
zu tun: dessen rms 2,47 entstand auf der Bahnhofstrasse der
`held-records`-Tests und war der Mindestradius 300 m (EBO § 6 (1)). Zufall.

## 2. Was heute gemessen ist

Neun-Elemente-Trasse, `origin/main` `89036f6`, 300 Schritte, zwei Starts:
nahe der Wahrheit (`startLengths` 200/92/298/88/152/82/258/78/180,
`startCurvatures` 1/695 und −1/905, der Start des Tests „the merit pays
off a violated ramp inequality") und der Standardstart der Fixture.

**Punkte-Fit allein** (`objective: "points"`), rms in Toleranzeinheiten:

| Start | `bound` | `constraint` |
|---|---|---|
| nahe der Wahrheit | 0,093, stationary, 17 Schritte | 0,093, stationary, 16 Schritte |
| Standardstart | 0,246, stationary, 26 Schritte | 0,098, stationary, 19 Schritte |

Die 2,47 tritt nicht mehr auf; die exakte Form ist im Punkte-Fit
mindestens so gut wie die Schrankenform. Der Löser wurde seit September
mehrfach umgebaut (Filter statt Merit am 11. Oktober, Restauration,
aktive Menge).

**Längen-Fit allein** (`objective: "accumulated-length"`), Start nahe der
Wahrheit:

| | `bound` | `constraint` |
|---|---|---|
| Ergebnis | converged, 49 Schritte | converged, 62 Schritte |
| Länge | 1042,5977 m | 1042,5977 m |
| Übergangsbögen | alle 78,000 m | alle 78,000 m |

Dieselbe Antwort auf beiden Wegen. Auf dieser Trasse kostet die
Schrankenform nichts, wie am 3. September schon festgestellt: die Bögen
sind enger als R 907,87, ab dem die Überhöhung nicht mehr wächst.

**Die Stufenfolge** (`solveAlignmentLexicographic`, `DEFAULT_TIERS`: erst
Länge unter dem Korridor der Punkte, dann Punkte), Start nahe der Wahrheit:

| Phase | `bound` | `constraint` |
|---|---|---|
| Warmstart (Punkte) | stationary, rms 0,093 | stationary, rms 0,093 |
| Stufe 1 (Länge im Korridor) | stationary, 79 Schritte, 1049,8198 m | **max_iterations**, 300 Schritte, pendelt 1049,8214–1049,8225 m |
| Stufe 2 (Punkte) | stationary, rms 0,093, 1049,9929 m | stationary, rms 0,093, 1049,9928 m |
| Gesamt | converged | tier_established_no_budget |

Mit 2000 Schritten bricht Stufe 1 der exakten Form nach 1394 Schritten ab
(`line_search_failed`, `region_collapsed`). Das Endergebnis der Folge ist
auf beiden Wegen dasselbe; nur sagt die exakte Form nicht, was die Punkte
an Länge kosten (`tier_established_no_budget`).

## 3. Wo es hängt

Nur in der Längenstufe unter dem Korridor. Dort hat das Teilproblem in der
exakten Form fünf Zeilen (vier Rampen und der Korridor), in der
Schrankenform eine (der Korridor):

| Stufe 1 | `bound` | `constraint` |
|---|---|---|
| Teilprobleme `solved` | 79 von 79 | 149 von 284 |
| Teilprobleme `stationary_on_working_set` | 0 | 135 von 284 (Median 3 QP-Schritte) |
| volle Schritte (α = 1) | 78 | 135 |
| zurückgenommene Schritte | 1 | 149 |

`stationary_on_working_set` ist die entartete Ecke der aktiven Menge
(`AXTRAN2_QP_ACTIVE_SET_2026-09-11.md`: mehr Nullschritte hintereinander
als Variablen, Blands Regel an). Fast jedes zweite Teilproblem endet dort;
der Schritt, den der Löser dann nimmt, ist nicht die Lösung des
Teilproblems, wird zurückgenommen, und die Zielgröße wandert in der
vierten Stelle hin und her. Aktiv sind dabei die Rampenzeile des letzten
Übergangsbogens (L = 78,000 m, Rest ±1e-6) und die Korridorzeile.

Ausgeschlossen:

- **der Knick des Überhöhungsmodells** bei R 907,87: der zweite Bogen endet
  bei R 902,7, im gedeckelten Bereich; die Rampenzeile ist dort schlicht
  L ≥ 78 m, ohne Krümmungsanteil;
- **die Optionen des Lösers**: `qpWarmStart: false`, `restoration: "off"`
  und `"eager"`, `qpIterations: 400`, `correctionClosure: 0.1`,
  `filterSwitching: false` ändern das Bild nicht (alle 300 Schritte,
  95 bis 199 entartete Teilprobleme).

Nicht geklärt: warum dieselbe Bedingung L ≥ 78 m als Schranke durchläuft
und als Zeile mit Schlupf an der Ecke hängt. Der Verdacht liegt bei der
aktiven Menge (`solveBoxQP`): eine Zeile, die im gedeckelten Bereich nur
eine Variable trägt, und die Schranke des Vertrauensbereichs auf derselben
Variable sind an der Ecke linear abhängig.

## 4. Was zu tun wäre (Kern, braucht Uwes Go)

1. Die Bemerkung im `AlignmentConstraintBuilder` („2.47 against 0.083")
   auf diesen Stand bringen: im Punkte-Fit gilt sie nicht mehr.
2. Die entartete Ecke in der Längenstufe suchen. Ein naheliegender Versuch:
   eine Rampenzeile, die an der aktuellen Stelle keinen Krümmungsanteil hat
   (beide Nachbarn im gedeckelten Bereich oder gerade), für diesen Schritt
   als Schranke der Länge führen statt als Zeile – dann ist sie, was sie
   in der Schrankenform ist.
3. Erst danach lohnt die Frage, ob `constraint` Standard werden kann; dazu
   gehört der Korpus (`test/axtran2/corpus`), nicht nur diese Trasse.

## 5. Stand nach der Änderung vom 10. November (Kern-Go)

Punkt 1 und der Versuch aus Punkt 2 sind gebaut:

- **Die Bemerkung** im `AlignmentConstraintBuilder` nennt den heutigen Stand
  statt der 2,47.
- **Eine Rampenzeile, die an der aktuellen Stelle keine Krümmung liest**
  (beide Nachbarn gehalten, gerade oder im gedeckelten Bereich), reist für
  den Schritt von dieser Stelle als untere Schranke ihrer Länge
  (`AlignmentSQPSolver.rampRows` gibt `lower`; die Zeile tritt beiseite, mit
  Rest ≤ −1 und ohne Normale, damit Zeilenzahl, Multiplikatoren und
  Warmstart ihren Platz behalten). Dazu nimmt `solveSQP` (0.2) eine untere
  Schranke, die der Auswerter für den Schritt von seiner Stelle nennt, und
  `scaleEvaluator` (0.2) rechnet sie in skalierte Koordinaten um. Die
  Schranke ist über die Stelle hinaus sicher: verlässt eine Krümmung im
  Schritt den gedeckelten Bereich, fällt Δu nur.
- Der Bericht liest weiter die Regel selbst: `rampSlack` aus den wahren
  Resten, und `activeBounds` nennt eine Länge auf der Rampenschranke mit
  `reason` „ramp-rule“.

Gemessen, Stufenfolge auf der Neun-Elemente-Trasse, Start nahe der Wahrheit:

| Entwurf | Stufe 1 `bound` | Stufe 1 `constraint` vorher | Stufe 1 `constraint` jetzt |
|---|---|---|---|
| V 100 (Zeilen ohne Krümmung) | stationary, 79 Schritte, 1049,8198 m | max_iterations, 300 Schritte | stationary, 81 Schritte, 1049,8198 m, alle Teilprobleme gelöst |
| V 80 (Zeilen lesen Krümmung) | stationary, 79 Schritte, 1049,8198 m | line_search_failed, 98 Schritte, 1049,8145 m | unverändert: line_search_failed, 98 Schritte, 1049,8145 m |

Bei V 100 gibt die Folge auf beiden Wegen dieselbe Antwort und dieselben
Kosten der Punkte in Länge (0,173 m). **Offen bleibt der Fall, in dem die
Zeilen wirklich Krümmung lesen** (V 80: beide Bögen flacher als der Deckel
bei R 581): dort endet die Längenstufe unter dem Korridor weiter ohne
Urteil, 9 von 50 Teilproblemen an einer entarteten Ecke. Die exakte Form
erlaubt dort kürzere Übergangsbögen (5 mm weniger Länge an der Stelle, an
der sie abbricht) – das ist ihr eigentlicher Gewinn, und er ist noch nicht
sicher zu haben. Dem ist Abschnitt 6 nachgegangen; der Test dazu steht in
`test/axtran2/lexicographic.test.mjs`. `bound` bleibt der Standard; der
Dienst (`fitTraCore`) rechnet damit, für ihn ändert sich nichts.

## 6. Der Fall V 80: die Lösung des Teilproblems brach ihre eigenen Gleichungen

Nachgegangen am 10. November (zweites Kern-Go). Der Abbruch bei V 80 hatte
nichts mit dem Korridor, der Krümmungswahl (Gauss-Newton oder BFGS) oder
den Annahmeregeln zu tun – zehn Optionen geprüft, keine änderte das Bild;
der Gradient der Korridorzeile stimmt auf fünf Stellen mit finiten
Differenzen. Die Spur im Filter zeigte es: **jeder volle Schritt landete
auf demselben Punkt, und dort waren die Endpose um 2e-5 bis 5e-5 und der
Korridor um 2e-5 verletzt.** Das Teilproblem meldete `solved` für einen
Schritt, der seine eigenen linearisierten Gleichungen nicht erfüllte
(h + Jh·d ≠ 0 bei δ = 1e-11).

Ursache in `solveBoxQP.solveFreeBlock`: die Partikulärlösung von
A_f y = rhs über die Normalgleichungen, regularisiert mit
1e-12 · (größtes Diagonalelement). Die Korridorzeile hat in skalierten
Koordinaten die Norm 763, die Gleichungen die Norm 1; damit standen 6e-7
auf jeder Diagonale. Wo die rechte Seite groß ist – die Schlupfe der
Rampenzeilen, zwanzig Meter von ihrer Grenze –, werden die Gewichte groß,
und der Fehler landet in den Gleichungen. Ein Dreizeiler zeigt es:
x1 + x2 = 0, 1000·x1 − 1000·x2 = 0, x1 + s = 25 gab x1 = x2 = 1,25e-5
statt null.

Behoben (`solveBoxQP` 0.2): die Zeilen gehen mit Einheitsnorm in die
Normalgleichungen (dieselbe Minimum-Norm-Lösung, die Regularisierung
relativ zu jeder Zeile), dazu ein Schritt Nachiteration, behalten, wo er
den Rest verkleinert.

Gemessen, Stufenfolge, Start nahe der Wahrheit:

| Entwurf, Form | Stufe 1 vorher | Stufe 1 jetzt |
|---|---|---|
| V 80 `constraint` | line_search_failed, 98 Schritte, Verletzung 1e-4 | stationary (objective_settled), 465 Schritte, 1049,8102 m, Verletzung 2e-11 |
| V 80 `bound` | stationary, 79 Schritte, 1049,8198 m | unverändert |
| V 80 ohne Rampenregel (`none`) | stationary, 50 Schritte, 1049,8097 m | unverändert |
| V 100 `constraint` | stationary, 81 Schritte, 1049,8198 m | unverändert |

Die exakte Form endet bei V 80 jetzt 9,6 mm kürzer als die Schrankenform
(Übergangsbögen 86,0 / 107,8 / 49,8 / 74,1 m statt alle ≥ 78 m), `rampSlack`
≤ 0, die Folge `converged`. **Langsam bleibt sie:** 465 Schritte gegen 79,
246 Teilprobleme an einer entarteten Ecke, sobald eine Rampenzeile mit
Krümmungsanteil und der Korridor zugleich aktiv sind. Mit 300 Schritten
reicht es nicht; der Löser und `fitTraCore` geben 1000.

Die Korrektur trifft jeden Lauf, nicht nur die exakte Form: der Weg jedes
Fits ändert sich in den hinteren Stellen. Der Test „the merit pays off a
violated ramp inequality" endet jetzt nach 56 statt 62 Schritten auf
derselben Länge, mit einer letzten Verletzung von 9e-7 statt unter 1e-9 –
innerhalb der Feasibility des Urteils; seine Schwelle steht jetzt dort.
Der Korpus unter beiden Formen, vor und nach der Korrektur, steht in
Abschnitt 7.

## 7. Der Korpus unter beiden Formen

Vier Läufe über die 266 vertrauenswürdigen Trassen des Korpus, Stufenfolge
(`--objectives lexicographic`), 10. und 11. November: beide Formen auf
origin/main (`effaa03`, mit #115) und beide mit der Korrektur aus
Abschnitt 6. Ein Neustart des Rechners hat die Läufe bei Datei 253–257
unterbrochen; der Rest ist mit `--from` nachgerechnet. **Der vierte Lauf
(`constraint` mit Korrektur) steht bei 263 von 266**: die drei größten
Trassen (238 Elemente, je mehrere Stunden) fehlen noch.

| | `bound` main | `constraint` main | `bound` + Korrektur | `constraint` + Korrektur (263) |
|---|---|---|---|---|
| converged | 253 | 211 | 250 | 234 |
| Längenstufe ohne Urteil, Punkte ohne Budget gerechnet (`tier_established_no_budget`) | 10 | 46 | 15 | 19 |
| anderes Ende (`line_search_failed`, `infeasible_subproblem`, `max_iterations`) | 3 | 9 | 1 | 10 |
| Ergebnis unbrauchbar (rms > 0,4 Toleranzeinheiten) | 0 | 8 | 0 | 5 |
| Rechenzeit | 11,4 h | 22,7 h | 13,0 h | 18,7 h |

Die Zeiten sind nur ein Anhalt: vier Läufe liefen zugleich, und fast alle
Zeit steckt in den 17 Trassen ab 109 Elementen.

Converged nach Größe, auf den 263 Dateien, die alle vier Läufe haben:

| Elemente | Dateien | `bound` main | `constraint` main | `bound` + Korrektur | `constraint` + Korrektur |
|---|---|---|---|---|---|
| unter 20 | 193 | 184 | 181 | 185 | 178 |
| 20–49 | 46 | 43 | 20 | 39 | 42 |
| 50–108 | 10 | 10 | 4 | 10 | 10 |
| ab 109 | 14 | 14 | 6 | 14 | 4 |

Was das heißt:

1. **Die Korrektur trägt die exakte Form im mittleren Bereich.** Von 56
   Trassen mit 20–108 Elementen enden 52 mit Urteil statt 24. Der Fall V 80
   war kein Einzelfall.
2. **Auf großen Trassen ist die exakte Form nicht zu gebrauchen, mit und
   ohne Korrektur.** Ab 109 Elementen enden 4 von 14 mit Urteil, fünf
   Ergebnisse sind unbrauchbar (rms 0,5–1,0, Länge bis 0,70 m neben dem
   Bestand), die Rechenzeit ist die vierfache. Die Schrankenform löst alle
   14.
3. **Der Gewinn der exakten Form zeigt sich im Korpus nicht.** Wo beide
   Formen mit Urteil enden (228 Trassen, mit Korrektur), ist die Länge in
   202 Fällen auf 5 mm dieselbe, in 6 kürzer, in 20 länger.
4. **Für die Schrankenform ändert die Korrektur die Antworten nicht, die
   Urteile leicht.** Über alle 266 Trassen weichen rms um höchstens 0,054
   und die Länge um höchstens 0,08 m ab, kein Ergebnis wird unbrauchbar.
   Sechs Trassen gewinnen das Urteil der Längenstufe, neun verlieren es
   (13–31 Elemente; in 14 der 16 Wechsel sind rms und Länge dieselben, nur
   das Urteil der Längenstufe ist ein anderes). Netto 250 statt 253.

Folgerung: `bound` bleibt der Standard, `constraint` wird es nicht. Die
Korrektur ist richtig (das Teilproblem erfüllt seine Gleichungen wieder),
auf dem Standardweg aber kein Gewinn.

### Die neun Trassen (12. November)

Angesehen sind die neun, die mit der Korrektur das Urteil der Längenstufe
verlieren (Korpusplätze 176, 177, 180, 181, 193, 194, 204, 213, 218 in der
Reihenfolge des Läufers). Alle neun sind reproduzierbar, und in allen ist
es dasselbe Bild – auf main wie mit der Korrektur:

- Die Längenstufe bleibt mit **verletztem Korridor** stehen (die eine
  Ungleichung, skaliert 0,1–0,6 über der Grenze). Das Teilproblem meldet
  `solved` für einen langen Schritt (Norm 3–10 bei einem Vertrauensradius
  um 1e5), die Liniensuche kürzt ihn auf 1e-4 bis 3e-5, der Radius halbiert
  sich über 25–40 Durchgänge, dann fällt das Urteil
  `infeasible_subproblem` und die Wiederherstellung holt die Stelle
  zurück. Ein voller Schritt mit Korrektur zweiter Ordnung nimmt die
  Verletzung dagegen in einem Zug um das Sechsfache zurück.
- Auf main geschieht das auf Platz 177 einmal (Verletzung 0,002), mit der
  Korrektur dreimal (0,19 / 0,10 / 0,34); nach zwei Wiederherstellungen
  bleibt die dritte aus, und die Stufe endet ohne Urteil. Die beiden Wege
  sind bis Schritt 39 auf vier Stellen gleich und laufen dann auseinander;
  beide springen unterwegs weit aus dem Korridor (main bis 1,6, mit
  Korrektur bis 53).

**Es ist Rauschen einer wackligen Stufe, nicht die Korrektur.** Probe:
Korpusplätze 130–221 (92 Trassen, 7–33 Elemente), sechsmal gerechnet mit
einer Punkttoleranz von 0,15 m ± 10–30 Pikometer – eine Änderung ohne jede
Bedeutung.

| | converged von 92, sechs Rechnungen | Mittel | Streuung |
|---|---|---|---|
| main | 80, 81, 77, 74, 78, 79 | 78,2 | 2,5 |
| mit Korrektur | 77, 76, 78, 79, 73, 77 | 76,7 | 2,1 |

- Zwei Rechnungen desselben Standes unterscheiden sich in 11–15 Urteilen;
  die Korrektur kippt 14–15. Der Unterschied der Mittel (1,5) liegt in der
  Streuung.
- 40 der 92 Trassen verlieren in mindestens einer der zwölf Rechnungen das
  Urteil; alle neun gehören dazu, und sieben von ihnen verlieren es auch
  auf main in einem Teil der Rechnungen (Plätze 193 und 194 dort in vier
  von sechs).
- Bei 12 der 92 bewegt sich auch die Antwort selbst um mehr als 0,01
  Toleranzeinheiten, im größten Fall (Platz 182) auf main zwischen rms
  0,19 und 0,29 bei jeweils `converged`.

Damit spricht der Korpus nicht gegen die Korrektur. Er zeigt etwas
anderes: **das Urteil der Längenstufe ist bei rund vier von zehn kleinen
Trassen nicht reproduzierbar**, und ein Vergleich zweier Löserstände über
die Zahl der Urteile trägt erst ab einem Unterschied deutlich über fünf
von hundert. Wo anzusetzen wäre (Kern, nicht gebaut): der Schritt der
Längenstufe ist bei linearem Ziel und einer gekrümmten Korridorzeile zu
lang für die Linearisierung; die Korrektur zweiter Ordnung greift nur beim
vollen Schritt, und der Vertrauensradius ist so groß, dass er den Schritt
nicht begrenzt.

Protokolle und Auswertung liegen außerhalb des Repos, weil die Dateinamen
Kundendaten sind: `/Users/uwefalz/Developer/ufAIM-handover-7l/scratchpad-save/corpus/`,
`/Users/uwefalz/Developer/ufAIM-handover-7l/corpus-resume/`,
`/Users/uwefalz/Developer/ufAIM-handover-7l/corpus-eval/evaluate.py`
(schreibt die Vergleiche mit Namen auf die Konsole).

## 8. Nachrechnen

```js
// node, aus dem Repo: Stufe 1 in beiden Formen
const { createNineElementScenario } = await import("./test/axtran2/fixtures/nineElementScenario.mjs");
const { solveAlignmentLexicographic, DEFAULT_TIERS } = await import("./src/domain/optimization/alignment/AlignmentLexicographicSolver.js");
const start = { startLengths: [200, 92, 298, 88, 152, 82, 258, 78, 180], startCurvatures: [1 / 695, -1 / 905] };
for (const rampLengthAs of ["bound", "constraint"]) {
	const sc = createNineElementScenario({ pointCount: 12, ...start, rampLengthAs });
	const run = solveAlignmentLexicographic({ problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, tiers: DEFAULT_TIERS, maxIterations: 300 });
	const d = run.phases.find((p) => p.label === "tier-1").diagnostics;
	const qp = {}; for (const e of d.history) if (e.qpStatus) qp[e.qpStatus] = (qp[e.qpStatus] ?? 0) + 1;
	console.log(rampLengthAs, run.status, d.iterations, d.accumulatedLength.toFixed(4), JSON.stringify(qp));
}
```
