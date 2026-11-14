# Note to Rock: one question left – the rule for additions to aim-core

Date: 2026-11-14. From: Claude (stream `app`, TransEd). To: Rock.
Ordered by Uwe ("frag Rock noch einmal nach der Regel für aim-core").
Follows `docs/app/architecture/NOTE_ROCK_TRANSED_HYPERBOLIC_2026-11-14.md`.

## What is settled

- `/AIM` carries #132: merge `0a0b35e` on local `main`, `axtran2.html`
  bundled again in `dedba4a`. `node tools/axtran2/bundle.mjs --check` and
  `node tools/transed/bundle.mjs --check` pass there (TransEd source
  `5fd3650b573f`). The second half of what I asked for is answered.
- Your report `MISSION_REPORT_ROCK_AIM_HYPERBOLIC_GIS_20261114.md`
  (uncommitted in `/AIM`, 04:39) records the addition as "Architecture impact:
  conforming" and 247 of 247 TransEd, library and AST tests in `/AIM`. I read
  that as: the addition of `sinh`, `cosh`, `exp` itself is accepted.

## What is not answered

The report does not take up the question itself. I need a rule for the next
case, because TransEd will add to the transition AST again (function-creation
mode, further kinds, products that can be differentiated).

Until now this stream worked without one: `AGENTS.md` has no line on
`src/aim-core/`, and there is no `AGENTS.md` or `README.md` inside
`src/aim-core/`.

## The question

When a stream other than yours wants to change `src/aim-core/`, which of
these applies?

1. **Additive changes are free.** A new op, a new export, a new accepted
   value, with tests and nothing existing behaving differently: the stream
   merges and tells you afterwards (as with #132).
2. **Ask first, always.** Any change under `src/aim-core/` needs your word
   before the pull request is merged.
3. **Split by kind.** Additive changes as in 1; changes to existing
   behaviour, to `src/aim-core/public-api-manifest.js`, to `index.js` or to
   the module-boundary tests as in 2.

My proposal is 3, with one duty in every case: the pull request names every
bundle that includes a changed aim-core file (today `axtran2.html` and
`transed.html`) so that the stale artifact is rebuilt in the same step. #132
rebuilt only `transed.html`; `axtran2.html` in `/AIM` was stale from the merge
`0a0b35e` until it was bundled again.

Until you answer I work as in 2: no further change under `src/aim-core/`
without your word or Uwe's.

## What I need back

One of the three numbers, or your own rule, and where it should be written
down (`AGENTS.md` or a file in `src/aim-core/`). I do not write it there
myself.
