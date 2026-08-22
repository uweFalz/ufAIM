import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const CANONICAL_URL = new URL(
	"src/aim-core/geometry/poseAdvance2.js",
	REPOSITORY_ROOT
);
const LEGACY_URL = new URL(
	"src/lib/geom/frame/poseAdvance2.js",
	REPOSITORY_ROOT
);

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("canonical pose advance imports exactly canonical rot90", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), ["./vec2.js"]);
	assert.match(source, /import\s*\{\s*rot90\s*\}\s*from\s*"\.\/vec2\.js"/);
});

test("canonical pose advance has no forbidden dependency", async () => {
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
		"SPOT",
		"storage",
		"persistence",
		"renderer",
		"Alignment",
		"Factory",
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

test("canonical pose advance module exposes exactly one function", async () => {
	const canonical = await import(
		"../../../src/aim-core/geometry/poseAdvance2.js"
	);
	assert.deepEqual(Object.keys(canonical), ["advance"]);
	assert.equal(typeof canonical.advance, "function");
});

test("Geometry and Root expose canonical advance by identity", async () => {
	const canonical = await import(
		"../../../src/aim-core/geometry/poseAdvance2.js"
	);
	const geometry = await import("../../../src/aim-core/geometry/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(geometry.advance, canonical.advance);
	assert.strictEqual(root.advance, canonical.advance);
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

test("legacy pose advance path is a logic-free canonical facade", async () => {
	assert.equal(
		await readFile(LEGACY_URL, "utf8"),
		'export { advance } from "../../../aim-core/geometry/poseAdvance2.js";\n'
	);
});

test("canonical pose advance never imports its legacy facade", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.doesNotMatch(source, /src\/lib|lib\/geom/);
	assert.deepEqual(importSpecifiers(source), ["./vec2.js"]);
});

test("legacy pose advance facade retains the canonical function authority", async () => {
	const legacy = await import("../../../src/lib/geom/frame/poseAdvance2.js");
	const canonical = await import(
		"../../../src/aim-core/geometry/poseAdvance2.js"
	);
	assert.strictEqual(legacy.advance, canonical.advance);
});
