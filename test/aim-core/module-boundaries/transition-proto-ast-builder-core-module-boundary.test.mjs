import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const AST_ROOT = new URL("src/aim-core/transition/ast/", REPOSITORY_ROOT);
const IMPLEMENTATION_URL = new URL("buildProtoAst.js", AST_ROOT);
const BUILDER_API = ["buildProtoAst"];
const EXPECTED_SIMPLIFY_IMPORTS = [
	"simplify",
	"mkConst",
	"mkPoly",
	"mkAdd",
	"mkMul",
	"mkSc",
	"mkNeg",
];

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("Transition AST Core directory contains builder evaluation simplification differentiation integration and barrel", async () => {
	assert.deepEqual(
		(await readdir(AST_ROOT)).filter((name) => name.endsWith(".js")).sort(),
		[
			"buildProtoAst.js",
			"evalAst.js",
			"index.js",
			"simplify.js",
			"symDiff.js",
			"symInt.js",
		]
	);
});

test("canonical buildProtoAst imports exactly seven symbols from canonical simplify", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), ["./simplify.js"]);
	const match = source.match(
		/import\s*\{([^}]+)\}\s*from\s*"\.\/simplify\.js";/
	);
	assert.ok(match);
	assert.deepEqual(
		match[1].split(",").map((name) => name.trim()),
		EXPECTED_SIMPLIFY_IMPORTS
	);
});

test("canonical buildProtoAst has no forbidden dependency", async () => {
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
		"VersionedTransitionEvaluator",
		"KappaFcnBuilder",
		"compose/",
		"continuity",
		"query",
		"transitionDB",
		"axtranNew",
		"node:",
	]) {
		assert.equal(executableSource.includes(forbidden), false, forbidden);
	}
});

test("AST barrel exposes the exact accepted API plus buildProtoAst", async () => {
	const ast = await import("../../../src/aim-core/transition/ast/index.js");
	assert.deepEqual(Object.keys(ast).sort(), [
		"buildProtoAst",
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
		"symDiff",
		"symInt",
	]);
});

test("Transition and Root barrels expose buildProtoAst by identity", async () => {
	const canonical = await import(
		"../../../src/aim-core/transition/ast/buildProtoAst.js"
	);
	const transition = await import("../../../src/aim-core/transition/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.deepEqual(Object.keys(canonical), BUILDER_API);
	assert.strictEqual(transition.buildProtoAst, canonical.buildProtoAst);
	assert.strictEqual(root.buildProtoAst, canonical.buildProtoAst);
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
		"src/aim-core/transition/query/index.js",
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
		[true, true, true, true, true, true, true, true, true]
	);
});

test("canonical buildProtoAst never imports its legacy facade", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.equal(
		importSpecifiers(source).some((specifier) =>
			specifier.includes("domain/transition/registry/ast/buildProtoAst")
		),
		false
	);
});
