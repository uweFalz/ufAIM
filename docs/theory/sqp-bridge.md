# SQP-Bridge — vom Normbogen zur Einbettung

Dieses Dokument beschreibt die konzeptionelle Brücke
zwischen normierten Übergangsbogen-Familien
und ihrer realen Einbettung in eine Trasse.

Es ist bewusst **methodisch**, nicht implementierend.

---

## 1. Problemstellung

Gegeben:
- eine Gerade
- ein Kreisbogen
- Anschlussbedingungen (z. B. G¹, G²)

Gesucht:
- eine Einbettung eines Übergangsbogens
- aus einer vorgegebenen **Formfamilie**
- mit freien Skalierungsparametern

Das Problem ist **nicht zeichnerisch lösbar**,
sondern ein Optimierungsproblem.

---

## 2. Trennung der Ebenen

AIM trennt strikt:

### Normraum
- \( \kappa(u) \in [0,1] \)
- beschreibt **Form**
- unabhängig von Länge, Radius, Koordinaten

### Einbettung
- reale Länge \( L \)
- Krümmungsniveau \( k_0, k_1 \)
- Koordinaten, Orientierung

Diese Trennung ist Voraussetzung für Optimierung.

---

## 3. Freiheitsgrade

Typische freie Variablen:
- Übergangslänge \( L \)
- Verhältnisparameter \( w_1, w_2 \)
- ggf. Zusatzparameter der Teilfunktionen

Diese Variablen sind **kontinuierlich**,
aber durch Nebenbedingungen eingeschränkt.

---

## 4. Nebenbedingungen

Beispiele:
- geometrischer Anschluss an Gerade/Bogen
- G¹-/G²-Stetigkeit
- Begrenzung von Krümmungsänderung
- Komfortkriterien (Ruck)

Viele dieser Bedingungen sind **nichtlinear**.

---

## 5. Zielfunktionen

Mögliche Zielgrößen:
- minimale Übergangslänge
- minimale maximale Krümmungsänderung
- minimierter Ruck
- gewichtete Kombinationen

Es gibt **nicht die eine richtige Zielfunktion**.

---

## 6. Warum SQP?

Sequential Quadratic Programming (SQP):
- geeignet für nichtlineare Nebenbedingungen
- arbeitet lokal, aber effizient
- erlaubt klare Trennung von Ziel und Zwang

Für Trassierungsprobleme ist SQP
oft natürlicher als heuristische Verfahren.

---

## 7. Rolle in ufAIM

In ufAIM ist der SQP-Solver:
- **kein Black Box**
- sondern ein nachgeschalteter Spezialist

Der Transition Editor liefert:
- eine Formfamilie
- plausible Startwerte
- ein Verständnis des Suchraums

Der Solver liefert:
- eine konsistente Einbettung

---

## 8. Perspektive: Axtran-next

Historische Systeme (z. B. AXTRAN)
haben ähnliche Probleme gelöst,
aber oft:
- monolithisch
- fest verdrahtet
- schwer erweiterbar

AIM trennt erstmals sauber:
- **Form**
- **Einbettung**
- **Optimierung**

Das eröffnet neue Spielräume.
