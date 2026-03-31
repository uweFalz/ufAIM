# ufAIM – Pending Architecture Topics

## Pending

- Alignment-/Transition-Kern fertig glätten
- Worker-/Service-Schnitt weiter entschlacken
- CRS / CoordinateAgent / mapLibre systematisch wieder aufnehmen
- Solver-Eingabeformat für axtranSolver vorbereiten
- axtranSolver als eigenes Modul nach `src/solver/`
- GNDedit-Import nach erstem MVP erweitern (Mapping, Warnungen, Tests)
- SPOT-/Sparse-Vertrag zentralisieren, Import-Validator später an Kernvertrag anbinden

Das passt zur Architekturbegründung:

- Transition ist Kern-IP
- CRS ist Pflicht-Feature
- Solver ist eigene Domäne
- Import ist Erkenntnis-Pipeline, nicht nur File-Load
- Sparse/SPOT ist Kernvertrag, nicht Import-Sonderlogik

## Core

- SPOT persistence
- Project model
- CRS agent
- sparse/SPOT schema + validator ownership

## Import

- full landXML coverage
- TRA/GRA normalization
- IFC import
- Import nutzt Kernvertrag, definiert ihn aber nicht dauerhaft

## Geometry engine

- transition lookup system
- solver integration
- topology support
- runtime transition descriptor for alignment engine

## UI

- Grabbeltisch
- View picking
- editor tools
