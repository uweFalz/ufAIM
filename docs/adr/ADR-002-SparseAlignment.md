# ADR-002 Sparse Alignment Model

Status: accepted  
Date: 2026-03-15

## Context

Railway alignments must be represented in a deterministic
mathematical form suitable for validation and optimisation.

Existing CAD/BIM tools often store alignments as derived
geometry rather than parametric engineering structures.

## Decision

ufAIM uses a **Sparse Alignment Model** as its canonical
geometric representation.

Alignments are stored as alternating sequences of:

FixElement → TransitionElement → FixElement

## Consequences

The alignment representation becomes:

- deterministic
- solver-friendly
- independent of rendering systems
