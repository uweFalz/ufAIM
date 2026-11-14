# Handover to Rock: TransEd takeover into `/AIM`

Date: 2026-11-12, last updated 2026-11-14. From: Claude (stream `app`, TransEd). To: Rock, who coordinates
the takeover into the common repository `/Users/uwefalz/Developer/ufAIM`.
Ordered by Uwe ("schreib Rock die Übergabe für die Übernahme nach /AIM").

## 1. What is handed over

TransEd playground with modes 0, 1, 2, the root artifact `transed.html`, the
Klauder generator, the reading of halfWaves as cant, curve names that
follow the reading, the suitability check on f′, f″, f‴ at the ramp ends, and
(2026-11-13) the coupling model confirmed by Uwe and computed with the exact
expression. Reports:
`docs/app/architecture/MISSION_REPORT_TRANSED_PLAYGROUND_FINAL_002.md` and
`docs/app/architecture/MISSION_REPORT_TRANSED_KLAUDER_GENERATOR_003.md`
(both `review-required`).

## 2. Where it is

- Worktree `/Users/uwefalz/Developer/ufAIM-transed-playground`, local branch
  `claude/transed-playground`, clean.
- Commits on top of `ec1e6d3`, oldest first: `97c13e1`, `907b066`, `4a5a043`,
  `1b699ed`, `16a7199`, `f989b8f`, `bf6f04f`, `5661cb5`, `8633e6b`, `732af63`,
  `8e7df90`, `5fa7d36`, `3193313`, `c364793`, `d6f3fb1`, `c370c85`, `03a9a97`,
  `47e8055`, `1c54e04` (the exact expression), `103aa43`, `84031f3`, `e4873de`,
  `6ed86b9`, `8c1eac5`, `cbac53c`, plus the commit that brings this file to its
  present state. Since `1c54e04` only documents and evidence changed.
- On Uwe's order the branch is pushed to `origin` and pull request
  https://github.com/uweFalz/ufAIM/pull/122 against `main` is open. Take the
  tip of `origin/claude/transed-playground`; the commits up to `cbac53c` are
  pushed, and the tip carries source `30946d8eb748`. I have no order to merge
  or to clean up, and each further push needs Uwe's word.

## 3. The files

18 files outside `docs/`, with SHA-256 in
`docs/app/architecture/evidence/TRANSED_EXACT_20261113/takeover-sha256.txt`
(check with `shasum -a 256 -c` from the worktree root). The lists in
`evidence/TRANSED_LABELS_20261112/` (16 files) and
`evidence/TRANSED_SMOOTHNESS_20261112/` (18 files, before the exact expression)
are superseded.

- New relative to `origin/main`: `transed.html`,
  `src/services/transition-library/klauderFamily.js`,
  `test/services/transition-library/klauder-family.test.mjs`,
  `test/services/transition-library/declare-halfwave-as.test.mjs`.
- Changed relative to `origin/main`: `package.json`,
  `src/services/transition-library/cantCurvatureCoupling.js`,
  `test/services/transition-library/cant-curvature-coupling.test.mjs`,
  `src/services/transition-library/createTransitionLibraryService.js`,
  `src/services/transition-library/index.js`,
  `src/services/transition-library/transitionPlot.js`,
  `test/services/transition-library/transition-library-service.test.mjs`,
  `test/services/transition-library/transition-plot.test.mjs`,
  `test/transed/bundle.test.mjs`, `tools/axtran2/bundle.mjs`,
  `tools/transed/bundle.mjs`, `transed/README.md`, `transed/app.js`,
  `transed/index.html`.
- Documents under `docs/app/architecture/`: the two reports, the note
  `TRANSED_SCHWERPUNKT_KOPPLUNG_HERLEITUNG_2026-11-11.md`, this file, and the
  evidence folders `evidence/TRANSED_PLAYGROUND_FINAL_20261110/`,
  `evidence/TRANSED_KLAUDER_20261111/`, `evidence/TRANSED_HASSLINGER_20261111/`,
  `evidence/TRANSED_LABELS_20261112/`, `evidence/TRANSED_SMOOTHNESS_20261112/`,
  `evidence/TRANSED_EXACT_20261113/`. The older `handover-sha256.txt` files in
  the first four of these folders are superseded.

## 4. State of `/AIM` as I found it (read-only, re-checked 2026-11-14, second time)

- Both `origin/main` and the checkout move while I write; the hashes are
  those of the check. `origin/main` is `36ad695`. None of the 18 files changed there since
  `ec1e6d3`, so the branch applies onto `origin/main` without conflict
  (`git merge-tree origin/main HEAD` exits 0).
- The checkout `/Users/uwefalz/Developer/ufAIM` is on local `main` `28cb38a`,
  43 commits ahead of and 102 behind `origin/main`.
- All 18 files lie in the checkout, uncommitted: `transed/`, `tools/transed/`,
  `test/transed/`, `transed.html`, `src/services/transition-library/` and
  `test/services/transition-library/` untracked, `package.json` and
  `tools/axtran2/bundle.mjs` modified. No commit says who put them there.
- Every one of the 18 now matches the checksum list of the branch tip
  (`docs/app/architecture/evidence/TRANSED_EXACT_20261113/takeover-sha256.txt`).
  Earlier on 2026-11-14 they were at the state of `47e8055`, before the exact
  expression, with eleven files stale; that is what
  `docs/app/architecture/NOTE_ROCK_TRANSED_RETAKE_2026-11-14.md` asked to take
  again. The eleven are taken.
- `node tools/transed/bundle.mjs --check` there reports source `30946d8eb748`,
  up to date. The TransEd tests ran there for the first time: 46 of 46 pass.
- Still missing: the commit in `/AIM` that carries the files, and the merge of
  the pull request. Neither is on `origin/main`.
- I only read in `/AIM` (`bundle.mjs --check` and the test run write nothing).
  `npm run bundle` for `axtran2.html` I did not run there, because it writes.

## 5. Two files shared with your work (re-checked 2026-11-14)

- `package.json`: against `origin/main` (`f4c7dfc`) the branch changes the
  scripts only. `origin/main` already has
  `"bundle:transed": "node tools/transed/bundle.mjs"`; the branch adds
  `"bundle:check": "node tools/axtran2/bundle.mjs --check"` and
  `"bundle:transed:check": "node tools/transed/bundle.mjs --check"`.
- `tools/axtran2/bundle.mjs`: my version adds the root output, the source
  manifest and `--check` (17 lines added, 8 removed against `origin/main`).

Both files in the `/AIM` checkout now equal the branch tip byte for byte, and
neither changed on `origin/main` since `ec1e6d3`. So there is no second version
in `/AIM` to weigh against mine any more. If you change either file before the
takeover, yours is the reference: keep it and carry over only the script lines
above.

The other 16 files are mine alone and can be taken byte-identically.

## 6. Checks after the takeover

Run in `/AIM`:

- `node --test test/services/transition-library/*.test.mjs test/transed/*.test.mjs`
  — 46 of 46 pass in the worktree.
- `npm run bundle:transed:check` — must report source `30946d8eb748`;
  `transed.html` SHA-256
  `0a23fbeae3a6d79f35e2aceebedf0ef300addfaa09eac8b24dd5eacef1aa9b99`. If
  `tools/transed/bundle.mjs` or a source differs, the hash differs: then
  `npm run bundle:transed` and report the new one.
- `npm run bundle` once and `npm run bundle:check`: the AXTRAN2 source manifest
  changes with the library's new exports.
- Do not run bare `node --test`; the full suite is
  `node --test 'test/**/*.test.mjs'`.

## 7. Limits of what I verified

- Visible journeys ran in headless Chrome on the single file and on the served
  page, without console errors; nobody watched, selects were set by value,
  Safari, Firefox and narrow screens are untested.
- The full suite ran at `8633e6b` (2404 tests) and again at `3193313`, after
  the sharpened suitability check (2407 tests): 30 failures each time, none in
  TransEd, the same names both times. The same failures occur by name on the base commit `ec1e6d3` in the
  same environment (missing untracked modules, `test/samples/`, `rg`, and eight
  assertion failures in app, aim-core and AXTRAN2 tests). List:
  `docs/app/architecture/evidence/TRANSED_LABELS_20261112/full-suite-result.txt`.
- After the exact expression the full suite was repeated at `1c54e04`: 2412
  tests, 30 failures, the same names again, none in TransEd.
- Inside `/AIM` only the seven test files with assertion failures ran
  (2026-11-12, HEAD `b629df0` plus the uncommitted work of other streams,
  read-only): of the eight assertion failures seven fail there as well, one
  passes (`test/app/workspace/promoted-alignment-main-q-l-journey.test.mjs`).
  The full suite did not run there. The TransEd tests ran there on 2026-11-14
  at `1e4447f` with the files of the branch tip: 46 of 46 pass (section 4).

## 8. Open, not part of the takeover

- Uwe confirmed the coupling model on 2026-11-13 and decided: the exact
  expression (κ + d″)/(1 − κd) with d = h·sin ψ, h 1.8 m editable, f″ = 0 at
  the ramp ends is enough. The page no longer shows "Modellvorbehalt". Section 9
  of the note records the decisions. Still my assumptions: the limits of the
  check, ψ_E = arcsin(cant / rail base), and d′² left out.
- Not ordered: replacing the seven built-in Klauder records, wiring the library
  into the app shell.
- `src/domain/transition/transitionLookup.json`, `src/aim-core/**` and
  `docs/knowledgeKernel/` are untouched.

## 9. What I need back

The commit in `/AIM` that carries the files and the source hash that
`npm run bundle:transed:check` reports there. After that the worktree and the
branch can go, on Uwe's word.
