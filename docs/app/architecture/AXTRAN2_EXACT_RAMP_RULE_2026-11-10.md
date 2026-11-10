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
sicher zu haben. Der Test dazu steht als `todo` in
`test/axtran2/lexicographic.test.mjs`. `bound` bleibt der Standard; der
Dienst (`fitTraCore`) rechnet damit, für ihn ändert sich nichts.

## 6. Nachrechnen

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
