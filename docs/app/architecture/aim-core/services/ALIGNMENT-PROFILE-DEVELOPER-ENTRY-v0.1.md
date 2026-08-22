# Alignment Profile Developer Entry v0.1

Status: deterministic Reference Application developer tool. Knowledge Kernel
authority is unchanged.

## Command and output

Run from the repository root:

```text
node tools/aim-core-profile-demo.mjs
```

Success writes exactly one indented JSON document and one final newline to
standard output, writes nothing to standard error, and exits zero. Importing the
module does not execute the demo.

The result envelope is:

```js
{
  demoVersion: "aim-core-profile-demo-runner/0.1",
  fixtureVersion: "aim-core-profile-demo/0.1",
  synthetic: true,
  batch: AlignmentProfileApplicationServiceBatchResult
}
```

The batch result is not reshaped.

## Fixed synthetic fixture

The only input is:

```text
test/fixtures/aim-core/alignment-profile-demo.json
```

It is fixed, synthetic, deterministic, and public-safe. The command accepts no
path, filename, URL, option, environment value, standard input, network input,
or user data.

The fixture contains one explicit Alignment identity, ordered intrinsic
positions, one constant-gradient vertical law, one linear-cross-level cant law,
and one versioned chainage mapping with an explicit address jump.

## Executed path

```text
synthetic constructive laws
  -> explicit snapshot record
  -> StaticAlignmentProfileStateReaderAdapter
  -> AlignmentProfileEvaluationService
  -> AlignmentProfileApplicationService
  -> ordered evaluation result
```

Core model constructors and append operations create and own the vertical,
cant, and chainage states. The static adapter owns only snapshot lookup
membership. The Core Service evaluates components, and the Application Service
orchestrates the ordered positions.

This is the first executable developer consumer. It is not normal runtime
wiring, a production importer, or a product feature.

## Deterministic result

The positions are exactly:

```json
[0, 50, 100, 150, 200]
```

At `s=100`, chainage candidates remain explicitly ordered as `BACK: 1100` and
`AHEAD: 1200`. The demo selects no preferred address. Scheme `K`, version `v1`,
and Alignment identity `demo-alignment-A` remain present in the Core results.

## Boundary

The developer entry has no user or private data and no external file option. It
performs no SPOT, import, GND, or LandXML interpretation. It has no persistence,
UI, selection, Worker, Messaging, browser, network, CRS, speed, or regulatory
meaning.

Research remains non-canonical comparison evidence and is not architectural
authority.

## Deferred and unauthorized

- productive runtime, UI, or inApp wiring;
- user-selectable fixtures or file input;
- generic parsing or import;
- SPOT, GND, or LandXML conversion;
- persistence or serialization technology;
- mutation or save operations;
- selection or focus;
- interpolation or representation;
- speed, CRS, AXTRAN, or transitionDB coupling;
- broad movement or cleanup.
