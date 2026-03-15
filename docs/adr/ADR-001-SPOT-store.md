# ADR-001 SPOT Store as Canonical Project Model

Status: accepted  
Date: 2026-03-15

## Context

ufAIM requires a canonical representation of engineering data
that is shared between multiple tools and windows.

Traditional applications often duplicate state between
views and controllers, leading to inconsistent models.

## Decision

All engineering-relevant project data is stored in a single
canonical data structure called the **SPOT Store**.

The SPOT Store is maintained inside the **SharedWorker**.

All windows interact with this store via messaging.

## Consequences

Views and controllers never own project data.

All state-changing operations must go through the worker.

This guarantees that:

- all windows see the same project state
- the model remains consistent
- multi-window collaboration becomes possible
