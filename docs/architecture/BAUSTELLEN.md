# 🚧 BAUSTELLEN.md

## Zweck

Diese Datei ist eine **automatisch generierbare Übersicht aller offenen Baustellen im Code**.

Quelle sind strukturierte Kommentare im Code:

@baustelle [TAG] Beschreibung...

---

## 🧭 Prinzip

- Code ist **Single Source of Truth**
- Diese Datei ist nur eine **Projektion**
- Manuelle Änderungen sind erlaubt, aber werden überschrieben

---

## 🏷️ Baustellen-Kategorien

| Tag | Bedeutung |
|-----|----------|
| SEMANTIC-DICT | Mapping auf landXML-Semantik noch unvollständig |
| LAYOUT-CHECK | Abgleich mit Parser-Layout fehlt |
| REGISTRY-CHECK | Abgleich mit Transition-Registry fehlt |
| NORMALIZATION | Werte werden noch nicht korrekt normalisiert |
| CONTINUITY | Krümmungs-/Richtungsstetigkeit noch nicht behandelt |
| PROJECTION | View/Geometry-Projektion noch unvollständig |
| VALIDATION | Validator zu schwach / unvollständig |
| UX | UI/Preview noch provisorisch |
| PERFORMANCE | Optimierung offen |
| ARCH | Architekturentscheidung noch nicht final |

---

## 🔥 Aktuelle Baustellen

### SEMANTIC-DICT

- validateParserModule.js  
  → semanticMap Targets werden noch nicht gegen Dictionary geprüft

- validateParserModule.js  
  → override.target wird nicht validiert

---

### REGISTRY-CHECK

- validateParserModule.js  
  → transTypeMap wird nicht gegen Transition-Registry geprüft

---

### LAYOUT-CHECK

- validateParserModule.js  
  → fieldMap nicht gegen VERMESN_LAYOUT_SOURCE geprüft

---

### CONTINUITY

- buildSparseFromLandFAT.js  
  → Krümmungsstetigkeit (R → R1 Übergänge) nicht behandelt

- buildSparseFromLandFAT.js  
  → Alternation nur strukturell, nicht fachlich korrekt

---

### NORMALIZATION

- vermEsn.TRA  
  → deltaDirection (gon_cw_west) noch nicht systemweit normalisiert

---

### PROJECTION

- AlignmentProjection  
  → derzeit nur poseA-Polyline, keine echte Geometrie

---

### VALIDATION

- validateSparse.js  
  → nur Strukturprüfung, keine fachliche Konsistenz

---

## 🧪 Offene Fachthemen (Alerts)

### GRA

- Gleisscheren-Semantik  
  → Feldbedeutung kontextabhängig, aktuell nur Marker

- km-Sprung-Marker  
  → große Tangentenlängen als Marker, nicht ausgewertet

---

## 🧰 Generierung (geplant)

Baustellen werden aus Code extrahiert:

grep -R "@baustelle" src/

Ziel:
- Parser liest Tags
- gruppiert nach Kategorie
- erzeugt diese Datei automatisch

---

## 🧠 Langfristiges Ziel

- Baustellen sind immer sichtbar
- keine „vergessenen TODOs“
- Architektur bleibt bewusst unvollständig (aber transparent)

---

## 🧭 Regel

Kein offenes Problem ohne @baustelle-Tag im Code.
