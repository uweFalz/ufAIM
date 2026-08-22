import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const CANONICAL_URL = new URL(
	"src/aim-core/geometry/AlignmentElement.js",
	REPOSITORY_ROOT
);
const LEGACY_URL = new URL(
	"src/domain/alignment/elements/AlignmentElement.js",
	REPOSITORY_ROOT
);

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("canonical AlignmentElement imports exactly canonical normalize", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), ["./vec2.js"]);
	assert.match(
		source,
		/import\s*\{\s*normalize\s*\}\s*from\s*"\.\/vec2\.js"/
	);
});

test("canonical AlignmentElement has no forbidden dependency", async () => {
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
		"FixedElement",
		"TransitionElement",
		"ImmediateElement",
		"KinkElement",
		"ZeroLength",
		"Kappa",
		"transition",
		"CRS",
		"Cant",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("canonical AlignmentElement module exposes exactly one class", async () => {
	const canonical = await import(
		"../../../src/aim-core/geometry/AlignmentElement.js"
	);
	assert.deepEqual(Object.keys(canonical), ["AlignmentElement"]);
	assert.equal(typeof canonical.AlignmentElement, "function");
});

test("Geometry and Root expose canonical AlignmentElement by identity", async () => {
	const canonical = await import(
		"../../../src/aim-core/geometry/AlignmentElement.js"
	);
	const geometry = await import("../../../src/aim-core/geometry/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(geometry.AlignmentElement, canonical.AlignmentElement);
	assert.strictEqual(root.AlignmentElement, canonical.AlignmentElement);
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

test("legacy AlignmentElement path is a logic-free canonical facade", async () => {
	assert.equal(
		await readFile(LEGACY_URL, "utf8"),
		'export { AlignmentElement } from "../../../aim-core/geometry/AlignmentElement.js";\n'
	);
});

test("canonical AlignmentElement never imports its legacy facade", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.doesNotMatch(source, /domain\/alignment|src\/domain/);
	assert.deepEqual(importSpecifiers(source), ["./vec2.js"]);
});

test("legacy consumers inherit the canonical base authority", async () => {
	const legacy = await import(
		"../../../src/domain/alignment/elements/AlignmentElement.js"
	);
	const canonical = await import(
		"../../../src/aim-core/geometry/AlignmentElement.js"
	);
	assert.strictEqual(legacy.AlignmentElement, canonical.AlignmentElement);
});
