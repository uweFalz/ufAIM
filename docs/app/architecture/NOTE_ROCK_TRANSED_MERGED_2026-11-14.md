# Note to Rock: #122 is merged, `/AIM` has to follow

Date: 2026-11-14. From: Claude (stream `app`, TransEd). To: Rock.
Ordered by Uwe ("schreib Rock, dass #122 gemergt ist und /AIM nachziehen muss").
Follows `docs/app/architecture/NOTE_ROCK_TRANSED_RETAKE_2026-11-14.md` and
`docs/app/architecture/HANDOVER_ROCK_TRANSED_2026-11-12.md`.

## What happened

- Pull request https://github.com/uweFalz/ufAIM/pull/122 is merged on Uwe's
  order: merge commit `0a6a237` on `origin/main`. TransEd with the confirmed
  coupling model and the exact expression is on `origin/main`, bundle source
  `30946d8eb748`.
- Pull request https://github.com/uweFalz/ufAIM/pull/129 (one evidence file)
  is merged as well: merge commit `7677a1a`.
- On Uwe's order the branch `claude/transed-playground` and the worktree
  `/Users/uwefalz/Developer/ufAIM-transed-playground` are removed. Paths under
  that worktree in my earlier documents no longer exist; the files are on
  `origin/main` under the same relative paths.

## What I ask

Bring the checkout `/Users/uwefalz/Developer/ufAIM` onto `origin/main`
(`7677a1a` or later), so that `/AIM` carries TransEd as tracked files.

## What stands in the way (read-only, 2026-11-14)

- The checkout is on local `main` `298dc1d`, 44 commits ahead of and 137
  behind `origin/main`.
- The 18 TransEd files lie there uncommitted: `transed/`, `tools/transed/`,
  `test/transed/`, `transed.html`, `src/services/transition-library/` and
  `test/services/transition-library/` untracked, `package.json` and
  `tools/axtran2/bundle.mjs` modified. All 18 match the checksum list
  `docs/app/architecture/evidence/TRANSED_EXACT_20261113/takeover-sha256.txt`
  and so equal `origin/main` byte for byte.
- Git refuses a merge or rebase that would overwrite untracked files, even
  when the content is equal. The 16 untracked copies have to go, or be
  committed, before the checkout can take `origin/main`. Nothing is lost
  either way, because `origin/main` holds the same bytes. Which way is your
  call; I did not touch them.
- `axtran2.html` is committed only locally in `/AIM` (`1e4447f`) and is not on
  `origin/main`. `npm run bundle:check`, a script that #122 added, therefore
  fails on `origin/main` with "no such file".

## Checks afterwards, in `/AIM`

- `npm run bundle:transed:check` must report source `30946d8eb748`.
- `node --test test/services/transition-library/*.test.mjs test/transed/*.test.mjs`
  — 46 of 46 pass on `origin/main` and passed in the checkout with the
  uncommitted copies.
- `npm run bundle` once, then `npm run bundle:check`: the AXTRAN2 source
  manifest changes with the library's new export `couplingGeometry`, so
  `axtran2.html` has to be bundled again before it is pushed.

## What I verified and what not

- Full suite on the merge commit `0a6a237`: 2455 tests, 30 failures, the same
  30 names as before, none in TransEd
  (`docs/app/architecture/evidence/TRANSED_LABELS_20261112/full-suite-result.txt`).
- Not run by me: anything that writes in `/AIM`, `npm run bundle` there, the
  full suite there.

## What I need back

The commit at which `/AIM` carries TransEd as tracked files, and the source
hash `npm run bundle:transed:check` reports there.
