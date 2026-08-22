# AIM Core Dependency Rules

Status: binding after `APP-AIM-CORE-SEPARATION-COMPLETION-031`.

## Boundary

`src/aim-core/**` is the browser-independent implementation core. Its dependency
direction is:

`outside UI/views/services/adapters/data → public AIM Core`

The reverse direction is prohibited. Abstract contracts and ports required by
the domain belong in Core; concrete persistence, messaging, import, browser and
catalogue implementations remain outside.

## Executable rules

Every JavaScript module under `src/aim-core/**`:

1. uses only relative static import/export specifiers;
2. resolves every specifier to another file below `src/aim-core/`;
3. does not use dynamic imports, import-map aliases, bare packages, absolute
   paths, `node:`, URL/network imports or JSON imports;
4. does not depend on `src/domain`, `src/lib`, `src/services`, `src/import`,
   `src/shared`, `src/model`, `app`, browser/UI, Worker/Messaging,
   storage/persistence implementations, renderers or concrete registry data;
5. imports in a fresh Node ESM process without browser globals.

These rules inspect executable module specifiers. Historical comments and
provenance strings are not dependencies.

The executable enforcement is
`test/aim-core/module-boundaries/aim-core-global-dependency-boundary.test.mjs`.

## Public API

`src/aim-core/index.js` is the architect-owned Root barrel. Its deliberate
141-name namespace is frozen by:

- `src/aim-core/public-api-manifest.js`;
- `test/aim-core/module-boundaries/aim-core-public-api-freeze.test.mjs`.

Area barrels own their local APIs. An intentional Root change requires one
serialized package updating the area barrel, Root, manifest and freeze test.

## Outside-Core implementations

Application services, repository/profile adapters, configured transition
catalogue adapters, messaging, storage, views and import pipelines may import
public Core. They may not be imported by Core. Their classifications and
removal triggers are recorded in
`AIM_CORE_RESIDUAL_PATH_INVENTORY.md`.
