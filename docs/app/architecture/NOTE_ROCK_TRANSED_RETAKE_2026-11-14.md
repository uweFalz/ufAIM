# Note to Rock: take eleven TransEd files again

Date: 2026-11-14. From: Claude (stream `app`, TransEd). To: Rock.
Ordered by Uwe ("schreib Rock, dass er die elf Dateien neu übernimmt").
Adds to `docs/app/architecture/HANDOVER_ROCK_TRANSED_2026-11-12.md`, sections 4 to 6.

## What I ask

Take the eleven files below again from the tip of
`origin/claude/transed-playground` (`fa0015e`, the commit that added this
note, or later; pull request https://github.com/uweFalz/ufAIM/pull/122) into
`/Users/uwefalz/Developer/ufAIM`. Since `1c54e04` only documents and evidence
changed on the branch, so the eleven files and their checksums are the same at
every later commit.

## Why

The checkout holds all 18 TransEd files, uncommitted, byte-identical to the
branch at `47e8055` (bundle source `f606c6956d3e`). That is the state before
Uwe confirmed the coupling model and chose the exact expression (2026-11-13,
commit `1c54e04`). The page there still shows "Modellvorbehalt" and computes
the small-angle form. I read this on 2026-11-14 and wrote nothing in `/AIM`.

## The eleven files, with SHA-256 at the tip

```
ce00c68b80a5605e5dc7f8943fdd5e9cb66e1bb776aa6c28f51fadccca91e0c7  src/services/transition-library/cantCurvatureCoupling.js
45d258347a6f55cd1b5e835465552ce220d4194f40cb020104f7c4fe062372cc  src/services/transition-library/createTransitionLibraryService.js
12801de9610a11f719f69a3d8a381a20d9e874e022ee591cd072b11a171c2334  src/services/transition-library/index.js
03a6b975df326e3bbf5f09a03cb72bbde536949943463d929f934d024fd02316  test/services/transition-library/cant-curvature-coupling.test.mjs
bf3b20686f99976db2956312fa2dbbd434dbf7be351042595920517e99a6614c  test/services/transition-library/declare-halfwave-as.test.mjs
5239ee3f374d138f1da68e4ff271d8e1e79a9c59d9b78d772f48b06e34711f7a  test/services/transition-library/transition-library-service.test.mjs
a3563b8dc1a5bf90959a47209e3472294c29aa11330954b88de5b3e5250bdb1e  test/transed/bundle.test.mjs
0a23fbeae3a6d79f35e2aceebedf0ef300addfaa09eac8b24dd5eacef1aa9b99  transed.html
340047f41c901c905d619f7a0db0093b7ace84ddbb5a735165dbf026f4012783  transed/README.md
10a6e8153951979d4406ef199f3fae14c8d012adfea1f81968a05730967d8759  transed/app.js
ec6a149790e4a5b9f04a68c838c6f237568200eaa7e4ee26d750e2d8dca3622b  transed/index.html
```

The other seven of the 18 already equal the tip, among them `package.json` and
`tools/axtran2/bundle.mjs`. The full list of 18 is
`docs/app/architecture/evidence/TRANSED_EXACT_20261113/takeover-sha256.txt`.

## Check afterwards, in `/AIM`

- `node tools/transed/bundle.mjs --check` must report source `30946d8eb748`
  (`npm run bundle:transed:check`).
- `node --test test/services/transition-library/*.test.mjs test/transed/*.test.mjs`
  — 46 of 46 pass in the worktree at `26a0c5c`.
- `npm run bundle` once: the AXTRAN2 source manifest changes with the
  library's new export `couplingGeometry`. I could not check this in the
  worktree, which has no `axtran2.html`.

## What I need back

The commit in `/AIM` that carries the files, and the source hash the check
reports there. I have no order to merge, to push further or to clean up.
