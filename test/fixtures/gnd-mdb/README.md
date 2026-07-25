# Synthetic GND Jet fixtures

These files contain only the fixed values declared in
`generator/GenerateGndMdbFixtures.java`. They contain no delivery, project,
route, customer, or private database material.

The generator uses `io.github.spannm:jackcess:5.1.4` (Apache-2.0) with the
Apache-2.0 dependencies and exact versions listed in `generator/classpath.txt`.
Place those jars in `generator/lib`, then regenerate from the repository root:

```sh
javac -cp 'test/fixtures/gnd-mdb/generator/lib/*' -d /tmp/ufaim-gnd-fixture-classes test/fixtures/gnd-mdb/generator/GenerateGndMdbFixtures.java
java -cp '/tmp/ufaim-gnd-fixture-classes:test/fixtures/gnd-mdb/generator/lib/*' GenerateGndMdbFixtures test/fixtures/gnd-mdb
shasum -a 256 test/fixtures/gnd-mdb/*.mdb
```

The jars are generator-only and are not committed or bundled in the app. The
generated databases use the Jet 4 / Access 2000 container format.

`valid-minimal-jet4.mdb` contains all seven GND core tables. It demonstrates a
safe horizontal seed, PAD provenance, LSYS/HSYS, EH/EU parameters, an unknown
EH type, empty text, database NULL, false, zero, and binary64-sensitive values.
`missing-core-jet4.mdb` is otherwise identical but physically omits exactly
`X_ASC13_PH`. `conflicting-evidence-jet4.mdb` adds a second LSYS realization for
the same PAD pair so that attachment evidence is ambiguous.

Jet system metadata includes creation times, so byte-identical regeneration is
not claimed. Acceptance instead requires stable typed-envelope digests across
two extractions of each committed file. SHA-256 values of the committed bytes
are recorded in `manifest.json`.

No protected fixture is claimed here. Jackcess 5.1.4 creates unencrypted Jet
databases but does not create password-protected ones. Jackcess Encrypt 4.0.3
can preserve encryption while writing an existing encrypted database; it does
not provide a clean creation path for a new password-protected Jet MDB. A
public upstream encrypted database is not repackaged because doing so would not
meet this mission's exclusively-synthetic-content rule.
