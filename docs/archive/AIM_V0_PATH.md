# AIM_V0_PATH.md
## ufAIM_v0omega – Weg & Meilensteine

Dieses Dokument ergänzt den AIM_WORKING_CONTRACT.
Es beschreibt **den Weg**, nicht nur das Ziel.

---

## 1. Zweck von AIM_v0omega

AIM_v0omega ist ein **Fundament-Prototyp**.

Er dient dazu:
- Verständnis aufzubauen
- falsche Komplexität zu entfernen
- zentrale Begriffe zu stabilisieren
- eine gemeinsame Sprache zu schaffen

AIM_v0omega ist erfolgreich,  
wenn er **verstanden**, **nicht bewundert** wird.

---

## 2. Prinzip: Erst Anker, dann Bewegung

Der Weg ist bewusst zweistufig:

1. **Weltbezug herstellen** (CoordAgent)
2. **Bewegung entlang von Regeln** (AlignmentCore)

Alles Weitere baut darauf auf.

---

## 3. Meilensteine v0 (in Reihenfolge)

### M0 — Boot & Sichtbarkeit
- Browser-nativer Start (index.html, main.js)
- kein Build-System
- visuelles „System lebt“-Signal
- Smoke-Test

Erfolgskriterium:
> Das System startet überall gleich und verständlich.

---

### M1 — CoordAgent v0 (Anker)
- expliziter CRS-Vertrag
- WGS84 als Referenz
- lokales Projekt-Frame
- Kennzeichnung von Genauigkeit / Annahmen

Erfolgskriterium:
> Kein Punkt existiert ohne Weltkontext.

---

### M2 — AlignmentCore v0 (Dynamik)
- 1D-Station `s`
- funktionale Auswertung P(s), T(s)
- Fix- & Transition-Elemente
- explizite Kontinuität (mind. G¹)

Erfolgskriterium:
> Ein Alignment ist eine Funktion, kein Zeichenobjekt.

---

### M3 — Mathe sichtbar machen
- zentrale Rechenfunktionen benannt
- Referenzfälle / Tests vorhanden
- numerische Grenzen explizit

Erfolgskriterium:
> Jede Zahl kann erklärt werden.

---

### M4 — Erste AIM-Interaktion
- Datei rein → Alignment sichtbar
- Abfrage von s → Position / Richtung
- einfache visuelle Rückmeldung

Erfolgskriterium:
> Nutzer können mit dem Modell „sprechen“.

---

## 4. Abbruchkriterien für v0

AIM_v0omega endet bewusst, wenn:
- die Grundlagen stabil sind
- weitere Features nur noch „mehr vom Gleichen“ wären
- Optimierung oder Regelwerke nötig würden

**Kein Feature-Creep.**

---

## 5. Definition von Erfolg (v0)

AIM_v0omega ist erfolgreich, wenn:
- Studierende es verstehen können
- Fachleute es ernst nehmen
- Erweiterungen möglich sind, ohne Bruch

v0 ist kein MVP.  
v0 ist ein **Referenzpunkt**.
