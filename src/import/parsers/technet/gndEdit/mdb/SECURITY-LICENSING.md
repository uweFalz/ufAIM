# GND MDB Worker security and licensing

- Production reader: `mdb-reader` 3.2.0, exact version pinned in `package-lock.json`.
- Offline packaging: the module Worker is a same-origin static bundle. It contains no `fetch`, `XMLHttpRequest`, `WebSocket`, dynamic import, DOM access, or filesystem API.
- CSP: production requires `worker-src 'self'` and `script-src 'self'`; neither `blob:` nor a remote script origin is required for MDB extraction.
- Isolation: extraction runs only in the dedicated Worker. The client terminates it after success, reported failure, uncaught failure, or timeout.
- Limits: file bytes, table count, per-table rows, total rows, memo bytes, binary bytes, batch size, and wall-clock execution are bounded.
- Privacy: source rows and cell values are not written to application logs or telemetry. UI diagnostics contain source identity, fingerprint, schema inventory, ordinals, and classifications only.
- License: `mdb-reader` is MIT. Browser polyfills and transitive packages retain their esbuild-emitted license comments; the CycloneDX SBOM records the resolved graph.
- Audit: `npm audit --omit=dev` reports zero known vulnerabilities for this isolated production graph as of 2026-07-22.

## Separate XLSX finding

The existing externally loaded SheetJS/XLSX runtime is not introduced by the MDB path. The earlier isolated `xlsx` 0.18.5 comparator reported high-severity prototype-pollution and ReDoS advisories with no registry fix. This remains a separate XLSX dependency/security decision and is not obscured or remediated by MDB support.
