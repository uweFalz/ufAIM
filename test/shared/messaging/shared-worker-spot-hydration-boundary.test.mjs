import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workerUrl = new URL("../../../src/shared/messaging/SharedMessagingWorker.js", import.meta.url);
const serviceUrl = new URL("../../../src/shared/messaging/service/SpotService.js", import.meta.url);
const runtimeUrl = new URL("../../../src/shared/runtime/AppRuntimeLocal.js", import.meta.url);

test("worker owns one IndexedDB adapter and one shared hydration promise", () => {
	const source = fs.readFileSync(workerUrl, "utf8");
	assert.match(source, /IndexedDbSpotStateAdapter/);
	assert.equal((source.match(/const spotHydration = spotService\.hydrate\(\)/g) ?? []).length, 1);
	for (const command of [
		"Spot.AddCandidates",
		"Spot.AddObjects",
		"Spot.GetState",
		"Spot.GetUiState",
		"Spot.RenameObject",
		"Spot.RemoveObject",
		"Spot.PromoteImportItems",
		"Spot.PromoteImportItemsById",
	]) {
		const start = source.indexOf(`"${command}"`);
		assert.notEqual(start, -1, `${command} handler missing`);
		assert.match(source.slice(start, start + 700), /await spotHydration/);
	}
});

test("persistence remains outside Core Alignment UI and local fallback", () => {
	const worker = fs.readFileSync(workerUrl, "utf8");
	const service = fs.readFileSync(serviceUrl, "utf8");
	assert.doesNotMatch(worker + service, /src\/aim-core|AlignmentApplicationService|app\/controllers|document|window/);
	assert.doesNotMatch(fs.readFileSync(runtimeUrl, "utf8"), /IndexedDbSpotStateAdapter|indexedDB/);
});

test("Import-C2 worker command contracts remain present", () => {
	const source = fs.readFileSync(workerUrl, "utf8");
	for (const command of [
		"Import.BeginSession",
		"Import.AddItems",
		"Import.CommitJob",
		"Import.PublishResultEvidence",
		"Import.GetResultEvidence",
		"Import.SetItemAccepted",
	]) {
		assert.match(source, new RegExp(command.replace(".", "\\.")), `${command} must remain registered`);
	}
});
