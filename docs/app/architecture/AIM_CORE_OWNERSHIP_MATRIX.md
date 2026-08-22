# AIM Core Ownership Matrix

Status: parallel release becomes active after independent acceptance of Package
031.

| Surface | Owned paths | Allowed imports | Forbidden imports | Dedicated gates | Release |
|---|---|---|---|---|---|
| `CORE-GEOMETRY-ALIGNMENT` | `src/aim-core/geometry/**`, `src/aim-core/alignment/aggregate/**`, `src/aim-core/alignment/authoring/**`, matching dedicated tests | Relative modules inside these Core areas; an explicitly authorized cross-Core dependency | Legacy/domain/lib, services, UI, import, storage, concrete transition data | Geometry, Aggregate and Authoring boundary/compatibility suites | released |
| `CORE-TRANSITION-AXTRAN` | `src/aim-core/transition/**`, matching dedicated tests | Relative Transition Core modules and explicitly approved Core dependencies | Concrete JSON, legacy resolver, App/UI/import/storage | Transition/AXTRAN boundary, compatibility and golden suites | released |
| `CORE-PROFILE-CHAINAGE-CANT` | `src/aim-core/alignment/profile/**`, matching dedicated tests | Relative Profile Core modules | Aggregate inference, UI, persistence implementation, import | Profile boundary/compatibility and evaluation suites | released |
| `CORE-TOPOLOGY` | `src/aim-core/alignment/topology/**`, matching dedicated tests | Relative Topology Core modules | Geometry coincidence inference, GND/import adapters, services/UI/storage | Topology boundary/compatibility suite | released |

## Shared architect-owned hotfiles

These files are serialized and are not owned by any parallel area:

- `src/aim-core/index.js`
- `src/aim-core/public-api-manifest.js`
- `test/aim-core/module-boundaries/aim-core-public-api-freeze.test.mjs`
- `test/aim-core/module-boundaries/aim-core-global-dependency-boundary.test.mjs`
- `docs/app/architecture/diagrams/current/ufAIM_UltimateArchitecture_CURRENT.puml`
- `app/startuml INCREMENTAL-MIGRATION.puml`
- `docs/app/architecture/AIM_CORE_DEPENDENCY_RULES.md`
- `docs/app/architecture/AIM_CORE_OWNERSHIP_MATRIX.md`
- `docs/app/architecture/AIM_CORE_RESIDUAL_PATH_INVENTORY.md`
- `docs/app/architecture/AIM_CORE_SEPARATION_COMPLETION_GATE.md`

## Parallel-work contract

- Each surface edits only its owned implementation and dedicated tests.
- Cross-area implementation changes require a new coordinated package.
- Area barrels are area-owned; Root, manifest, global gates and diagrams remain
  App-Architect-owned.
- Application services, adapters and views may proceed independently outside
  Core and import only public Core.
- Bridge 001B/001C and Import-C2 remain parked pending separate direction.
- A shared-hotfile change suspends parallel release for that change until the
  App Architect serializes and revalidates it.
