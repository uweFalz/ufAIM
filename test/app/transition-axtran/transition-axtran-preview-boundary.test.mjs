import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const DIRECTORY_URL = new URL(
	"../../../app/controllers/transition-axtran/",
	import.meta.url
);
const CONTROLLER_URL = new URL(
	"../../../app/controllers/transition-axtran/createTransitionAxtranPreviewController.js",
	import.meta.url
);
const PROJECTION_URL = new URL(
	"../../../app/controllers/transition-axtran/createTransitionAxtranPreviewProjection.js",
	import.meta.url
);

function staticSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("preview logic owns exactly controller and projection modules", async () => {
	assert.deepEqual((await readdir(DIRECTORY_URL)).sort(), [
		"createTransitionAxtranPreviewController.js",
		"createTransitionAxtranPreviewProjection.js",
	]);
});

test("controller depends only on its local projection and projection has zero imports", async () => {
	const controllerSource = await readFile(CONTROLLER_URL, "utf8");
	const projectionSource = await readFile(PROJECTION_URL, "utf8");

	assert.deepEqual(staticSpecifiers(controllerSource), [
		"./createTransitionAxtranPreviewProjection.js",
	]);
	assert.deepEqual(staticSpecifiers(projectionSource), []);
});

test("preview logic has no Core concrete-data DOM SPOT or persistence dependency", async () => {
	const source = [
		await readFile(CONTROLLER_URL, "utf8"),
		await readFile(PROJECTION_URL, "utf8"),
	].join("\n");

	assert.doesNotMatch(
		source,
		/(?:aim-core|transitionLookup\.json|src\/domain|src\/services|document\.|window\.|HTMLElement|querySelector|Spot\.|SPOT|repository|saveById|IndexedDB|Worker|MessageChannel)/
	);
});

test("modules expose only the dedicated factories", async () => {
	const controller = await import(CONTROLLER_URL);
	const projection = await import(PROJECTION_URL);

	assert.deepEqual(Object.keys(controller), [
		"createTransitionAxtranPreviewController",
	]);
	assert.deepEqual(Object.keys(projection), [
		"createTransitionAxtranPreviewProjection",
	]);
});
