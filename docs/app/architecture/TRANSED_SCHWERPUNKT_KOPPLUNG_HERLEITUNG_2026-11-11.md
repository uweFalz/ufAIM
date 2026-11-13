# Kopplung von Krümmung und Überhöhung über einen Bezugspunkt: Herleitung zur Prüfung

Stand 2026-11-13. Status: **Modell bestätigt** (Uwe, 2026-11-13). Gerechnet wird
seitdem der genaue Ausdruck statt der Kleinwinkelform, siehe Abschnitte 1, 3 und 9.
Diese Notiz legt die Herleitung offen, die in
`src/services/transition-library/cantCurvatureCoupling.js` gerechnet wird. Die
Herleitung stammt von Claude und entstand ohne das Original. Nachträglich ist sie
mit der Patentschrift AT 412 975 B (Hasslinger, angemeldet 2002-07-23) abgeglichen:
Gleichung, Vorzeichen und Näherung der Kleinwinkelform stimmen überein, siehe
Abschnitt 8.

## 1. Ergebnis

Mit x = s/L auf [0, 1], normierter Krümmung k(x) und normierter Überhöhung f(x):

    k(x) = f(x) − ε² · f″(x),      ε² = h · ψ_E · R / L²

- h: Höhe des Bezugspunkts über der Gleisachse
- ψ_E: Überhöhungswinkel am Bogenende, ψ_E = Überhöhung / Stützweite
- R: Radius am Bogenende, L: Länge des Übergangsbogens
- Die Geschwindigkeit kommt nicht vor.

Das ist die Kleinwinkelform (das Patent). Gerechnet wird seit 2026-11-13 der
genaue Ausdruck (Entscheidung Uwe), mit a = ψ_E, ρ = h/R und c = 1/(1 − ρ·sin a):

    k = (c·f − ε²·(f″·cos(a·f) − a·f′²·sin(a·f))) / (1 + c·f·ρ·sin(a·f))

- sin ψ_E = Überhöhung / Stützweite, also ψ_E = arcsin(u/b) statt u/b
- Für a → 0 und ρ → 0 bei festem ε wird daraus die Kleinwinkelform.
- Vernachlässigt bleibt allein d′², das Quadrat der Versatzneigung (im Beispiel
  des Patents rund 6·10⁻⁶).

Beispiel: h = 1,8 m, Überhöhung 150 mm, Stützweite 1,5 m (ψ_E = arcsin 0,1 = 0,1002),
R = 1000 m, L = 100 m ergibt ε² = 0,01803, ε = 0,134.

## 2. Annahmen (von Uwe bestätigt am 2026-11-13)

| Nr. | Annahme | Wo sie eingeht |
| --- | --- | --- |
| A1 | Der Bezugspunkt liegt um h über der Gleisachse, auf der Hochachse des geneigten Fahrzeugs. Er dreht um die Gleisachse, ohne Federung und ohne Wankpol. | Versatz d |
| A2 | Positive Überhöhung neigt zur Bogeninnenseite. Der Grundriss des Bezugspunkts liegt deshalb um d **nach innen** versetzt. | Vorzeichen von ε² |
| A3 | Versatz d = h · sin ψ. Die Kleinwinkelform setzt d ≈ h · ψ; gerechnet wird der Sinus. | Versatz d |
| A4 | Die Versatzneigung ist klein: d′² ≪ 1. Die Kleinwinkelform setzt zusätzlich κ·d ≪ 1 (im Beispiel 1,8 · 10⁻⁴); gerechnet wird mit dem Nenner 1 − κd. | Krümmung der versetzten Linie |
| A5 | Hasslingers Forderung: Die Krümmung der Bezugspunktbahn ist an jeder Stelle proportional zur Überhöhung, κ_ref / ψ = κ_E / ψ_E. | Kopplung |
| A6 | Rampe und Übergangsbogen haben dieselben Stationen (Vorgabe Uwe). | Randbedingungen |
| A7 | h ist über den Bogen konstant. Gradiente und Längsneigung bleiben außen vor. | alles |

## 3. Herleitung

**Versetzte Linie.** Gleisachse r(s) mit Tangente t, Normale n zur Bogeninnenseite,
Krümmung κ; also r′ = t, t′ = κ·n, n′ = −κ·t. Die Bezugspunktbahn im Grundriss ist

    r_ref(s) = r(s) + d(s) · n(s),      d = h · ψ   (A1–A3)

Ableiten: r_ref′ = (1 − κd) · t + d′ · n. Die Richtung der Bezugspunktbahn weicht
also um arctan(d′ / (1 − κd)) ≈ d′ von der Gleisrichtung ab, ihr Bogenelement ist
ds_ref ≈ (1 − κd) · ds. Daraus

    κ_ref = (κ + d″) / (1 − κd) ≈ κ + d″      (A4)

und mit d = h·ψ:

    κ = κ_ref − h · ψ″

**Kopplung.** Mit ψ = ψ_E · f und A5, κ_ref = κ_E · f, sowie s = L·x:

    κ = κ_E · f − (h · ψ_E / L²) · f″

Division durch κ_E = 1/R gibt die Gleichung aus Abschnitt 1.

**Genauer Ausdruck (seit 2026-11-13).** Ohne die beiden Näherungen bleibt
κ_ref = (κ + d″)/(1 − κd) mit d = h · sin ψ. Aufgelöst nach der Gleiskrümmung:

    κ = (κ_ref − d″) / (1 + κ_ref · d)
    d″ = (h / L²) · (ψ_E · f″ · cos(ψ_E f) − ψ_E² · f′² · sin(ψ_E f))

A5 heißt jetzt κ_ref = κ_ref,E · f. Am Bogenende ist d″ = 0 und κ = κ_E, also
κ_ref,E = κ_E / (1 − κ_E · d_E) mit d_E = h · sin ψ_E. Mal R genommen und mit
a = ψ_E, ρ = h/R, c = 1/(1 − ρ · sin a) folgt die Gleichung aus Abschnitt 1. Sie
trifft an den Enden weiter k = 0 und k = 1, sobald dort f′ = f″ = 0 gilt.

**Vorzeichen (A2).** Läge der Bezugspunkt nach außen versetzt, hieße es
k = f + ε²·f″. Die Probe: Eine weiche Rampe hat am Anfang f″ > 0 bei f ≈ 0. Mit dem
Minuszeichen wird k dort negativ. Das ist der Gegenschwung des Wiener Bogens und
spricht für A2.

## 4. Beide Richtungen

**Hasslinger (f gegeben).** k folgt durch zweimaliges Ableiten. Ist f an den Enden
weich (f′ = 0 und f″ = 0), schließt k stetig an Gerade und Kreis an.

**Umgekehrt (k gegeben, Uwes Richtung).** Zu lösen ist f − ε²·f″ = k. Mit A6 sind
beide freien Konstanten verbraucht: f(0) = 0, f(1) = 1. Die Endsteigungen f′(0) und
f′(1) sind dann ein Ergebnis und keine Wahl. Für den genauen Ausdruck ist die
Gleichung nicht mehr linear. Das Modul löst zuerst die Kleinwinkelform und
verbessert die Rampe dann schrittweise mit demselben linearen Löser, bis der Schritt
unter 10⁻¹² fällt (im Beispiel des Patents wenige Schritte). Schwingt die Rechnung
nicht ein, sagt die Seite das.

- f′(0) = f′(1) = 0: Die Rampe läuft tangential ein und aus. Die Krümmungsfunktion
  ist für dieses ε schwerpunkt-tauglich.
- f′(0) ≠ 0: Die Rampe hat dort einen Knick. Die Bezugspunktbahn bekommt an dieser
  Station einen Richtungssprung der Größe h · ψ_E · f′(0) / L.

## 5. Warum eine Krümmungsfunktion ohne Gegenschwung nie tauglich ist

Dieser Abschnitt und die Integrale gelten für die Kleinwinkelform. Der genaue
Ausdruck ändert die Zahlen um Größen der Ordnung ψ_E² und h/R, nicht den Schluss.

Die Lösung mit f(0) = 0 und f′(0) = 0 lässt sich geschlossen schreiben:

    f(x) = −(1/ε) · ∫₀ˣ sinh((x − t)/ε) · k(t) dt

(Probe durch Ableiten: f″ = (f − k)/ε².) Ist k überall ≥ 0, dann ist f überall ≤ 0
und erreicht f(1) = 1 nicht. Eine tauglich einlaufende Rampe verlangt also, dass k
zuerst negativ wird. Das gilt für jedes ε > 0.

Die volle Tauglichkeit (zusätzlich f(1) = 1 und f′(1) = 0) sind zwei Bedingungen an k:

    ∫₀¹ k(t) · sinh((1 − t)/ε) dt = −ε
    ∫₀¹ k(t) · cosh((1 − t)/ε) dt = 0

Sie enthalten ε. Eine taugliche Halbwelle ist deshalb nicht maßstabsfrei, sondern
für ein bestimmtes ε = √(h · ψ_E · R) / L gebaut.

## 6. Nachgerechnet

| Fall | Ergebnis |
| --- | --- |
| Klothoide, k = x | f = x, Endsteigung 1,000: die lineare Rampe, unverändert |
| Bloss, k = 3x² − 2x³, ε = 0,134 | Endsteigungen 0,590 an beiden Enden (geschlossen gerechnet, deckt sich mit dem Wert des Moduls) |
| Alle 33 Transitionen der Datenbank | min k = 0, kein Gegenschwung, keine tauglich. Tabelle: `docs/app/architecture/evidence/TRANSED_PLAYGROUND_FINAL_20261110/coupling-suitability-scan.txt` |
| Probe: f = 10x³ − 15x⁴ + 6x⁵, k = f − ε²·f″, ε = 0,134 | min k = −0,073; die beiden Integrale ergeben −0,13416 (Soll −0,13416) und −1·10⁻⁷ (Soll 0) |

Die beiden Integralbedingungen aus Abschnitt 5 sind im Code noch nicht verwendet.
Das Modul löst die Gleichung mit finiten Differenzen und liest die Endsteigungen ab.

## 7. Was die Herleitung nicht leistet

- Kein Fahrzeugmodell: keine Federung, kein Wankpol, keine Massenverteilung.
- Keine kinematische Bewertung. Die Geschwindigkeit käme erst dort ins Spiel.

## 8. Abgleich mit AT 412 975 B

Quelle: `/Users/uwefalz/Documents/knowledge/bib/2002_Hasslinger_AT_412975_B.pdf`.
Nachrechnung: `docs/app/architecture/evidence/TRANSED_HASSLINGER_20261111/patent-check.mjs`,
Ausgabe `patent-check.txt` daneben.

| Punkt | Patent | Diese Notiz | Befund |
| --- | --- | --- | --- |
| Gleichung | (1): κ_H(s) = (κ_C/ψ_C)·ψ(s) − h·d²ψ/ds² | κ = κ_ref − h·ψ″ mit κ_ref = (κ_E/ψ_E)·ψ | gleich, auch im Vorzeichen (A2) |
| Forderung | Die unausgeglichene Seitenbeschleunigung in Trassierungshöhe, (8) β_Q = (κ_H·v² + h·α)/g − ψ mit (9) α = v²·ψ″, soll wie f verlaufen | A5: Krümmung der Bezugspunktbahn proportional zur Überhöhung | gleichwertig: Die Seitenbeschleunigung des Punkts in Höhe h ist v²·(κ + h·ψ″), also v² mal der Krümmung der versetzten Linie |
| Näherung | (8) rechnet mit ψ als Winkel, linear | A3, A4 | gleich: Das Patent ist selbst die Kleinwinkelform |
| Geschwindigkeit | fällt heraus; Beschreibung „von allen kinematischen Größen völlig unabhängig“ | kommt nicht vor | gleich |
| h | „Trassierungshöhe“: die Höhe, in der die unausgeglichene Seitenbeschleunigung betrachtet wird, etwa die des Schwerpunkts; in Fig. 1 senkrecht zur Gleisebene bis zum Punkt M | A1 | gleich; die Wahl von h bleibt frei |
| Allgemeine Form | (10), (11): ψ = ψ₁ + Δψ·f, κ_H = κ₁ + Δκ·f − h·Δψ·f″ | Gerade → Kreis | Verallgemeinerung: ε² = h·Δψ / (Δκ·l²) |

**Tabelle des Patents nachgerechnet.** l = 200 m, R₁ = −2000 m, u₁ = −64 mm,
R₂ = +800 m, u₂ = +160 mm, b = 1,5 m, Funktion (2). Die Höhe h nennt der Text nicht;
aus der Zeile s = 4 m folgt h = 1,7999 m. Mit h = 1,8 m treffen alle acht geprüften
Zeilen die Krümmung auf sieben Stellen (größte Abweichung 4,5·10⁻⁷ 1/km). Für diesen
Fall ist ε² = 0,00384, ε = 0,062; die normierte Krümmung läuft von −0,008 bis 1,008.

**Die `vienna`-Einträge der Datenbank sind Hasslingers Überhöhungsfunktionen.**
`vienna2` bis `vienna7` decken sich mit den Funktionen (2) bis (7) des Patents
(größte Abweichung 3·10⁻¹⁰, sonst unter 10⁻¹³). Die Datenbank führt sie als
Krümmung. Das ist der Fall h = 0 (Anspruch 3) und erklärt, warum der
Tauglichkeits-Scan auch dort keinen Gegenschwung fand. Als Überhöhung erklärt und
mit h > 0 über Gleichung (1) gerechnet, liefern dieselben Funktionen den
ausschwingenden Krümmungsverlauf von Fig. 3. Die Konstante der Funktion (3) ist
Z = 2 · 4,49340946; die Datenbank hat sie richtig.

**Glattheit.** Das Patent verlangt von f mindestens drei, für die Biegetheorie der
Schiene vier Ableitungen mit endlichen Werten. Aus f″ = (f − k)/ε² folgt: f″ ist an
den Enden null, sobald k dort 0 und 1 trifft; f‴ ist null, sobald zusätzlich f′ und
k′ dort null sind. Die Tauglichkeitsprüfung im Modul las zunächst nur die
Endsteigung f′. Seit 2026-11-12 (Auftrag Uwe) liest sie f′, f″ und f‴ an beiden
Enden und nennt die erreichte Ordnung.

| Ordnung | Bedingung an den Enden | Bedeutung |
| --- | --- | --- |
| 1 | f′ = 0 | kein Knick der Rampe |
| 2 | zusätzlich f″ = 0 | drei endliche Ableitungen, Mindestforderung des Patents |
| 3 | zusätzlich f‴ = 0 | vier endliche Ableitungen, Biegetheorie der Schiene |

Verlangt ist in der Voreinstellung Ordnung 2; auf der Seite lässt sich 1, 2 oder 3
wählen. Grenzen: f′ gegen 0,02 wie bisher; f″ und f‴ gegen 0,02 mal ihren
größten Betrag auf der Rampe (mindestens 1), weil ihre Größe mit 1/ε² wächst. Ist
die Krümmung gegeben, kommt f″ aus der Gleichung, f‴ aus der Ableitung davon; ist
die Überhöhung gegeben, ist f″ die erklärte Funktion und f‴ ihre numerische
Ableitung. Mit dem Beispiel des Patents (ε = 0,062), als Überhöhung gelesen:

| Eintrag | f″ an den Enden | f‴ an den Enden | erreichte Ordnung |
| --- | --- | --- | --- |
| `vienna2`, `vienna3`, `vienna5`, `vienna6`, `vienna7` | 0 | 0 (numerischer Rest unter 0,12) | 3 |
| `vienna4` | 0 | 43,5 | 2 |
| `bloss` | ±6 | −12 | 1 |
| `clothoid` | 0 | 0 | 0 (f′ = 1) |

Als Krümmung gelesen bleibt jeder dieser Einträge bei Ordnung 0, weil schon f′
nicht null ist.

**Mit dem genauen Ausdruck (seit 2026-11-13).** Die Tabelle des Patents ist die
Kleinwinkelform und bleibt so nachgerechnet. Die Seite rechnet für dasselbe
Beispiel mit ψ_E = arcsin(224/1500) = 0,1499 und h/R = 0,00315: ε = 0,0621 statt
0,0620, und `vienna2` als Überhöhung gibt die Krümmung −0,00835 … 1,0082 statt
−0,0083 … 1,0083. Die Ordnungen der Tabelle oben ändern sich nicht. Mit h = 2,5 m
statt 1,8 m wird daraus −0,0141 … 1,0139. Die Klothoide als Krümmung gibt die
Endsteigungen 0,9995 und 1,0021: die Rampe ist fast, aber nicht mehr genau linear.
Werte: `docs/app/architecture/evidence/TRANSED_EXACT_20261113/exact-journey-single-file.json`.

## 9. Entschieden von Uwe (2026-11-13)

1. **Modell bestätigt.** Der Modellvorbehalt auf der Seite entfällt.
2. **Der genaue Ausdruck gilt**, (κ + d″)/(1 − κd) mit d = h·sin ψ, nicht die
   Kleinwinkelform des Patents. Umgesetzt wie in Abschnitt 1 und 3; die
   Kleinwinkelform bleibt im Modul für den Aufruf mit bloßem ε. Annahme von Claude
   dabei: Auch ψ_E wird genau genommen, ψ_E = arcsin(Überhöhung / Stützweite); und
   d′² bleibt vernachlässigt, weil der Ausdruck es nicht enthält.
3. **h = 1,8 m ist die Voreinstellung, editierbar.** So steht es auf der Seite
   (Feld „Bezugshöhe h“) und in `DEFAULT_COUPLING_ASSUMPTION`.
4. **f″ = 0 reicht aus** (Ordnung 2, die Voreinstellung). f‴ = 0 geht an der
   Realität vorbei: Die allermeisten Übergangsbögen sind Klothoiden, deren Rampe an
   den Enden knickt. Ordnung 3 bleibt auf der Seite wählbar, verlangt ist sie
   nicht. Die Grenzen (f′ gegen 0,02; f″ gegen 0,02 mal den größten Betrag auf der
   Rampe, mindestens 1) sind weiter eine Annahme von Claude und stehen in
   `cantCurvatureCoupling.js`.

Erledigt (Stand 2026-11-12): Die Frage, ob die `vienna`-Halbwellen als Überhöhung
erklärbar werden sollen, hat Uwe mit einem Auftrag beantwortet. In Modus 2 der
Spielwiese gibt es „Die Halbwellen lesen als“ (Krümmung oder Überhöhung). Die
eingebauten Einträge bleiben unverändert; die andere Lesart ist ein eigener Eintrag
`<Kennung>_CANT` mit `quantity: "cant"` auf demselben Prototyp. Mit `vienna2` und
dem Beispiel des Patents ergibt sich die Krümmung −0,0083 … 1,0083 bei ε = 0,062,
wie in Abschnitt 8 nachgerechnet.
