# Handover to Rock: TransEd takeover into `/AIM`

Date: 2026-11-12. From: Claude (stream `app`, TransEd). To: Rock, who coordinates
the takeover into the common repository `/Users/uwefalz/Developer/ufAIM`.
Ordered by Uwe ("schreib Rock die Übergabe für die Übernahme nach /AIM").

## 1. What is handed over

TransEd playground with modes 0, 1, 2, the root artifact `transed.html`, the
Klauder generator, the reading of halfWaves as cant, and curve names that
follow the reading. Reports:
`docs/app/architecture/MISSION_REPORT_TRANSED_PLAYGROUND_FINAL_002.md` and
`docs/app/architecture/MISSION_REPORT_TRANSED_KLAUDER_GENERATOR_003.md`
(both `review-required`).

## 2. Where it is

- Worktree `/Users/uwefalz/Developer/ufAIM-transed-playground`, local branch
  `claude/transed-playground`, clean.
- Eight local commits on top of `ec1e6d3`, oldest first: `97c13e1`, `907b066`,
  `4a5a043`, `1b699ed`, `16a7199`, `f989b8f`, `bf6f04f`, `5661cb5`, plus the
  commit that adds this file. Nothing is pushed. I have no order for remote
  writes, merge or cleanup.

## 3. The files

16 files outside `docs/`, with SHA-256 in
`docs/app/architecture/evidence/TRANSED_LABELS_20261112/takeover-sha256.txt`
(check with `shasum -a 256 -c` from the worktree root). Earlier messages said
"17 files"; the count that the diff against `ec1e6d3` gives is 16.

- New relative to `origin/main`: `transed.html`,
  `src/services/transition-library/klauderFamily.js`,
  `test/services/transition-library/klauder-family.test.mjs`,
  `test/services/transition-library/declare-halfwave-as.test.mjs`.
- Changed relative to `origin/main`: `package.json`,
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
  `evidence/TRANSED_LABELS_20261112/`. The older `handover-sha256.txt` files in
  the first three folders are superseded.

## 4. State of `/AIM` as I found it (read-only, 2026-11-12)

- `origin/main` is `771433e`. None of the 16 files changed there since
  `ec1e6d3`, so the branch applies onto `origin/main` without conflict.
- The checkout `/Users/uwefalz/Developer/ufAIM` is on local `main` `4b34c80`,
  21 commits ahead of and 72 behind `origin/main`. It has no `transed/`, no
  `tools/transed/`, no `test/transed/`, no `transed.html`.
- `src/services/transition-library/` and `test/services/transition-library/`
  exist there untracked. `cantCurvatureCoupling.js` and its test equal
  `origin/main`; `createTransitionLibraryService.js`, `index.js` and
  `transition-library-service.test.mjs` differ from both `origin/main` and this
  branch. I did not touch them.
- `package.json` and `tools/axtran2/bundle.mjs` in the checkout differ from
  `origin/main` and from this branch (your bundler work).

## 5. Two files that must not be copied blindly

- `package.json`: TransEd needs only two script lines,
  `"bundle:transed": "node tools/transed/bundle.mjs"` and
  `"bundle:transed:check": "node tools/transed/bundle.mjs --check"`.
- `tools/axtran2/bundle.mjs`: my version adds the root output, the source
  manifest and `--check`, written after yours. Yours in `/AIM` is the
  reference; keep it and drop mine if they disagree.

The other 14 files are mine alone and can be taken byte-identically.

## 6. Checks after the takeover

Run in `/AIM`:

- `node --test test/services/transition-library/*.test.mjs test/transed/*.test.mjs`
  — 38 of 38 pass in the worktree.
- `npm run bundle:transed:check` — must report source `ca1dd6821983`;
  `transed.html` SHA-256
  `540700632386e60d857946cf43b27035ed9aaed6a4cd7b84a1c5d47c7e865db7`. If
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
- The full suite was last run before the read-as switch: 30 failures out of
  2400, all from this worktree's missing untracked `test/samples/`, GND
  `node_modules` and `rg`, none in TransEd. It was not repeated since.
- Nothing was tested inside `/AIM`.

## 8. Open, not part of the takeover

- Uwe has not confirmed the coupling model ("Noch nicht"). The page shows the
  reservation "Modellvorbehalt"; it stays until he confirms. Section 9 of the
  note lists his open points.
- Not ordered: replacing the seven built-in Klauder records, wiring the library
  into the app shell, a sharper suitability check.
- `src/domain/transition/transitionLookup.json`, `src/aim-core/**` and
  `docs/knowledgeKernel/` are untouched.

## 9. What I need back

The commit in `/AIM` that carries the files and the source hash that
`npm run bundle:transed:check` reports there. After that the worktree and the
branch can go, on Uwe's word.
