# ARCH_FREEZE_A1_KERNEL_IMPORTMAP.md
Status: Draft A1 (ImportMap / Alias Boundary)
Datum: 2026-02-26

## Ziel
Die ImportMap soll zwei Dinge garantieren:

1) **Lesbarkeit & Stabilität**: Kernel-Imports sehen überall gleich aus.  
2) **Boundary Enforcement**: Es ist schwer (idealerweise unmöglich), aus Kernel-Dateien “aus Versehen” in UI/IO/View zu importieren.

Das Repo hat zwei Äste:
- `/src` = Knowledge Base (Kernel + kernel-safe libs)
- `/app` = Playground (UI/IO/View/Bridge/Harness)
- `/src` ist nach `/app/src` gelinkt → `/app` kann wie gewohnt `@src/*` importieren.

---

## A1 Alias-Konzept
Wir definieren Aliase **nach Rollen**, nicht nach Ordnern.

### Kernel-Aliase (dürfen in Kernel-Dateien verwendet werden)
- `@kernel/*`  → Kernel-Root (Alignment Kernel)
- `@kgeom/*`   → kernel-safe geometry
- `@kmath/*`   → kernel-safe numeric

### App/Playground-Aliase (dürfen NICHT im Kernel auftauchen)
- `@app/*`     → Playground
- `@ui/*`      → Views, Panels, JSXGraph etc.
- `@io/*`      → IO/Persistenz/Netzwerk/File APIs
- `@bridge/*`  → Bridges zwischen UI und Kernel

**A1-Regel:** Kernel-Dateien dürfen nur `@kernel/*`, `@kgeom/*`, `@kmath/*` und relative Imports innerhalb dieser Bereiche nutzen.  
Alles andere ist ein Boundary-Verstoß.

---

## Konkreter Mapping-Vorschlag (ImportMap)
In `index.html` (oder zentraler ImportMap-Datei), z. B.:

```html
<script type="importmap">
{
  "imports": {
    "@kernel/": "./src/alignment/",
    "@kgeom/":  "./src/lib/geom/",
    "@kmath/":  "./src/lib/math/",
    "@src/":    "./src/",
    "@app/":    "./app/",
    "@ui/":     "./app/view/",
    "@bridge/": "./app/core/",
    "@io/":     "./app/io/"
  }
}
</script>
