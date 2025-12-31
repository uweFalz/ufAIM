# AIM_WORKING_CONTRACT.md
## ufAIM_v0omega

Stand: v0 / lebendig  
Dieses Dokument ist **verbindlich**, aber **änderbar**.  
Es beschreibt **Ziel, Weg und Grenzen** der Zusammenarbeit und der Architektur.

---

## 1. Ziel von AIM_v0omega

AIM_v0omega ist ein **minimaler, funktionaler Prototyp** für

> **Alignment-based Information Modelling (AIM)**  
> verständlich, korrekt, lehrbar.

Ziel ist **nicht**, die Welt zu verändern,  
sondern **sie ein Stück besser zu machen**, indem:

- Alignment- und Geometrie-Knowhow explizit wird
- Koordinatenverständnis entmystifiziert wird
- Mathematik als Werkzeug sichtbar und nutzbar wird
- ein Fundament für spätere Anwendungen entsteht

AIM_v0omega ist **Anker + Dynamik + Erklärung**.

---

## 2. Kernbausteine (v0 – nicht verhandelbar)

### 2.1 CoordAgent (Anker / Weltbezug)
- expliziter CRS-Vertrag (kein nacktes [x,y])
- Transformation nach/von WGS84
- lokales Referenzsystem (ENU / Projektframe)
- Kennzeichnung von Genauigkeit / Annahmen

Der CoordAgent ist **Wächter**, nicht Rechenknecht.

---

### 2.2 AlignmentCore (Dynamik / Kinematik)
- 1D-Parameter `s` (Station) als treibende Größe
- funktionale Beschreibung:
  - Position
  - Richtung
  - Krümmung / Höhe
- FixElemente + TransitionElemente
- explizite Kontinuität (mind. G¹)

Das Alignment ist **Funktion**, nicht Polyline.

---

### 2.3 Mathematik & Physik
- liefern das Rechenwerk und die Regeln
- werden **sichtbar**, nicht versteckt
- sind prüfbar (Tests / Referenzfälle)
- sind erklärbar (kein „ist halt so“)

In v0 gilt:
> Constraints vor Simulation.

---

## 3. Was AIM_v0omega bewusst NICHT ist

- kein vollständiges BIM-System
- kein Optimierer
- kein Regelwerks-Monster
- kein Performance-Endgame
- kein didaktisches Lehrbuch

AIM_v0omega ist **Grundlage**, kein Endprodukt.

---

## 4. Architekturprinzipien (verbindlich)

### 4.1 Modul = Datei
- ein Gedanke = eine Datei
- mehrere Exporte pro Modul erlaubt
- keine künstliche Klassen-Zersplitterung

---

### 4.2 Interfaces vor Implementierung
- jedes Kernmodul wird zuerst als Interface gedacht
- Implementierung folgt erst nach Freigabe
- Interfaces dürfen stabil bleiben, intern darf sich alles ändern

---

### 4.3 Explizit statt implizit
- CRS, Einheiten, Annahmen immer benannt
- keine stillen Defaults
- Sniffen ist erlaubt, **Verschweigen nicht**

---

### 4.4 Fehler sind Daten
- Fehler und Unsicherheiten werden als Objekte behandelt
- kein „console-only“-Fehlerverhalten
- lieber ein ehrliches `unknown` als falsche Präzision

---

### 4.5 UX = Didaktik
- UI ist kein Beiwerk
- Visualisierung erklärt Zustände und Zusammenhänge
- Nutzer sollen *sehen*, was gerechnet wird

---

## 5. Qualitätskriterien: „gut genug“ für v0

Ein Modul darf Teil von AIM_v0omega sein, wenn:

1. es ein klares Interface besitzt
2. Annahmen explizit benannt sind
3. mindestens einfache Referenzfälle existieren
4. es keinen globalen Zustand versteckt
5. es ohne Build-Chain im Browser lauffähig ist

Perfektion ist **kein Kriterium**.  
Nachvollziehbarkeit ist eines.

---

## 6. Arbeitsweise (Zusammenarbeit)

- Zusammenarbeit erfolgt **asynchron**
- gemeinsame Artefakte sind:
  - dieses Contract-Dokument
  - Interfaces
  - Snapshots (Dateien, Bäume, Diffs)

Regel:
> **Keine Implementierung ohne geklärtes Interface.**

Der Mensch steuert die Richtung,  
das System erzwingt die Klarheit.

---

## 7. Änderung dieses Dokuments

- Änderungen sind erlaubt
- aber **bewusst** und **explizit**
- dieses Dokument wächst mit AIM

---

## 8. Leitsatz

> AIM_v0omega baut kein fertiges System.  
> Es baut **Verständnis**, das Systeme möglich macht.
