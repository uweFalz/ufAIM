# ADR-003 SharedWorker Master Runtime

Status: accepted  
Date: 2026-03-15

## Context

ufAIM is designed as a multi-window engineering environment.

Multiple views and tools must operate on the same
canonical project state.

## Decision

A **SharedWorker** acts as the master runtime of the system.

The worker maintains:

- the SPOT Store
- session state
- message routing

All browser windows act as clients.

## Consequences

The architecture becomes naturally multi-window capable.

The worker acts as the authoritative source of project data.
