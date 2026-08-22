import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("selected sequence row exposes explicit two-step removal and truthful states", async () => {
	const [bridge, de, css] = await Promise.all([read("app/controllers/bridges/alignmentEditorBridge.js"), read("app/i18n/strings.de.js"), read("app/styles/app.css")]);
	assert.match(bridge, /data\.sequenceRequestRemove|dataset\.sequenceRequestRemove/);
	assert.match(bridge, /data\.sequenceConfirmRemove|dataset\.sequenceConfirmRemove/);
	assert.match(bridge, /data\.sequenceCancelRemove|dataset\.sequenceCancelRemove/);
	assert.match(bridge, /pendingRemovalId === row\.id/);
	assert.match(de, /Element \{id\} wirklich entfernen/);
	assert.match(de, /kanonischer Readback bestätigt/);
	assert.match(css, /data-sequence-control-row/);
});

