# APP-GND-MDB-SPIKE-001 security and licensing evidence

- Reader: `mdb-reader` 3.2.0, exact version and integrity pinned by `package-lock.json`; MIT license.
- Dependency graph: the complete resolved direct and transitive graph, versions, integrity hashes and SPDX license fields are recorded in `package-lock.json` (66 audited packages at lock creation).
- Review result: `npm audit --omit=dev` reports one high-severity issue, specifically the test comparator dependency `xlsx` 0.18.5 (prototype pollution and ReDoS advisories, no registry fix). The advisory is not in `mdb-reader`'s dependency chain, but the isolated experiment graph is not clean and the XLSX side requires separate production dependency review.
- Loading: the Worker has one static bare import. A production build would have to bundle that import; there is no network call, dynamic import, DOM access, or filesystem write in Worker source.
- CSP: a bundled module Worker requires `worker-src 'self'` (or a narrower same-origin URL) and `script-src 'self'`; `blob:` is not required by this implementation.
- Limits: file, table, per-table row, total row, memo, binary, batch and execution-time limits are explicit. The client adds a hard timer and always terminates the Worker on success or failure.
- Privacy: neither adapter nor Worker logs source values, rows, filenames, hashes, or diagnostics. Tests use private files locally only and do not write extracted data.
- Format boundary: unencrypted Jet-class MDB with the `Standard Jet DB` header. Password or encryption evidence is rejected; no password is accepted by the adapter.
- License notices: redistribution must retain the `mdb-reader` MIT notice and notices for all bundled transitive packages. The lock is evidence, not a complete third-party notice artifact.
