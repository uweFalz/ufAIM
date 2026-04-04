# NOW.md

## Current Focus (ROCK MODE)

Focus strictly on core data flow:

parse → landFAT → validateLandFAT → sparse → validateSparse → SPOT → Projection → View

## Rules
- No UI / Window architecture work unless blocking
- No parallel paths
- No preview-specific geometry logic
- One truth per step

Windows share truth, not focus.
Canonical change -> per-window reprojection -> per-window rerender.

## Active Tasks
1. Normalize runImportPipeline to single path
2. Clean buildImportResultFromParsed (no magic)
3. Reduce importPreviewApply to thin adapter or remove
4. Ensure sparse is always produced before SPOT
5. Prepare Projection as single rendering entry

## Definition of Done
- Deterministic pipeline
- Debuggable at each step
- No hidden side-effects
