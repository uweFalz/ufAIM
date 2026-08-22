import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const AST_ROOT = new URL("src/aim-core/transition/ast/", REPOSITORY_ROOT);
const IMPLEMENTATION_URL = new URL("evalAst.js", AST_ROOT);
function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("Transition AST Core retains the evaluator implementation and barrel", async () => {
	const files = (await readdir(AST_ROOT)).filter((name) => name.endsWith(".js"));
	assert.equal(files.includes("evalAst.js"), true);
	assert.equal(files.includes("index.js"), true);
});

test("canonical AST evaluator has zero imports", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), []);
});

test("canonical AST evaluator has no forbidden dependency", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	for (const forbidden of [
		"app/",
		"src/services/",
		"src/import/",
		"src/shared/",
		"src/model/spot/",
		"src/domain/",
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
		"VersionedTransitionEvaluator",
		"KappaFcnBuilder",
		"simplify",
		"symDiff",
		"symInt",
		"compose",
		"continuity",
		"transitionDB",
		"axtranNew",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("Transition AST barrel retains the evaluator API", async () => {
	const ast = await import("../../../src/aim-core/transition/ast/index.js");
	assert.equal(typeof ast.makeEvalFn, "function");
});

test("Transition and Root barrels expose makeEvalFn by identity", async () => {
	const ast = await import("../../../src/aim-core/transition/ast/index.js");
	const transition = await import("../../../src/aim-core/transition/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(transition.makeEvalFn, ast.makeEvalFn);
	assert.strictEqual(root.makeEvalFn, ast.makeEvalFn);
});

test("fresh Root-Core import retains every accepted module identity", () => {
	const moduleUrls = [
		"src/aim-core/alignment/profile/index.js",
		"src/aim-core/alignment/topology/index.js",
		"src/aim-core/alignment/authoring/index.js",
		"src/aim-core/transition/grammar/index.js",
		"src/aim-core/transition/axtran/index.js",
		"src/aim-core/transition/registry/index.js",
		"src/aim-core/transition/continuity/index.js",
		"src/aim-core/transition/ast/index.js",
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
		[true, true, true, true, true, true, true, true]
	);
});

test("canonical AST evaluator never imports its legacy facade", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.doesNotMatch(source, /domain\/transition\/registry\/ast\/evalAst/);
});
