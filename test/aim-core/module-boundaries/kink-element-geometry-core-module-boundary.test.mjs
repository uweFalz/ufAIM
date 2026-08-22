import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const CANONICAL_URL = new URL(
	"src/aim-core/geometry/KinkElement.js",
	REPOSITORY_ROOT
);
const LEGACY_URL = new URL(
	"src/domain/alignment/elements/KinkElement.js",
	REPOSITORY_ROOT
);

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("canonical KinkElement has exactly two canonical dependencies", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), [
		"./TransitionElement.js",
		"./vec2.js",
	]);
	assert.match(
		source,
		/import\s*\{\s*TransitionElement\s*\}\s*from\s*"\.\/TransitionElement\.js"/
	);
	assert.match(source, /import\s*\{\s*rot\s*\}\s*from\s*"\.\/vec2\.js"/);
});

test("canonical KinkElement has no forbidden dependency", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	for (const forbidden of [
		"src/domain/",
		"src/lib/",
		"app/",
		"src/services/",
		"src/import/",
		"src/shared/",
		"window",
		"document",
		"Worker",
		"Messaging",
		"GND",
		"IFC",
		"SPOT",
		"storage",
		"persistence",
		"renderer",
		"MapLibre",
		"THREE",
		"AlignmentFactory",
		"ImmediateElement",
		"FixedElement",
		"romberg",
		"Kappa",
		"AXTRAN",
		"transitionDB",
		"CRS",
		"Cant",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("canonical KinkElement exposes exactly one class", async () => {
	const canonical = await import("../../../src/aim-core/geometry/KinkElement.js");
	assert.deepEqual(Object.keys(canonical), ["KinkElement"]);
	assert.equal(typeof canonical.KinkElement, "function");
});

test("legacy KinkElement is an exact logic-free canonical facade", async () => {
	assert.equal(
		await readFile(LEGACY_URL, "utf8"),
		'export { KinkElement } from "../../../aim-core/geometry/KinkElement.js";\n'
	);
});

test("Geometry and Root expose KinkElement by identity", async () => {
	const canonical = await import("../../../src/aim-core/geometry/KinkElement.js");
	const geometry = await import("../../../src/aim-core/geometry/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(geometry.KinkElement, canonical.KinkElement);
	assert.strictEqual(root.KinkElement, canonical.KinkElement);
});

test("fresh Root Core retains every accepted module identity", () => {
	const moduleUrls = [
		"src/aim-core/alignment/profile/index.js",
		"src/aim-core/alignment/topology/index.js",
		"src/aim-core/alignment/authoring/index.js",
		"src/aim-core/transition/grammar/index.js",
		"src/aim-core/transition/axtran/index.js",
		"src/aim-core/transition/registry/index.js",
		"src/aim-core/transition/continuity/index.js",
		"src/aim-core/transition/ast/index.js",
		"src/aim-core/transition/query/index.js",
		"src/aim-core/geometry/index.js",
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
		[true, true, true, true, true, true, true, true, true, true]
	);
});

test("canonical KinkElement never imports its legacy facade", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.doesNotMatch(source, /src\/domain|domain\/alignment|src\/lib/);
	assert.deepEqual(importSpecifiers(source), [
		"./TransitionElement.js",
		"./vec2.js",
	]);
});

test("legacy construction receives canonical KinkElement authority", async () => {
	const legacy = await import(
		"../../../src/domain/alignment/elements/KinkElement.js"
	);
	const canonical = await import("../../../src/aim-core/geometry/KinkElement.js");
	assert.strictEqual(legacy.KinkElement, canonical.KinkElement);
	assert.ok(new legacy.KinkElement() instanceof canonical.KinkElement);
});
