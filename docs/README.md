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
