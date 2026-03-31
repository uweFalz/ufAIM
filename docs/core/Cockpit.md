# Cockpit (ufAIM)

## Zweck

Das Cockpit ist die zentrale Interaktionsinstanz des Systems.

Es vermittelt zwischen:
- SPOT (System of Persistent Truth)
- WorkspaceViews (Darstellung)
- User-Intention (Aktionen)

Das Cockpit ist KEIN View.
Das Cockpit ist KEIN Datenmodell.

Das Cockpit ist:
→ die operative Steuerungsebene.

---

## Grundprinzipien

### 1. SPOT ist Wahrheit
Das Cockpit verändert SPOT – aber besitzt ihn nicht.

### 2. Views sind dumm
Views zeigen nur Zustände.
Keine Logik, keine Interpretation.

### 3. Cockpit ist aktiv
Alle Benutzeraktionen laufen über das Cockpit.

---

## Minimaler Scope (v0)

Das Cockpit kennt genau folgende Aktionen:

### ingestImport(importResult)

Importierte Daten werden in SPOT abgelegt.

- keine Interpretation
- keine Klassifikation
- keine Geometrieänderung

Ergebnis:
- spotItems entstehen
- markiert als:
  - spotCandidates
  - workingItems


---

### select({ ids, mode })

Setzt die aktuelle Auswahl.

mode:
- replace
- add
- remove

→ betrifft nur Cockpit-State, nicht SPOT


---

### assignRole({ id, role })

Weist einem SPOT-Item eine Rolle zu.

Beispiele:
- km
- right
- left
- profile
- cant

Schreibt nach:
spot.items[id].meta.role


---

### remove({ id })

Entfernt ein Item aus SPOT.


---

### buildPreview({ ids? })

Erzeugt darstellbare Daten für Views.

Input:
- explizite IDs oder aktuelle Auswahl

Output:
- alignment2d preview (aus sparseAlignment)
- profile1d
- cant1d

Wichtig:
→ ersetzt buildImportArtifacts.js


---

## Cockpit-State (minimal)

```js
{
  selection: [],
  mode: "idle"
}


⸻

SPOT-Erwartung

Das Cockpit erwartet SPOT-Struktur:

spot = {
  items: {
    [id]: {
      kind,
      payload,
      meta: {
        role: null | "km" | "right" | "left" | ...
      }
    }
  }
}


⸻

Abgrenzung

NICHT Aufgabe des Cockpit
	•	Parsing
	•	landFAT-Erzeugung
	•	sparse-Build
	•	Geometrieberechnung

NICHT Aufgabe der Views
	•	Rollenlogik
	•	Datenklassifikation
	•	Importverarbeitung

⸻

Zielbild

Das Cockpit ersetzt den bisherigen “Grabbeltisch”.

Es ist:
	•	direkt
	•	datengetrieben
	•	ohne Fensterbindung
	•	vollständig kontrollierbar durch User-Aktion

⸻

Leitidee

Import ist kein fertiges Ergebnis.

Import ist:
→ Material im Cockpit

---

# 📌 MiniBoard-Eintrag

```md
## [Cockpit v0 – Interaktionskern]

**Ziel**
Einführung einer zentralen Interaktionsschicht zwischen SPOT und Views.

**Warum**
Aktuell:
- Import → Zwischenwelt → Artifact-Builder → unklar
- Logik verteilt
- keine klare User-Kontrolle

Neu:
- SPOT = Wahrheit
- Cockpit = Handlung
- Views = Darstellung

---

**Scope (minimal)**
- ingestImport
- select
- assignRole
- remove
- buildPreview

---

**Konsequenzen**
- buildImportArtifacts.js wird obsolet
- Preview kommt aus Cockpit
- Import landet direkt in SPOT

---

**Definition of Done**
- Import landet sichtbar im Cockpit
- Auswahl funktioniert
- Preview zeigt sparse-basierte Geometrie
- keine Artifact-Zwischenlogik mehr notwendig

---

**Next Steps**
1. CockpitController (minimal, ohne Framework)
2. SPOT write/read API (klein halten)
3. Preview direkt aus sparseAlignment

