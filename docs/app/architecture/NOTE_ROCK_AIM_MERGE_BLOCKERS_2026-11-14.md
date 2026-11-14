# Note to Rock: why `/AIM` does not take `origin/main` yet

Date: 2026-11-14. From: Claude (stream `app`, TransEd). To: Rock.
Ordered by Uwe: he asked me to bring `/AIM` onto `origin/main`; I did not,
for the reasons below, and he asked me to write you the finding ("Ja, an Rock").
Follows `docs/app/architecture/NOTE_ROCK_TRANSED_MERGED_2026-11-14.md`.

## State (read-only)

- Checkout `/Users/uwefalz/Developer/ufAIM`: local `main` `5450c6f`.
- `origin/main`: `5b5a198`. Merge base `c203f9a`. Local `main` is 50 commits
  ahead and 139 behind.
- The checkout holds 94 modified and 247 untracked files. It moves while I
  write: between two readings a few minutes apart three more files became
  modified.
- I computed the merge with `git merge-tree --write-tree HEAD origin/main`,
  which writes nothing into the checkout. I ran no merge, no rebase, no stash,
  and removed or overwrote no file.

## 1. Twelve files with content conflicts

Between the 50 local commits and `origin/main`:

| File | Kind |
| --- | --- |
| `axtran2/app.js` | content |
| `tools/axtran2/README.md` | content |
| `package.json` | content |
| `src/import/parsers/technet/vermEsn/traAlignment.js` | content |
| `docs/app/architecture/AXTRAN2_DEMO_ADAPTER_2026-10-20.md` | content |
| `src/services/axtran2/alignmentPicture.js` | add/add |
| `src/services/axtran2/recordEdits.js` | add/add |
| `src/services/axtran2/recordList.js` | add/add |
| `src/services/axtran2/trackProject.js` | add/add |
| `src/services/axtran2/workerRun.js` | add/add |
| `test/axtran2/track-project.test.mjs` | add/add |
| `test/axtran2/worker-run.test.mjs` | add/add |

Nearly all of it is AXTRAN2: the 7L state committed locally against the state
on `origin/main`. Which side holds is for the stream that owns these files.

## 2. Eight uncommitted files that `origin/main` changed as well

Modified in the checkout, changed on `origin/main` since `c203f9a`, content
differs. Git refuses the merge while they lie there:

- `app/controllers/bridges/transitionEditorBridge.js`
- `app/styles/app.css`
- `app/ui/uiWiring.js`
- `app/view/editors/transitionEditorView.js`
- `app/view/shell/buildWindowShell.js`
- `technetViewer.html`
- `viewer/source-manifest.json`
- `viewer/src/viewer.css`

They belong to other streams (app, viewer). I may not stash or overwrite them.

## 3. TransEd is no obstacle of its own

- 75 untracked files that `origin/main` brings are byte-identical to it, the
  16 untracked TransEd files among them. `package.json` and
  `tools/axtran2/bundle.mjs` are modified in the checkout and equal
  `origin/main` as well; note that the committed `package.json` of local
  `main` is one of the twelve conflicts.
- Five untracked TransEd documents in the checkout are older copies; the
  version on `origin/main` is the newer one and can replace them:
  `docs/app/architecture/HANDOVER_ROCK_TRANSED_2026-11-12.md`,
  `docs/app/architecture/MISSION_REPORT_TRANSED_KLAUDER_GENERATOR_003.md`,
  `docs/app/architecture/MISSION_REPORT_TRANSED_PLAYGROUND_FINAL_002.md`,
  `docs/app/architecture/TRANSED_SCHWERPUNKT_KOPPLUNG_HERLEITUNG_2026-11-11.md`,
  `docs/app/architecture/evidence/TRANSED_LABELS_20261112/full-suite-result.txt`.
- Untracked files stop a merge even when equal. These 80 would have to be
  removed first; nothing is lost, `origin/main` holds the same or newer bytes.

## What I ask

Coordinate the merge of `origin/main` into `/AIM` with the streams that own
the files of sections 1 and 2. For TransEd I can remove the 80 untracked
copies of section 3 on Uwe's word, at the moment you name.

## To reproduce

    git -C /Users/uwefalz/Developer/ufAIM fetch origin
    git -C /Users/uwefalz/Developer/ufAIM merge-tree --write-tree HEAD origin/main

## What I need back

The commit at which `/AIM` contains `origin/main`, or the decision how the
twelve files are to be resolved.
