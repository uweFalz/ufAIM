# ARCH_FREEZE_A1_KERNEL.md
Status: Draft A1 (Kernel Boundary Manifest)
Datum: 2026-02-26

## Leitidee
- `/src` = Knowledge Base (Kernel + kernel-safe libs)
- `/app` = Playground (UI, IO, View, Editor, Debug, Harness)
- `/src` ist nach `/app/src` gelinkt → Single Source of Truth bleibt `/src`.

A1 definiert eine **harte Kernel-Grenze**:
- Kernel darf **keine** Abhängigkeiten haben zu:
  - DOM/Browser APIs (`window`, `document`, `localStorage`, `fetch`, `FileReader`, …)
  - UI/Views/Frameworks (JSXGraph, mapLibre, three.js, …)
  - App-State / Controller-Singletons
  - IO (Datei, Netzwerk, Persistenz)
- Kernel erlaubt:
  - reine Mathematik/Geometrie
  - deterministische Pure Functions + kleine Klassen ohne Seiteneffekte
  - “Datenbank” als *Input* (lookup JSON wird in A1 **außerhalb** des Kernels injiziert)

---

## A1 Kernel: Alignment Compute (clean)
Diese Dateien/Ordner sind **Kernel** und müssen kernel-safe bleiben:

### Alignment Core
- `src/alignment/Alignment2D.js`
- `src/alignment/AlignmentBuilder.js`

### Alignment Elements
- `src/alignment/elements/**`

### Transition / Registry / AST
- `src/alignment/transition/**`
- `src/alignment/registry/**`
  - `src/alignment/registry/RegistryCompiler.js`
  - `src/alignment/registry/transitionLookup.json` *(siehe A1-Regel zur DB-Injektion unten)*
  - `src/alignment/registry/ast/**`
    - `buildProtoAst.js`
    - `evalAst.js`
    - `simplify.js`
    - `symDiff.js`
    - `symInt.js`
  - `src/alignment/registry/compose/**`
    - `computeAnchorsFromTotal.js`

A1-Policy für RegistryCompiler:
- `RegistryCompiler` ist Kernel.
- Das Default-lookup-JSON ist **kein Kernel-Code**, sondern “Kernel Data”.
- In A1 wird empfohlen:
  - Kernel-Code: `new RegistryCompiler(db)` (DB immer als Parameter)
  - Playground: importiert Default-DB und reicht sie in den Kernel.

---

## A1 Kernel-safe Shared Libs (Minimal Deps)
Diese Dateien sind derzeit kernel-safe und werden vom Alignment-Kern genutzt:

### Geometrie/Frame/Curve
- `src/lib/geom/curve/Curve2D.js`
- `src/lib/geom/frame/pose2.js`
  - NOTE (Cleanup-Marker): `applyLocalDelta()` nutzt `poseA.theta` (inkonsistent zu `{p:{x,y}, t:{x,y}}`). Nicht kritisch für A1, aber markieren.

### Numerik
- `src/lib/math/numeric/romberg.js`

A1-Regel:
- Alles unter `src/lib/**` bleibt nur dann kernel-safe, wenn es die Kernel-Regeln erfüllt.
- Langfristig: Kandidat für Umzug nach `src/kernel/*` oder klarere “kernel-safe” Unterteilung.

---

## Nicht Kernel (Playground: UI/IO/View/Bridge/Harness)
Diese Dateien sind **explizit außerhalb** des Kernels:

### Transition Editor UI (JSXGraph, DOM)
- `app/view/transitionEditorView.js`
- `app/core/transitionEditorBridge.js`

### Dev/Test Harness (darf Kernel nutzen, aber nicht andersrum)
- `app/view/_e2eAlignmentTest.js`

A1-Regel:
- Playground darf Kernel importieren.
- Kernel darf niemals Playground importieren.

---

## A1 Boundary Checks (mechanische Regeln)
Diese Regeln gelten für *alle Kernel-Dateien*:

### Verbotene Imports in Kernel
- `app/**`
- `src/modules/**`
- `src/view/**`
- `src/core/**`
- `maplibre*`, `three*`, `jsxgraph*`
- alles was “Bridge/Controller/View/Panel/Overlay” heißt

### Verbotene Globals in Kernel
- `window`, `document`, `navigator`
- `localStorage`, `sessionStorage`
- `fetch`, `XMLHttpRequest`, `FileReader`

### Erlaubt
- Mathe/Geom/Utility
- JSON als Dateninput (aber kein “IO”)

---

## A1 Offene Punkte (nach Freeze, nicht davor)
1. **RegistryCompiler Default-DB-Injektion**
   - Ziel: `src/alignment/registry/RegistryCompiler.js` hat keinen hard-coded JSON-default mehr.
   - Playground liefert Default-DB.

2. **pose2.js Cleanup**
   - `applyLocalDelta()` konsistent machen (theta vs. dir/tangent).

3. **Optional: Kernel Namespace**
   - späterer Umzug nach `src/kernel/alignment/**` + `src/kernel/geom/**` + `src/kernel/math/**`.
   - A1 muss das nicht sofort machen, aber Manifest bleibt die Referenz.

---

## A1 Definition of Done
- Alignment/Registry läuft vollständig ohne Playground-Abhängigkeiten.
- TransitionEditor (Playground) nutzt Kernel über klare Imports / DB-Injektion.
- Keine UI/IO-Leaks in Kernel-Dateien (siehe Regeln oben).
