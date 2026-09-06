import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("empty AIM starts on a neutral map without claiming project georeference", async () => {
	const [controller, adapter, css, imports, index] = await Promise.all([
		read("app/controllers/viewController.js"),
		read("app/controllers/adapters/geo/MapLibreThreeAdapter.js"),
		read("app/styles/app.css"),
		read("config/importmap.external.json"),
		read("index.html"),
	]);
	assert.match(controller, /async function syncSpatialStart\(\)/);
	assert.match(controller, /badge\.textContent = "MAP"/);
	assert.match(controller, /Startkarte · noch ohne Projektgeoreferenz/);
	assert.match(controller, /placement: spatialStart \? "map-context" : "local"/);
	assert.match(adapter, /center: this\.options\.center \?\? \[10\.45, 51\.16\]/);
	assert.match(adapter, /zoom: this\.options\.zoom \?\? 5\.4/);
	assert.match(css, /\.uf-stageWrap\.is-spatial-start > \.uf-geoMap \{ z-index: 3; \}/);
	assert.match(imports, /https:\/\/cdn\.jsdelivr\.net\/npm\/maplibre-gl\/\+esm/);
	assert.match(index, /maplibre-gl\/dist\/maplibre-gl\.css/);
	assert.doesNotMatch(controller, /navigator\.geolocation/);
});
