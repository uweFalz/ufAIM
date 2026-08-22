import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const init = fs.readFileSync(new URL("../../../app/runtime/init/initFeatures.js", import.meta.url), "utf8");
const wiring = fs.readFileSync(new URL("../../../app/ui/uiWiring.js", import.meta.url), "utf8");
const view = fs.readFileSync(new URL("../../../app/view/overlays/spotView.js", import.meta.url), "utf8");
const packageSource = `${init}\n${wiring}\n${view}`;

test("object hydration remains a single canonical UI read with no timer persistence import or relation authority", () => {
	assert.equal((wiring.match(/sendCmdAwait\("Spot\.GetUiState"/g) ?? []).length, 1);
	assert.doesNotMatch(packageSource, /setInterval|setTimeout|poll|IndexedDb|indexedDB|SpotService|SharedMessagingWorker/);
	assert.doesNotMatch(packageSource, /Import\.SetRelationDecision|relationCandidates|confirmedCandidateId|knowledgeKernel/);
	assert.match(wiring, /if \(pending\) return pending/);
	assert.match(wiring, /showSpotLoading/);
	assert.match(wiring, /showSpotError/);
});
