import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const REGISTRY_ROOT = new URL(
	"src/aim-core/transition/registry/",
	REPOSITORY_ROOT
);
const IMPLEMENTATION_URL = new URL(
	"validateVersionedTransitionRegistry.js",
	REGISTRY_ROOT
);
const REGISTRY_API = [
	"RegistryResolver",
	"validateVersionedTransitionRegistry",
];
const GRAMMAR_IMPORTS = [
	"TRANSITION_COMPONENT_ORDER",
	"TRANSITION_SCHEMA_VERSION",
	"TransitionRepresentationLevel",
	"ZERO_LENGTH_POLICY",
].sort();

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("Registry directory contains validator resolver and barrel", async () => {
	assert.deepEqual(
		(await readdir(REGISTRY_ROOT)).filter((name) => name.endsWith(".js")).sort(),
		[
			"RegistryResolver.js",
			"index.js",
			"validateVersionedTransitionRegistry.js",
		]
	);
});

test("canonical Registry validator imports exactly four Grammar symbols", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), [
		"../grammar/TransitionQuantityRoles.js",
	]);
	const importBlock = source.match(
		/import\s*\{([\s\S]*?)\}\s*from\s*"\.\.\/grammar\/TransitionQuantityRoles\.js";/
	);
	assert.ok(importBlock);
	assert.deepEqual(
		importBlock[1]
			.split(",")
			.map((name) => name.trim())
			.filter(Boolean)
			.sort(),
		GRAMMAR_IMPORTS
	);
});

test("canonical Registry validator has no forbidden dependency", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	for (const forbidden of [
		"app/",
		"src/services/",
		"src/import/",
		"src/shared/",
		"src/model/spot/",
		"domain/transition/versioned",
		"window",
		"document",
		"Worker",
		"Messaging",
		"SPOT",
		"storage",
		"persistence",
		"renderer",
		"GND",
		"IFC",
		"RegistryResolver",
		"upgradeLegacy",
		"createVersionedTransitionEvaluator",
		"Kappa",
		"continuity",
		"transitionDB",
		"axtranNew",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("Registry barrel retains validator and adds injected resolver", async () => {
	const registry = await import(
		"../../../src/aim-core/transition/registry/index.js"
	);
	assert.deepEqual(Object.keys(registry).sort(), REGISTRY_API);
});

test("Transition and Root barrels expose the Registry function by identity", async () => {
	const registry = await import(
		"../../../src/aim-core/transition/registry/index.js"
	);
	const transition = await import("../../../src/aim-core/transition/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(
		transition.validateVersionedTransitionRegistry,
		registry.validateVersionedTransitionRegistry
	);
	assert.strictEqual(
		root.validateVersionedTransitionRegistry,
		registry.validateVersionedTransitionRegistry
	);
});

test("fresh Root-Core import retains every accepted module identity", () => {
	const moduleUrls = [
		"src/aim-core/alignment/profile/index.js",
		"src/aim-core/alignment/topology/index.js",
		"src/aim-core/alignment/authoring/index.js",
		"src/aim-core/transition/grammar/index.js",
		"src/aim-core/transition/axtran/index.js",
		"src/aim-core/transition/registry/index.js",
	].map((path) => new URL(path, REPOSITORY_ROOT).href);
	const rootUrl = new URL("src/aim-core/index.js", REPOSITORY_ROOT).href;
	const script = `
		const root = await import(${JSON.stringify(rootUrl)});
		const modules = await Promise.all(${JSON.stringify(moduleUrls)}.map(
			(url) => import(url)
		));
		process.stdout.write(JSON.stringify(
			modules.map((api) =>
				Object.keys(api).every((name) => root[name] === api[name])
			)
		));
	`;
	assert.deepEqual(
		JSON.parse(
			execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
				cwd: REPOSITORY_ROOT,
				encoding: "utf8",
			})
		),
		[true, true, true, true, true, true]
	);
});

test("canonical Registry validator never imports its legacy facade", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.doesNotMatch(
		source,
		/src\/domain\/transition\/versioned|domain\/transition\/versioned/
	);
});
