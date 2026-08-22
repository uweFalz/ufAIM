import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const CANONICAL_URL = new URL(
	"src/aim-core/geometry/FixedElement.js",
	REPOSITORY_ROOT
);
const LEGACY_URL = new URL(
	"src/domain/alignment/elements/FixedElement.js",
	REPOSITORY_ROOT
);

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("canonical FixedElement has exactly the two canonical dependencies", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), [
		"./AlignmentElement.js",
		"./poseAdvance2.js",
	]);
	assert.match(
		source,
		/import\s*\{\s*AlignmentElement\s*\}\s*from\s*"\.\/AlignmentElement\.js"/
	);
	assert.match(
		source,
		/import\s*\{\s*advance\s*\}\s*from\s*"\.\/poseAdvance2\.js"/
	);
});

test("canonical FixedElement has no forbidden dependency", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	for (const forbidden of [
		"src/domain/",
		"src/lib/",
		"app/",
		"src/services/",
		"src/import/",
		"src/shared/",
		"src/model/spot/",
		"window",
		"document",
		"Worker",
		"Messaging",
		"MapLibre",
		"THREE",
		"storage",
		"persistence",
		"adapter",
		"AlignmentFactory",
		"TransitionElement",
		"Kappa",
		"transition",
		"CRS",
		"Cant",
		"GND",
		"IFC",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("canonical FixedElement module exposes exactly one class", async () => {
	const canonical = await import(
		"../../../src/aim-core/geometry/FixedElement.js"
	);
	assert.deepEqual(Object.keys(canonical), ["FixedElement"]);
	assert.equal(typeof canonical.FixedElement, "function");
});

test("Geometry and Root expose FixedElement by identity", async () => {
	const canonical = await import(
		"../../../src/aim-core/geometry/FixedElement.js"
	);
	const geometry = await import("../../../src/aim-core/geometry/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(geometry.FixedElement, canonical.FixedElement);
	assert.strictEqual(root.FixedElement, canonical.FixedElement);
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

test("legacy FixedElement path is a logic-free canonical facade", async () => {
	assert.equal(
		await readFile(LEGACY_URL, "utf8"),
		'export { FixedElement } from "../../../aim-core/geometry/FixedElement.js";\n'
	);
});

test("canonical FixedElement never imports its legacy facade", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.doesNotMatch(source, /src\/domain|domain\/alignment|src\/lib/);
	assert.deepEqual(importSpecifiers(source), [
		"./AlignmentElement.js",
		"./poseAdvance2.js",
	]);
});

test("Alignment E2E imports only FixedElement from its canonical module", async () => {
	const source = await readFile(
		new URL("src/domain/alignment/_e2eAlignmentTest.js", REPOSITORY_ROOT),
		"utf8"
	);
	assert.match(
		source,
		/import\s*\{\s*FixedElement\s*\}\s*from\s*"\.\.\/\.\.\/aim-core\/geometry\/FixedElement\.js"/
	);
	assert.doesNotMatch(source, /elements\/FixedElement\.js/);
});

test("legacy consumers receive the canonical FixedElement authority", async () => {
	const legacy = await import(
		"../../../src/domain/alignment/elements/FixedElement.js"
	);
	const canonical = await import(
		"../../../src/aim-core/geometry/FixedElement.js"
	);
	assert.strictEqual(legacy.FixedElement, canonical.FixedElement);
});
