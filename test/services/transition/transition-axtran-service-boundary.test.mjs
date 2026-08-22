import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const SERVICE_URL = new URL(
	"../../../src/services/transition/TransitionAxtranApplicationService.js",
	import.meta.url
);
const ADAPTER_URL = new URL(
	"../../../src/services/transition/TransitionCatalogueAdapter.js",
	import.meta.url
);
const INDEX_URL = new URL(
	"../../../src/services/transition/index.js",
	import.meta.url
);
const DIRECTORY_URL = new URL("../../../src/services/transition/", import.meta.url);

function staticSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("transition service directory contains exactly service adapter and barrel", async () => {
	assert.deepEqual(
		(await readdir(DIRECTORY_URL)).sort(),
		[
			"TransitionAxtranApplicationService.js",
			"TransitionCatalogueAdapter.js",
			"index.js",
		]
	);
});

test("application service depends only on canonical Transition Core modules", async () => {
	const source = await readFile(SERVICE_URL, "utf8");
	const specifiers = staticSpecifiers(source);
	assert.equal(specifiers.length, 5);
	assert.ok(specifiers.every((specifier) =>
		specifier.startsWith("../../aim-core/transition/")
	));
	assert.doesNotMatch(
		source,
		/(?:transitionLookup\.json|src\/domain|app\/|geometry|profile|topology|window|document|Worker|Message)/
	);
});

test("catalogue adapter is the sole concrete JSON boundary", async () => {
	const serviceSource = await readFile(SERVICE_URL, "utf8");
	const adapterSource = await readFile(ADAPTER_URL, "utf8");
	assert.doesNotMatch(serviceSource, /\.json/);
	assert.deepEqual(staticSpecifiers(adapterSource), [
		"../../domain/transition/transitionLookup.json",
		"../../aim-core/transition/registry/RegistryResolver.js",
	]);
});

test("barrel exposes only the service and concrete adapter identities", async () => {
	const directService = await import(SERVICE_URL);
	const directAdapter = await import(ADAPTER_URL);
	const barrel = await import(INDEX_URL);
	assert.deepEqual(Object.keys(barrel).sort(), [
		"TransitionAxtranApplicationService",
		"TransitionCatalogueAdapter",
	]);
	assert.strictEqual(
		barrel.TransitionAxtranApplicationService,
		directService.TransitionAxtranApplicationService
	);
	assert.strictEqual(
		barrel.TransitionCatalogueAdapter,
		directAdapter.TransitionCatalogueAdapter
	);
});
