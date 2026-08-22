import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("workbench remains a presentation/delegation surface without domain authority", async () => {
	const [view, wiring, init] = await Promise.all(["app/view/alignment-profile/AlignmentProfileSynchronizedView.js", "app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js", "app/runtime/init/initFeatures.js"].map((path) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8")));
	assert.doesNotMatch(view, /^import\s/m); assert.doesNotMatch(view, /saveProfileState|sendCmdAwait|createVerticalConstructiveState|createCantConstructiveState|createChainageMapping/);
	assert.match(wiring, /focusLane\(lane\).*view\.focusLane/s); assert.match(wiring, /elementCount: elements\.length/);
	for (const lane of ["Vertical", "Cant", "Chainage"]) assert.match(init, new RegExp(`open${lane}: \\(\\) => \\{ ctx\\.alignmentBimWorkspace\\?\\.activate`));
});

test("deep links do not bypass canonical save/readback controllers", async () => {
	const model = await readFile(new URL("../../../app/domain/workspace/buildAlignmentEngineeringTaskRailModel.js", import.meta.url), "utf8");
	assert.match(model, /openVertical/); assert.match(model, /openCant/); assert.match(model, /openChainage/);
	assert.doesNotMatch(model, /save|Spot\.|sendCmdAwait|profileState\s*=/);
});
