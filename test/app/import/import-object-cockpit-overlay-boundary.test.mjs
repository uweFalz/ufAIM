import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("visible import-object journey stays above alignmentOS and has no parser or Core authority", async () => {
	const [adapter, cockpitView, rows, workbench] = await Promise.all([
		read("app/domain/cockpit/cockpitItemAdapters.js"),
		read("app/view/cockpit/renderCockpitHtml.js"),
		read("app/view/cockpit/renderCockpitRows.js"),
		read("app/gndImportWorkbench/gndImportWorkbenchController.js"),
	]);
	assert.doesNotMatch(`${adapter}\n${cockpitView}\n${rows}`, /parseGND|parseLandXML|createAlignment|appendAlignment|deriveImportRelations/);
	assert.match(workbench, /cockpit\.acceptImportItem\(itemId, \{ show: true \}\)/);
	assert.match(workbench, /Spot\.GetState/);
	assert.match(workbench, /meta\?\.importItemId/);
	assert.doesNotMatch(workbench, /Spot\.AddObjects|Spot\.PromoteImportItemsById|Import\.SetItemAccepted/);
});

test("only qualified candidates expose promotion actions", async () => {
	const rows = await read("app/view/cockpit/renderCockpitRows.js");
	assert.match(rows, /row\.promotable/);
	assert.match(rows, /data-cockpit-accept-show/);
	assert.match(rows, /row\.reason/);
});
