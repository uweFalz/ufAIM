# ufAIM — Alignment Engineering for Infrastructure & BIM

ufAIM is an alignment-centric engineering framework for railway infrastructure.

Instead of treating alignments as secondary geometry inside GIS, CAD or BIM
containers, ufAIM places the **alignment at the center of the engineering model**.

The project combines:

- a deterministic **sparse alignment kernel**
- an **engineering-grade import pipeline**
- a **multi-tool reference application**

The goal is to enable reliable modelling, analysis and optimisation of railway alignments.

---

# Documentation

The main documentation is located in `/docs`.

Start here:

- **VISION.md** — long-term goals of the project
- **CORE_CONCEPTS.md** — conceptual model
- **ARCHITECTURE.md** — system architecture

Core technical documents:

- **SPOT_MODEL.md** — canonical project data model
- **SparseAlignment.md** — geometric alignment kernel
- **LANDFAT_SPEC.md** — import representation

---

# Project Status

ufAIM is currently focused on stabilising the **alignment kernel and data model**.

Major topics under development:

- sparse alignment solver integration
- robust import normalisation
- multi-window engineering workspace

# Architecture Decisions

Major architectural decisions are documented in:

docs/adr/

## alignmentOS as a package

`package.json` names `src/` as the ES module package `alignment-os`: the AIM
kernel (`alignment-os/aim-core`), the AXTRAN2 calculation layer
(`alignment-os/axtran2`), the SQP solver (`alignment-os/sqp`), the Verm.esn
readers (`alignment-os/vermEsn`, `alignment-os/vermEsn/traAlignment`) and
every area under `src/` by path (`alignment-os/domain/*`, `/lib/*`,
`/import/*`, `/model/*`, `/services/*`, `/shared/*`, `/export/*`). Inside
`src/` every import is relative; the aliases of `config/importmap.internal.json`
belong to the app. `test/package` holds the test that keeps it so. The
package is `private` until publishing is decided. Its only third-party
needs are the GND import's (`mdb-reader`, `xlsx` and two build shims), declared
as optional dependencies; the kernel, AXTRAN2 and the Verm.esn readers need
none.
