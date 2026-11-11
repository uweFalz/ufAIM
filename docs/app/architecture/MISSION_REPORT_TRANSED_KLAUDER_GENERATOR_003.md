# MISSION REPORT

## 1. Mission

- Name: Klauder generator and coupling derivation note; stream `app`; package `TRANSED_KLAUDER_GENERATOR_003`.
- Objective: generate Klauder halfWaves from two numbers m and n instead of the fixed records, offered in mode 1 of the playground; write the derivation of the cant/curvature coupling down so that Uwe can check sign and approximation. Ordered by Uwe on 2026-11-11.

## 2. Status

`review-required` — built and validated in the work state; the derivation awaits Uwe's check (OD-1), takeover into the common `/AIM` is Rock's to coordinate (OD-2).

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM`; work state: worktree `/Users/uwefalz/Developer/ufAIM-transed-playground`, local branch `claude/transed-playground`, on top of `4a5a043` (`TRANSED_PLAYGROUND_FINAL_002`). Local only; not pushed, no merge, no cleanup.
- Authorized: `src/services/transition-library/`, `transed/`, their tests, root artifact `transed.html`, this report, the note and evidence. Excluded and untouched: app shell, `src/aim-core/**`, `docs/knowledgeKernel/`, `src/domain/transition/transitionLookup.json`, AXTRAN2, the common `/AIM` checkout, any remote.

## 4. Work Performed

- `src/services/transition-library/klauderFamily.js`: `klauderTerms`, `klauderPrototype`, `klauderRecords`, `klauderName` for κ″ ∼ (1+x)^m · x^n · (1−x)^m on [−1, 0], m and n whole numbers 0…24, refusal `KLAUDER_EXPONENT_INVALID`. The prototype has exactly the shape of the built-in `PROTO_KLAU_m_n`; generated ids are `PROTO_KLAUDER_m_n` / `HW_KLAUDER_m_n`, so built-in entries stay untouched.
- Mode 1: fields m, n and "Einsetzen" fill the composer (product, κ″, three terms, proposed id). The terms stay visible and editable; suitability is decided by the existing halfWave check on save.
- Note `docs/app/architecture/TRANSED_SCHWERPUNKT_KOPPLUNG_HERLEITUNG_2026-11-11.md` (German): seven named assumptions, derivation from the offset line, both directions, a closed argument why a curvature function without counter-swerve can never be suitable, two integral conditions for suitability, recomputed cases, four questions to Uwe.
- Addendum, same day: Uwe supplied the patent AT 412 975 B (Hasslinger). The note's section 8 compares it: equation (1) is identical including the sign, the patent's demand on the unbalanced lateral acceleration at height h is equivalent to the note's assumption, the patent itself is the small-angle form. The patent's table is reproduced with h = 1.8 m (largest deviation 4.5·10⁻⁷ 1/km). Finding: the database entries `vienna2` … `vienna7` are exactly the patent's cant functions (2) … (7), stored as curvature (the patent's case h = 0). No code changed for the addendum.
- Addendum 2, ordered by Uwe ("vienna-Halbwellen als Überhöhung erklärbar machen"): service method `declareHalfWaveAs({ id, quantity })` and, in mode 2, the select "Die Halbwellen lesen als". Built-in entries stay immutable; the other reading is a user halfWave `<id>_CANT` on the same prototype, the way back finds the built-in entry. It works for every halfWave, not only `vienna`. The upper picture of mode 2 still labels its curves κ, κ′, κ″ when the halfWaves are read as cant.
- Modularization: the generator is a pure module in the service package; the page only calls it; the single file is regenerated and checked against its sources. No deferral.

## 5. Changed Files

- Added: `src/services/transition-library/klauderFamily.js`, `test/services/transition-library/klauder-family.test.mjs`, `docs/app/architecture/TRANSED_SCHWERPUNKT_KOPPLUNG_HERLEITUNG_2026-11-11.md`, `docs/app/architecture/MISSION_REPORT_TRANSED_KLAUDER_GENERATOR_003.md`, `docs/app/architecture/evidence/TRANSED_KLAUDER_20261111/klauder-journey.mjs`, `docs/app/architecture/evidence/TRANSED_KLAUDER_20261111/klauder-journey-single-file.json`, `docs/app/architecture/evidence/TRANSED_KLAUDER_20261111/klauder-journey-served.json`, `docs/app/architecture/evidence/TRANSED_KLAUDER_20261111/klauder-single-file-mode1.png`, `docs/app/architecture/evidence/TRANSED_KLAUDER_20261111/klauder-single-file-mode2.png`, `docs/app/architecture/evidence/TRANSED_KLAUDER_20261111/klauder-served-mode1.png`, `docs/app/architecture/evidence/TRANSED_KLAUDER_20261111/klauder-served-mode2.png`, `docs/app/architecture/evidence/TRANSED_KLAUDER_20261111/handover-sha256.txt`, `docs/app/architecture/evidence/TRANSED_HASSLINGER_20261111/patent-check.mjs`, `docs/app/architecture/evidence/TRANSED_HASSLINGER_20261111/patent-check.txt`, `docs/app/architecture/evidence/TRANSED_HASSLINGER_20261111/read-as-journey.mjs`, `docs/app/architecture/evidence/TRANSED_HASSLINGER_20261111/read-as-journey-single-file.json`, `docs/app/architecture/evidence/TRANSED_HASSLINGER_20261111/read-as-journey-served.json`, `docs/app/architecture/evidence/TRANSED_HASSLINGER_20261111/read-as-single-file-cant.png`, `docs/app/architecture/evidence/TRANSED_HASSLINGER_20261111/read-as-served-cant.png`, `test/services/transition-library/declare-halfwave-as.test.mjs`
- Modified: `src/services/transition-library/createTransitionLibraryService.js`, `src/services/transition-library/index.js`, `test/services/transition-library/transition-library-service.test.mjs`, `transed/app.js`, `transed/index.html`, `transed/README.md`, `transed.html`
- Moved or renamed: None
- Deleted: None

## 6. Evidence and Validation

- `node --test test/services/transition-library/*.test.mjs test/transed/*.test.mjs`: `passed` (34/34). New: the generator reproduces all seven built-in Klauder prototypes exactly; member (3, 4) is suitable, monotone, storable, usable in a transition and survives export and import; invalid exponents are refused.
- Full suite, `node --test 'test/**/*.test.mjs'`: 2400 tests, 2345 passed, 30 failed, none in `test/services/transition-library/` or `test/transed/`: `partial`. All 30 stem from this worktree's environment, not from the change: missing untracked `test/samples/`, missing untracked `node_modules` of the GND readers (`xlsx`, `mdb-reader`), no `rg` on the path, temporary files gone after the restart. The run before the restart had 21 failures; a by-name comparison was not possible because that list was in the wiped scratchpad.
- Build: `node tools/transed/bundle.mjs` twice, `cmp` identical; `--check` up to date; `transed.html` SHA-256 `8c09772abb827ce6aae9d34758b993693873003601cbb14770330bb93559bb34`, source hash `7c8831ff8fff…`, 21 modules, 168 KB: `passed`.
- Visible user journey, headless Chrome with real mouse and keyboard events, on the single file (`file://…/transed.html`) and on the served page (`http://127.0.0.1:8765/transed/index.html`): mode 1, type m = 2, n = 3, "Einsetzen" → curve differs from built-in `HW_KLAU_2_3` by 0; m = 2.5 → refused with a message; m = 3, n = 4 → three rows `ROOTp1^3 · IDENT^4 · ROOTm1^3` on [−1, 0], κ″, id `KLAUDER_3_4`; save → "Gespeichert: PROTO_KLAUDER_3_4, HW_KLAUDER_3_4."; mode 2 with it as halfWave in and out → curve 0 … 1, finite. No console error in either run: `passed`.
- Addendum 2: `node --test test/services/transition-library/*.test.mjs test/transed/*.test.mjs`: `passed` (37/37; the full suite was not repeated). Visible journey on single file and served page: template `vienna2`, the patent's example typed in (h 1.8 m, 224 mm, R 571.43 m, L 200 m), "lesen als Überhöhung" → `HW_VIEN2_CANT` in both selects and in the library, curvature −0.0083 … 1.0083, ε = 0.062, "Rampe läuft tangential ein"; back to curvature → `HW_VIEN2`, 0 … 1, "Rampe knickt"; no console error: `passed`. After addendum 2 `transed.html` has SHA-256 `d2d06edc9e0436d0ff7f02f778126204bce2200d387bc6e333822ef282a68129`, source hash `d9620a6b2e7c…`; the values in the build line above are those before it.
- Patent check, `node docs/app/architecture/evidence/TRANSED_HASSLINGER_20261111/patent-check.mjs`: `passed` (output beside it).
- Derivation: the closed solution, the two integral conditions and the Bloss end slope 0.590 were recomputed numerically and agree with the module (values in the note, section 6).
- Limitations: headless, nobody watched; selects set by value; Safari, Firefox and narrow screens untested. Of the patent table eight of 51 rows were recomputed.

## 7. Kernel and Architecture Impact

```text
Kernel impact: none
Architecture impact: none
RefImpl impact: changed
Thesis impact: follow-up-required
```

- Thesis: the note is a candidate derivation for `docs/thesis/AIM/dynamics/`, not yet placed there.

## 8. Conflicts, Risks, and Open Decisions

- Model reservation: the comparison with the patent supports sign, approximation and the meaning of h; the page still shows the reservation until Uwe confirms (OD-1).
- The handover list of `TRANSED_PLAYGROUND_FINAL_002` is superseded for six of its 13 files; `docs/app/architecture/evidence/TRANSED_KLAUDER_20261111/handover-sha256.txt` holds the eight current checksums (two files are new). The takeover is now 17 files; `docs/app/architecture/evidence/TRANSED_HASSLINGER_20261111/handover-sha256.txt` is the current list of the ten files changed since `TRANSED_PLAYGROUND_FINAL_002`.
- The built-in database still lists its seven Klauder records; replacing them by the generator would change `transitionLookup.json` and was not ordered.
- OD-1 (Uwe): section 9 of the note — formal confirmation, small-angle form or exact expression, default h, whether the `vienna` halfWaves should be declarable as cant.
- OD-2 (Rock): take over from the tip of `claude/transed-playground`; `transed.html` must then report source `d9620a6b2e7c`.

## 9. Handover

- Next safe step: Uwe reads the note; Rock takes the 17 files and runs `npm run bundle` and `npm run bundle:transed:check` in `/AIM`.
- Prerequisites: none from this stream. Other streams can proceed independently.
- Done criterion: `transed.html` in `/AIM` has the SHA-256 of addendum 2 (section 6); OD-1 answered.
