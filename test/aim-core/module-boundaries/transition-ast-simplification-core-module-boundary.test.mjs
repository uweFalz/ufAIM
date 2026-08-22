import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const AST_ROOT = new URL("src/aim-core/transition/ast/", REPOSITORY_ROOT);
const IMPLEMENTATION_URL = new URL("simplify.js", AST_ROOT);
const SIMPLIFICATION_API = [
	"makeEvalFn",
	"mkAdd",
	"mkConst",
	"mkCos",
	"mkDiv",
	"mkMul",
	"mkNeg",
	"mkPoly",
	"mkSc",
	"mkSin",
	"mkSub",
	"simplify",
];
function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("Transition AST Core retains evaluator simplifier and barrel", async () => {
	const files = (await readdir(AST_ROOT)).filter((name) => name.endsWith(".js"));
	for (const expected of ["evalAst.js", "index.js", "simplify.js"]) {
		assert.equal(files.includes(expected), true, expected);
	}
});

test("canonical AST simplifier has zero imports", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), []);
});

test("canonical AST simplifier has no forbidden dependency", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	const executableSource = source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\/\/.*$/gm, "");
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
		"buildProtoAst",
		"symDiff",
		"symInt",
		"KappaFcnBuilder",
		"evalAst",
		"continuity",
		"transitionDB",
		"axtranNew",
		"node:",
	]) {
		assert.equal(executableSource.includes(forbidden), false, forbidden);
	}
});

test("Transition AST barrel retains evaluation and simplification APIs", async () => {
	const ast = await import("../../../src/aim-core/transition/ast/index.js");
	for (const name of SIMPLIFICATION_API) {
		assert.equal(name in ast, true, name);
	}
});

test("evaluator and simplifier remain disjoint canonical authorities", async () => {
	const evaluator = await import("../../../src/aim-core/transition/ast/evalAst.js");
	const simplifier = await import("../../../src/aim-core/transition/ast/simplify.js");
	assert.deepEqual(Object.keys(evaluator), ["makeEvalFn"]);
	assert.equal("makeEvalFn" in simplifier, false);
	assert.equal("simplify" in evaluator, false);
});

test("Transition and Root barrels retain accepted identities and add simplification", () => {
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
	].map((path) => new URL(path, REPOSITORY_ROOT).href);
	const transitionUrl = new URL("src/aim-core/transition/index.js", REPOSITORY_ROOT).href;
	const rootUrl = new URL("src/aim-core/index.js", REPOSITORY_ROOT).href;
	const script = `
		const transition = await import(${JSON.stringify(transitionUrl)});
		const root = await import(${JSON.stringify(rootUrl)});
		const modules = await Promise.all(${JSON.stringify(moduleUrls)}.map(
			(url) => import(url)
		));
		process.stdout.write(JSON.stringify({
			transition: Object.keys(modules[7]).every(
				(name) => transition[name] === modules[7][name]
			),
			root: modules.map((api) =>
				Object.keys(api).every((name) => root[name] === api[name])
			),
		}));
	`;
	assert.deepEqual(
		JSON.parse(
			execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
				cwd: REPOSITORY_ROOT,
				encoding: "utf8",
			})
		),
		{
			transition: true,
			root: [true, true, true, true, true, true, true, true, true],
		}
	);
});

test("canonical AST simplifier never imports its legacy facade", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.equal(
		importSpecifiers(source).some((specifier) =>
			specifier.includes("domain/transition/registry/ast/simplify")
		),
		false
	);
});
