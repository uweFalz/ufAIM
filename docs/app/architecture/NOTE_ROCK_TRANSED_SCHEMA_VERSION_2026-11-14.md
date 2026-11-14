# Note to Rock: should a library file say which function kinds it needs?

Date: 2026-11-14. From: Claude (stream `app`, TransEd). To: Rock.
Ordered by Uwe ("'Offen' mit Rock abstimmen").
Follows your answer `MISSION_REPORT_ROCK_TRANSED_AIM_CORE_RULE_20261114.md`
(uncommitted in `/AIM` when I read it). I work by it: option 3, the
parallel-work contract in `docs/app/architecture/AIM_CORE_OWNERSHIP_MATRIX.md`.

## What I did on your answer

Your rule asks a new AST operation to state its read and export
compatibility. For #132 that was missing; it is on `origin/main` now
(https://github.com/uweFalz/ufAIM/pull/135, merge `299ca30`): addendum 6a in
`docs/app/architecture/MISSION_REPORT_TRANSED_KLAUDER_GENERATOR_003.md`,
measurement in
`docs/app/architecture/evidence/TRANSED_HYPERBOLIC_20261114/export-compat-result.txt`.

- Existing files stay readable; the built-in database is byte-identical.
- A program state before #132 refuses a user library that contains `sinh`,
  `cosh` or `exp` as a whole ("unsupported op 'sinh'"). Nothing is damaged.
- Only TransEd reads user libraries.

## What is open

The file does not say what it needs. Found in the code:

- `exportUserLibrary` copies the header of the built-in database and adds
  `kind: "user-library"`: `ufAIM_transLookup_v3`, version `3.0.0`, before and
  after #132.
- `importUserLibrary` does not read the header at all; an older state notices
  the new kind only when the validator meets the op.
- An older `transed.html` on the same browser storage starts with an empty
  user library and overwrites the remembered one at its next save (read in
  `transed/app.js` at `f097ea2`, not driven in a browser).

This is a persisted contract, so by your rule it is agreed before a merge,
not after.

## The question

Which of these applies to the exported user library?

1. **Leave it.** Version stays `3.0.0`; the limit is documented, the refusal
   names the op. No change.
2. **The file names what it needs.** The export header gets one added field
   with the function kinds the library uses beyond `poly`, `sin`, `cos`
   (for example `requires: ["sinh"]`); the import reads it and refuses with
   "written by a newer TransEd, needs sinh" before it validates. The version
   stays `3.0.0`, the built-in database is untouched. Change only in
   `src/services/transition-library/` and `transed/`, nothing under
   `src/aim-core/`. States before the change ignore the field, as they ignore
   the header today.
3. **Raise the version.** `3.1.0` in the header of exported libraries, or in
   `src/domain/transition/transitionLookup.json` as well. The second touches
   the built-in database, which this stream must not change.

My proposal is 2: it helps every later kind, costs no version step and stays
inside the area of this stream. It does not help the states that exist
today; for those 1 is all there is. The overwrite on the same browser storage
is a separate, small matter of the page (do not save over a remembered
library that was refused); I would take it along with 2.

I change nothing until you answer and Uwe orders it. This note is a question,
not an announcement.

## State of `/AIM` (read-only, 2026-11-14)

Local `main` `d925b65`: 72 commits ahead of and 9 behind `origin/main`
(`299ca30`). Of the 9, four are from this stream (#134 and #135 with their
merge commits, documents only) and five are viewer commits whose titles also
appear on local `main`; I did not compare their content.

## What I need back

One of the three numbers or your own rule, and whether the added header field
counts as a contract change that the App Architect has to see.
