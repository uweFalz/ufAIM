import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const GEOMETRY_ROOT = new URL("src/aim-core/geometry/", REPOSITORY_ROOT);
const CANONICAL_URL = new URL("vec2.js", GEOMETRY_ROOT);
const LEGACY_URL = new URL("src/lib/geom/vec2.js", REPOSITORY_ROOT);
const VECTOR_API = [
	"add",
	"dot",
	"len",
	"len2",
	"normalize",
	"rot",
	"rot90",
	"scale",
	"sub",
	"vec",
].sort();

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("Geometry Core retains vec2 implementation and barrel", async () => {
	const files = (await readdir(GEOMETRY_ROOT))
		.filter((name) => name.endsWith(".js"));
	assert.equal(files.includes("index.js"), true);
	assert.equal(files.includes("vec2.js"), true);
});

test("canonical vec2 implementation has zero imports", async () => {
	assert.deepEqual(
		importSpecifiers(await readFile(CANONICAL_URL, "utf8")),
		[]
	);
});

test("canonical vec2 has no forbidden dependency or domain coupling", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	for (const forbidden of [
		"app/",
		"src/domain/",
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
		"CRS",
		"Alignment",
		"Kappa",
		"transition",
		"GND",
		"IFC",
		"Cant",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("canonical vec2 module exposes exactly ten functions retained by Geometry", async () => {
	const canonical = await import("../../../src/aim-core/geometry/vec2.js");
	const geometry = await import("../../../src/aim-core/geometry/index.js");
	assert.deepEqual(Object.keys(canonical).sort(), VECTOR_API);
	for (const name of VECTOR_API) {
		assert.strictEqual(geometry[name], canonical[name], name);
	}
});

test("Root Core exposes Geometry by identity and retains every accepted API", () => {
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

test("legacy vec2 path is a logic-free canonical facade", async () => {
	assert.equal(
		await readFile(LEGACY_URL, "utf8"),
		'export * from "../../aim-core/geometry/vec2.js";\n'
	);
});

test("canonical vec2 never imports its legacy facade", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), []);
	assert.doesNotMatch(source, /src\/lib\/geom|lib\/geom/);
});

test("legacy consumers receive the canonical functions by identity", async () => {
	const legacy = await import("../../../src/lib/geom/vec2.js");
	const canonical = await import("../../../src/aim-core/geometry/vec2.js");
	for (const name of VECTOR_API) {
		assert.strictEqual(legacy[name], canonical[name], name);
	}
});
