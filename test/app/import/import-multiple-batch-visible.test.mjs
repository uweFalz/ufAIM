import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const controllerSource = await readFile(new URL("../../../app/controllers/importController.js", import.meta.url), "utf8");
const viewSource = await readFile(new URL("../../../app/gndImportWorkbench/gndImportWorkbenchView.js", import.meta.url), "utf8");

test("multi-file batch publishes ordered queued active staged and completed evidence", () => {
	assert.match(controllerSource, /state: "queued"/);
	assert.match(controllerSource, /state: "processing"/);
	assert.match(controllerSource, /state: "staged"/);
	assert.match(controllerSource, /state: "completed"/);
	assert.match(controllerSource, /activeFileIndex: sourceIndex/);
	assert.match(controllerSource, /fileStates: snapshotFileStates\(\)/);
});

test("Workbench renders each batch file with an explicit visible state", () => {
	assert.match(viewSource, /data\.importFileState|dataset\.importFileState/);
	assert.match(viewSource, /wartet/);
	assert.match(viewSource, /aktiv/);
	assert.match(viewSource, /analysiert/);
	assert.match(viewSource, /abgeschlossen/);
});

test("one failed file no longer discards successful siblings or leaves the batch spinning", () => {
	assert.match(controllerSource, /const failedFiles = \[\]/);
	assert.match(controllerSource, /failedFiles\.push\(\{ sourceIndex, job, file, outcome \}\)/);
	assert.match(controllerSource, /status: failedFiles\.length \? \(stagedFiles\.length \? "partial" : "failed"\) : "succeeded"/);
	assert.match(controllerSource, /\.sort\(\(a, b\) => a\.sourceIndex - b\.sourceIndex\)/);
	assert.doesNotMatch(controllerSource, /Import batch aborted after/);
	assert.match(controllerSource, /const commitCandidates = \[\.\.\.stagedFiles\]/);
	assert.match(controllerSource, /files: \[\{/);
});
