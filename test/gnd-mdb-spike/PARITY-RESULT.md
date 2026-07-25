# APP-GND-MDB-SPIKE-001 parity result

Disposition: **browser parity disproven**.

Supported extraction boundary: unencrypted Jet MDB carrying the `Standard Jet DB` signature, within the configured limits. Encrypted/password-protected, malformed, truncated and oversized inputs are rejected. No claim is made for ACE or linked tables.

The local paired MDB/XLSX delivery has the same seven core table names, column names and row counts. Two MDB extractions produce the same typed-envelope SHA-256 digest. PAD/PAD1/PAD2, LSYS/HSYS and EH/EU type identifiers compare numerically equal under explicit string-to-number comparison.

The required lossless record parity does not hold. The paired XLSX contains displayed numeric values for relevant EHPAR/EUPAR cells that differ numerically from the MDB values. This occurs in both EH and EU evidence. It is a source-representation difference and is deliberately not normalized away. Therefore normalized-envelope digests cannot be equal and identical downstream truthfulness outcomes cannot be proven without choosing one representation as authoritative or changing interpretation rules, neither of which this mission authorizes.

Measured local boundary: the private sample extracted twice in under one second total during the focused Node test run; this is not a browser performance certification. Worker responsiveness is structurally protected by dedicated execution, batching, a client hard timeout and unconditional termination, but was not verified in an instrumented browser.

Production blockers: paired numeric evidence divergence; one high-severity advisory in the isolated installed dependency graph; no completed browser bundle/CSP runtime test; no generated valid/encrypted synthetic Jet fixture set; and no full GND/Geo/AXTRAN regression run through an MDB entry point.

A production App mission is not defensible. Per the stop rule, the next investigation should be `RESEARCH-GND-MDB-SIDECAR-001` using Jackcess. CSV, generated XLSX and server conversion are not fallback options.
