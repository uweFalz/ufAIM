# Note to Rock: #132 is merged, it touches aim-core, and `/AIM` is three commits behind

Date: 2026-11-14. From: Claude (stream `app`, TransEd). To: Rock.
Ordered by Uwe ("Ja, an Rock").
Follows `docs/app/architecture/NOTE_ROCK_AIM_MERGE_BLOCKERS_2026-11-14.md`,
whose finding is overtaken: `/AIM` has taken `origin/main` up to `f097ea2`
since.

## What happened

- Uwe ordered `sinh` and `cosh` as kinds in TransEd mode 0 and asked about the
  exponential; I added `exp` as well. Pull request
  https://github.com/uweFalz/ufAIM/pull/132 is merged on his order: merge
  commit `c55f2e4` on `origin/main`.
- `transed.html` on `origin/main` now carries bundle source `5fd3650b573f`
  (before: `30946d8eb748`).
- The branch `claude/transed-hyperbolic` and its worktree are removed.

## It touches aim-core

For the first time this stream changed files outside TransEd and the
transition library. The three kinds are leaf functions of the transition AST
like `sin` and `cos`, so they had to be added where functions are evaluated,
differentiated, integrated, cropped and validated:

- `src/aim-core/transition/ast/evalAst.js`
- `src/aim-core/transition/ast/symDiff.js`
- `src/aim-core/transition/ast/symInt.js`
- `src/aim-core/transition/ast/simplify.js`
- `src/aim-core/transition/ast/buildProtoAst.js`
- `src/aim-core/transition/registry/validateVersionedTransitionRegistry.js`
- `src/domain/transition/registry/validator.js`

Each change only adds the ops `sinh`, `cosh`, `exp` beside `sin` and `cos`;
nothing existing behaves differently. The built-in database
`src/domain/transition/transitionLookup.json` is unchanged. If aim-core has an
owner who must agree to such additions, this is the place to say so; I found
no rule about it in `AGENTS.md`.

## State of `/AIM` (read-only, 2026-11-14)

- Local `main` `2f7bddb`: 56 commits ahead of and 3 behind `origin/main`
  (`c55f2e4`), merge base `f097ea2`. TransEd is tracked there now;
  `node tools/transed/bundle.mjs --check` reports source `30946d8eb748`, the
  state before #132.
- The three missing commits are `798e470` and `c55f2e4` (#132) and `44427cc`
  (viewer). `git merge-tree --write-tree HEAD origin/main` exits 0: no
  conflict between the commits.
- Uncommitted work in the way: `technetViewer.html`,
  `viewer/source-manifest.json` and `viewer/src/viewer.js` are modified in the
  checkout and changed by `44427cc`. They belong to the viewer stream. None of
  the 14 files of #132 is modified or untracked in the checkout.
- `axtran2.html` is modified in the checkout (not by me) and
  `node tools/axtran2/bundle.mjs --check` passes there, so it matches its
  sources as they lie.

## `axtran2.html` has to be bundled again after #132

`axtran2.html` bundles `src/aim-core/transition/ast/buildProtoAst.js`,
`evalAst.js`, `simplify.js`, `symDiff.js`, `symInt.js` and
`src/aim-core/transition/registry/validateVersionedTransitionRegistry.js`.
All six changed in #132, so its source manifest changes: after `/AIM` takes
`c55f2e4`, `npm run bundle:check` will report a stale artifact until
`npm run bundle` has run.

## What I verified

- On the merge commit `c55f2e4`:
  `node --test test/services/transition-library/*.test.mjs test/transed/*.test.mjs test/aim-core/module-boundaries/transition-*.test.mjs`
  — 247 of 247 pass; `node tools/transed/bundle.mjs --check` up to date.
- Full suite on the branch tip `798e470`: 2460 tests, 30 failures, the same 30
  names as on the merge commit `0a6a237` of #122, none in TransEd, the library
  or the aim-core tests on `transition`. Not repeated on `c55f2e4`.
- In `/AIM` I only read and ran the two `--check` commands, which write
  nothing.

## What I need back

Word if the aim-core additions need anyone's agreement, and the commit at
which `/AIM` carries `c55f2e4` with `axtran2.html` bundled again.
