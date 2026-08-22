import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const CANONICAL_URL = new URL(
	"src/aim-core/geometry/Alignment2D.js",
	REPOSITORY_ROOT
);
const LEGACY_URL = new URL(
	"src/domain/alignment/Alignment2D.js",
	REPOSITORY_ROOT
);
const E2E_URL = new URL(
	"src/domain/alignment/_e2eAlignmentTest.js",
	REPOSITORY_ROOT
);

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("canonical Alignment2D imports exactly four canonical vec2 symbols", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), ["./vec2.js"]);
	assert.match(
		source,
		/import\s*\{\s*normalize,\s*dot,\s*sub,\s*rot90\s*\}\s*from\s*"\.\/vec2\.js"/
	);
});

test("canonical Alignment2D has no forbidden dependency", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	for (const forbidden of [
		"src/domain/",
		"app/",
		"src/services/",
		"src/import/",
		"src/shared/",
		"src/model/spot/",
		"window",
		"document",
		"Worker",
		"Messaging",
		"SPOT",
		"storage",
		"persistence",
		"renderer",
		"AlignmentFactory",
		"AlignmentElement",
		"Kappa",
		"transition",
		"CRS",
		"Cant",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("canonical Alignment2D module exposes exactly one class", async () => {
	const canonical = await import(
		"../../../src/aim-core/geometry/Alignment2D.js"
	);
	assert.deepEqual(Object.keys(canonical), ["Alignment2D"]);
	assert.equal(typeof canonical.Alignment2D, "function");
});

test("Geometry and Root barrels expose canonical Alignment2D by identity", async () => {
	const canonical = await import(
		"../../../src/aim-core/geometry/Alignment2D.js"
	);
	const geometry = await import("../../../src/aim-core/geometry/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(geometry.Alignment2D, canonical.Alignment2D);
	assert.strictEqual(root.Alignment2D, canonical.Alignment2D);
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

test("legacy Alignment2D path is a logic-free canonical facade", async () => {
	assert.equal(
		await readFile(LEGACY_URL, "utf8"),
		'export { Alignment2D } from "../../aim-core/geometry/Alignment2D.js";\n'
	);
});

test("canonical Alignment2D never imports its legacy facade", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.doesNotMatch(source, /domain\/alignment|src\/domain/);
	assert.deepEqual(importSpecifiers(source), ["./vec2.js"]);
});

test("Alignment E2E imports only Alignment2D from canonical Geometry", async () => {
	const source = await readFile(E2E_URL, "utf8");
	assert.match(
		source,
		/import\s*\{\s*Alignment2D\s*\}\s*from\s*"\.\.\/\.\.\/aim-core\/geometry\/Alignment2D\.js"/
	);
	assert.match(source, /from\s+"\.\/build\/AlignmentFactory\.js"/);
});
