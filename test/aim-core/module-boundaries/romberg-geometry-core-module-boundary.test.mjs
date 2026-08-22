import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const CANONICAL_URL = new URL("src/aim-core/geometry/romberg.js", REPOSITORY_ROOT);
const LEGACY_URL = new URL("src/lib/math/numeric/romberg.js", REPOSITORY_ROOT);

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("canonical romberg has zero imports and exactly one object API", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), []);
	const canonical = await import("../../../src/aim-core/geometry/romberg.js");
	assert.deepEqual(Object.keys(canonical), ["romberg"]);
	assert.equal(typeof canonical.romberg, "object");
});

test("canonical romberg has no forbidden dependency", async () => {
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
		"TransitionElement",
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

test("legacy romberg is an exact logic-free canonical facade", async () => {
	assert.equal(
		await readFile(LEGACY_URL, "utf8"),
		'export { romberg } from "../../../aim-core/geometry/romberg.js";\n'
	);
});

test("canonical romberg never imports its legacy facade", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), []);
	assert.doesNotMatch(source, /src\/lib|lib\/math|src\/domain/);
});

test("Geometry and Root expose the canonical singleton by identity", async () => {
	const canonical = await import("../../../src/aim-core/geometry/romberg.js");
	const geometry = await import("../../../src/aim-core/geometry/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(geometry.romberg, canonical.romberg);
	assert.strictEqual(root.romberg, canonical.romberg);
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

test("legacy consumers receive the same mutable singleton authority", async () => {
	const legacy = await import("../../../src/lib/math/numeric/romberg.js");
	const canonical = await import("../../../src/aim-core/geometry/romberg.js");
	assert.strictEqual(legacy.romberg, canonical.romberg);
	const oldAbs = canonical.romberg.abs;
	try {
		legacy.romberg.abs = 123;
		assert.equal(canonical.romberg.abs, 123);
	} finally {
		canonical.romberg.abs = oldAbs;
	}
});
