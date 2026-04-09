# Contributing to ufAIM

## Ziel
Dieses Projekt entwickelt eine alignment-zentrierte Fachmaschine
für Railway Engineering (AIM – alignment-based Information Modelling).

Fokus:
- deterministische Fachlogik
- klare Modellstruktur
- reproduzierbare Ergebnisse
- saubere Trennung von Preview / Vorschlag / Commit

---

## Grundprinzipien

### 1. Fachkern ist deterministisch
- keine "intelligenten" Abkürzungen im Core
- keine versteckte Logik in Views
- keine KI im Fachkern

### 2. Vorschlag ≠ Commit
- alles beginnt als Vorschlag / Preview
- Commit erfolgt explizit über Commands

### 3. Klare Verantwortlichkeiten
- Domain (src/domain) = Fachlogik
- Import (src/import) = Parsing + Normalisierung
- Model (src/model) = Wahrheit + Zustand
- App (app/) = Workflow + Controller
- View (app/view) = Darstellung

### 4. Keine implizite Magie
- Datenflüsse müssen nachvollziehbar sein
- Provenance ist wichtig

---

## Arbeitsweise

### 1. Issue-basiert arbeiten
Für jede größere Änderung:
- Issue anlegen
- Ziel + Scope definieren

### 2. Branches
Naming:
- feat/...
- fix/...
- refactor/...
- docs/...

Beispiele:
- refactor/viewcontroller-split
- feat/provenance-store-v1

### 3. Commits
Kurz und präzise:

refactor: split view-only helpers from ViewController
fix: infer sparse.startPose for GND chains
feat: add ProposalContract_v1 skeleton

### 4. Pull Requests
- klein halten
- klar beschreiben
- selbst kurz reviewen vor Merge

---

## Code-Richtlinien

### Dateien
- klare Header mit Verantwortung / Nicht-Verantwortung
- keine „God-Files“

### Funktionen
- möglichst rein (pure functions), wo sinnvoll
- keine versteckten Side-Effects

### Naming
- beschreibend > kreativ

---

## Was wir vermeiden

- Fachlogik in Views
- direkte Modellmutation ohne Command
- unklare Zustände
- implizite Annahmen ohne Dokumentation

---

## Rolle von KI (wichtig!)

KI darf:
- erklären
- vorschlagen
- analysieren
- dokumentieren

KI darf NICHT:
- Fachlogik ersetzen
- direkt Modellzustände festlegen

---

## Zielbild

ufAIM ist:
- Fachkern + Modell + Workflow
- ergänzt durch KI als Copilot

Nicht:
- ein Chat-Tool
- keine Blackbox

