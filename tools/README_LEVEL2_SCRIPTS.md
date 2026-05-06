# ufAIM Super Scripts – Level 2

## Dateien

- `consolidate_docs_v2.sh` – konsolidiert `docs/`, Diagramme und erzeugt Kern-MD-Stubs.
- `produce_v2.sh` – Produktionsbegleiter: Checks, Reports, Dumps, Bundles, Diagramm-Rendering, lokaler Server.

## Installation

```bash
cp consolidate_docs_v2.sh tools/consolidate_docs_v2.sh
cp produce_v2.sh tools/produce_v2.sh
chmod +x tools/consolidate_docs_v2.sh tools/produce_v2.sh
```

## Erstlauf

```bash
tools/produce_v2.sh check
tools/consolidate_docs_v2.sh
```

## Konsolidieren

Dry-run:

```bash
tools/consolidate_docs_v2.sh
```

Scharf:

```bash
tools/consolidate_docs_v2.sh --apply
```

## Produktionsbegleitung

```bash
tools/produce_v2.sh check      # Architektur-/Code-Hygiene
tools/produce_v2.sh report     # Markdown-Report unter docs/reports/
tools/produce_v2.sh dump       # Textdump für Analyse
tools/produce_v2.sh bundle     # ZIP-Bundle unter tools/dist/
tools/produce_v2.sh release    # check + report + diagrams + bundle
tools/produce_v2.sh serve 8081 # lokaler Server
```

## Level-2-Fokus

Diese Scripts prüfen gezielt:

- SPOT-Runtime darf nicht wieder in Import-`payload` zurückfallen.
- `data.kernel` ist der neue Projection-Zugriff.
- CRS muss im Cockpit sichtbar werden.
- Console/Debug-Ausgaben werden sichtbar gemacht, damit sie später ins Feedback Overlay wandern.
- Es soll genau eine CURRENT-Architektur-PUML geben.

## Wichtig

Die Scripts sind bewusst konservativ. Sie löschen nichts automatisch. Legacy-PUMLs werden nur mit `--apply` verschoben.
