# Kopplung von Krümmung und Überhöhung über einen Bezugspunkt: Herleitung zur Prüfung

Stand 2026-11-11. Status: **Modellvorbehalt**. Diese Notiz legt die Herleitung
offen, die in `src/services/transition-library/cantCurvatureCoupling.js` gerechnet
wird, damit Uwe Vorzeichen und Näherungen prüfen kann. Die Herleitung stammt von
Claude. Der Originaltext Hasslinger 2002 lag dabei nicht vor; der Abgleich mit dem
Original ist Teil der Prüfung.

## 1. Ergebnis

Mit x = s/L auf [0, 1], normierter Krümmung k(x) und normierter Überhöhung f(x):

    k(x) = f(x) − ε² · f″(x),      ε² = h · ψ_E · R / L²

- h: Höhe des Bezugspunkts über der Gleisachse
- ψ_E: Überhöhungswinkel am Bogenende, ψ_E = Überhöhung / Stützweite
- R: Radius am Bogenende, L: Länge des Übergangsbogens
- Die Geschwindigkeit kommt nicht vor.

Beispiel: h = 1,8 m, Überhöhung 150 mm, Stützweite 1,5 m (ψ_E = 0,1), R = 1000 m,
L = 100 m ergibt ε² = 0,018, ε = 0,134.

## 2. Annahmen, die zu bestätigen sind

| Nr. | Annahme | Wo sie eingeht |
| --- | --- | --- |
| A1 | Der Bezugspunkt liegt um h über der Gleisachse, auf der Hochachse des geneigten Fahrzeugs. Er dreht um die Gleisachse, ohne Federung und ohne Wankpol. | Versatz d |
| A2 | Positive Überhöhung neigt zur Bogeninnenseite. Der Grundriss des Bezugspunkts liegt deshalb um d **nach innen** versetzt. | Vorzeichen von ε² |
| A3 | Kleiner Winkel: d = h · sin ψ ≈ h · ψ. | Versatz d |
| A4 | Der Versatz ist klein gegen den Radius: κ·d ≪ 1 und d′ ≪ 1. Im Beispiel ist κ·d = 1,8 · 10⁻⁴. | Krümmung der versetzten Linie |
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

**Vorzeichen (A2).** Läge der Bezugspunkt nach außen versetzt, hieße es
k = f + ε²·f″. Die Probe: Eine weiche Rampe hat am Anfang f″ > 0 bei f ≈ 0. Mit dem
Minuszeichen wird k dort negativ. Das ist der Gegenschwung des Wiener Bogens und
spricht für A2.

## 4. Beide Richtungen

**Hasslinger (f gegeben).** k folgt durch zweimaliges Ableiten. Ist f an den Enden
weich (f′ = 0 und f″ = 0), schließt k stetig an Gerade und Kreis an.

**Umgekehrt (k gegeben, Uwes Richtung).** Zu lösen ist f − ε²·f″ = k. Mit A6 sind
beide freien Konstanten verbraucht: f(0) = 0, f(1) = 1. Die Endsteigungen f′(0) und
f′(1) sind dann ein Ergebnis und keine Wahl.

- f′(0) = f′(1) = 0: Die Rampe läuft tangential ein und aus. Die Krümmungsfunktion
  ist für dieses ε schwerpunkt-tauglich.
- f′(0) ≠ 0: Die Rampe hat dort einen Knick. Die Bezugspunktbahn bekommt an dieser
  Station einen Richtungssprung der Größe h · ψ_E · f′(0) / L.

## 5. Warum eine Krümmungsfunktion ohne Gegenschwung nie tauglich ist

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
- Keine Aussage, welche Höhe h fachlich die richtige ist (Schwerpunkt, Kopfhöhe,
  anderer Bezug).
- Kein Abgleich mit Hasslinger 2002 im Wortlaut.

## 8. Fragen an Uwe

1. A2: Versatz nach innen, also k = f − ε²·f″. Stimmt das Vorzeichen mit Hasslinger?
2. A3/A4: Reichen Kleinwinkel und κ·d ≪ 1, oder soll der genaue Ausdruck
   (κ + d″)/(1 − κd) mit d = h·sin ψ gerechnet werden?
3. A5: Ist „Bezugspunktbahn proportional zur Überhöhung“ die Forderung, die du
   meinst, oder ist die Kopplung bei Hasslinger anders gefasst?
4. A1: Worauf bezieht sich h (Schienenoberkante oder Gleisachse, Schwerpunkt oder
   anderer Punkt)?
