import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const CANONICAL_URL = new URL(
	"src/aim-core/geometry/TransitionElement.js",
	REPOSITORY_ROOT
);
const LEGACY_URL = new URL(
	"src/domain/alignment/elements/TransitionElement.js",
	REPOSITORY_ROOT
);

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("canonical TransitionElement has exactly three canonical dependencies", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), [
		"./AlignmentElement.js",
		"./vec2.js",
		"./romberg.js",
	]);
	assert.match(source, /import\s*\{\s*AlignmentElement\s*\}\s*from\s*"\.\/AlignmentElement\.js"/);
	assert.match(source, /import\s*\{\s*normalize,\s*rot90\s*\}\s*from\s*"\.\/vec2\.js"/);
	assert.match(source, /import\s*\{\s*romberg\s*\}\s*from\s*"\.\/romberg\.js"/);
});

test("canonical TransitionElement has no forbidden dependency", async () => {
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
		"KinkElement",
		"ImmediateElement",
		"FixedElement",
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

test("canonical TransitionElement exposes exactly one class", async () => {
	const canonical = await import(
		"../../../src/aim-core/geometry/TransitionElement.js"
	);
	assert.deepEqual(Object.keys(canonical), ["TransitionElement"]);
	assert.equal(typeof canonical.TransitionElement, "function");
});

test("legacy TransitionElement is an exact logic-free canonical facade", async () => {
	assert.equal(
		await readFile(LEGACY_URL, "utf8"),
		'export { TransitionElement } from "../../../aim-core/geometry/TransitionElement.js";\n'
	);
});

test("Geometry and Root expose TransitionElement by identity", async () => {
	const canonical = await import(
		"../../../src/aim-core/geometry/TransitionElement.js"
	);
	const geometry = await import("../../../src/aim-core/geometry/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(geometry.TransitionElement, canonical.TransitionElement);
	assert.strictEqual(root.TransitionElement, canonical.TransitionElement);
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

test("canonical TransitionElement never imports its legacy facade", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.doesNotMatch(source, /src\/domain|domain\/alignment|src\/lib/);
	assert.deepEqual(importSpecifiers(source), [
		"./AlignmentElement.js",
		"./vec2.js",
		"./romberg.js",
	]);
});

test("legacy consumers inherit the canonical TransitionElement authority", async () => {
	const legacy = await import(
		"../../../src/domain/alignment/elements/TransitionElement.js"
	);
	const canonical = await import(
		"../../../src/aim-core/geometry/TransitionElement.js"
	);
	assert.strictEqual(legacy.TransitionElement, canonical.TransitionElement);
});
