import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const CORE = new URL("src/aim-core/transition/", ROOT);

function imports(source) {
	return [...source.matchAll(/import\s+[\s\S]*?\sfrom\s+["']([^"']+)["']/g)]
		.map((match) => match[1]);
}

const MODULES = {
	"versioned/upgradeLegacyTransitionLookup.js": [
		"../grammar/TransitionQuantityRoles.js",
	],
	"versioned/VersionedTransitionEvaluator.js": [
		"../runtime/KappaFcnBuilder.js",
		"../runtime/clamp01.js",
		"../grammar/TransitionQuantityRoles.js",
	],
	"continuity/createVersionedContinuityModel.js": [
		"../runtime/KappaFcnBuilder.js",
		"../grammar/TransitionQuantityRoles.js",
	],
	"registry/RegistryResolver.js": [
		"../versioned/upgradeLegacyTransitionLookup.js",
		"./validateVersionedTransitionRegistry.js",
	],
};

test("canonical versioned modules have only the approved Core dependencies", async () => {
	for (const [path, expected] of Object.entries(MODULES)) {
		const source = await readFile(new URL(path, CORE), "utf8");
		assert.deepEqual(imports(source), expected, path);
		for (const specifier of imports(source)) {
			assert.match(specifier, /^\.\.?\//);
			assert.doesNotMatch(specifier, /\.json|src\/domain|src\/lib|^app|^node:/);
		}
	}
});

test("canonical versioned Core contains no concrete catalogue or forbidden surface", async () => {
	for (const path of Object.keys(MODULES)) {
		const source = await readFile(new URL(path, CORE), "utf8");
		for (const forbidden of [
			"document",
			"window",
			"Worker",
			"Messaging",
			"SPOT",
			"storage",
			"persistence",
			"MapLibre",
			"Three",
			"GND",
			"IFC",
		]) {
			assert.equal(source.includes(forbidden), false, `${path}: ${forbidden}`);
		}
	}
});

test("canonical and aggregate barrels retain one authority", async () => {
	const versioned = await import("../../../src/aim-core/transition/versioned/index.js");
	const registry = await import("../../../src/aim-core/transition/registry/index.js");
	const continuity = await import("../../../src/aim-core/transition/continuity/index.js");
	const transition = await import("../../../src/aim-core/transition/index.js");
	const root = await import("../../../src/aim-core/index.js");

	for (const api of [versioned, registry, continuity]) {
		for (const [name, value] of Object.entries(api)) {
			assert.strictEqual(transition[name], value, name);
			assert.strictEqual(root[name], value, name);
		}
	}
});

test("legacy modules are facades except the bounded JSON resolver adapter", async () => {
	const facades = [
		"src/domain/transition/versioned/upgradeLegacyTransitionLookup.js",
		"src/domain/transition/versioned/VersionedTransitionEvaluator.js",
		"src/domain/transition/versioned/continuity/createVersionedContinuityModel.js",
		"src/domain/transition/versioned/index.js",
		"src/domain/transition/versioned/continuity/index.js",
	];
	for (const path of facades) {
		const source = (await readFile(new URL(path, ROOT), "utf8")).trim();
		assert.match(source, /^export (?:\{[\s\S]*\}|\*) from /);
		assert.doesNotMatch(source, /\b(?:class|function|const|let|var)\b/);
	}

	const adapter = await readFile(
		new URL("src/domain/transition/registry/RegistryResolver.js", ROOT),
		"utf8"
	);
	assert.match(adapter, /transitionLookup\.json/);
	assert.match(adapter, /extends CoreRegistryResolver/);
	assert.match(adapter, /constructor\(db = transitionLookup\)/);
	assert.doesNotMatch(adapter, /resolveTransitionDescriptor\s*\(/);
});

test("canonical resolver is data-injected and legacy resolver remains its instance-compatible adapter", async () => {
	const { RegistryResolver: CoreResolver } = await import(
		"../../../src/aim-core/transition/registry/RegistryResolver.js"
	);
	const { RegistryResolver: LegacyResolver } = await import(
		"../../../src/domain/transition/registry/RegistryResolver.js"
	);
	const legacy = new LegacyResolver();
	assert.equal(legacy instanceof CoreResolver, true);
	assert.throws(() => new CoreResolver(), /upgradeLegacyTransitionLookup/);
});
