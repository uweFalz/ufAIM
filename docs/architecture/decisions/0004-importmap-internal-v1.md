# 0004 – Internal ImportMap v1

Status: Übergangslösung

Die interne ImportMap wurde aus `index.html` nach
`config/importmap.internal.json` ausgelagert.

Ziel:
- physische Ablage von logischer Modulidentität entkoppeln
- Window-Boot über zentrale ImportMap vorbereiten

Wichtig:
- v1 bildet den aktuellen Bestand ab
- noch nicht die endgültige Ziel-Namensstruktur
- Worker-Auflösung bleibt vorerst separat zu behandeln
