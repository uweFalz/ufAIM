# ufAIM Super Scripts

## Install

Copy into repo:

```bash
cp consolidate_docs.sh tools/consolidate_docs.sh
cp produce.sh tools/produce.sh
chmod +x tools/consolidate_docs.sh tools/produce.sh
```

## Docs consolidation

Dry-run:

```bash
tools/consolidate_docs.sh
```

Apply:

```bash
tools/consolidate_docs.sh --apply
```

Set a chosen master diagram:

```bash
tools/consolidate_docs.sh --current docs/architecture/diagrams/some_map.puml --apply
```

## Production companion

```bash
tools/produce.sh check      # fast sanity checks
tools/produce.sh docs       # apply docs structure consolidation
tools/produce.sh diagrams   # run existing generateDiagrams.sh
tools/produce.sh dump       # create repo tgz in tools/dist
tools/produce.sh bundle     # create git bundle in tools/dist
tools/produce.sh release    # checks + diagrams + dump + bundle; no push
tools/produce.sh release --push
```

## Principle

- `consolidate_docs.sh` reduces docs/diagram chaos.
- `produce.sh` is the daily production companion.
- Neither script deletes files.
- Push is never implicit.
