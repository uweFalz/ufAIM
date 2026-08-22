import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const QUERY_ROOT = new URL("src/aim-core/transition/query/", REPOSITORY_ROOT);
const IMPLEMENTATION_URL = new URL("createTransitionQueryService.js", QUERY_ROOT);
const QUERY_API = ["createTransitionQueryService"];
const LEGACY_CONSUMERS = [
	"src/shared/messaging/workerImportMirror.js",
	"src/shared/messaging/SharedMessagingWorker.js",
	"src/shared/runtime/AppRuntimeLocal.js",
];

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("Transition Query Core directory contains exactly implementation and barrel", async () => {
	assert.deepEqual(
		(await readdir(QUERY_ROOT)).filter((name) => name.endsWith(".js")).sort(),
		["createTransitionQueryService.js", "index.js"]
	);
});

test("canonical Transition Query service has zero imports", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), []);
});

test("canonical Transition Query service has no forbidden dependency", async () => {
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
		"localStorage",
		"indexedDB",
		"renderer",
		"GND",
		"IFC",
		"transitionLookup",
		"RegistryResolver",
		"VersionedTransitionEvaluator",
		"KappaFcnBuilder",
		"evalAst",
		"continuity",
		"axtranNew",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("Transition Query barrel exposes exactly the one-function API", async () => {
	const query = await import("../../../src/aim-core/transition/query/index.js");
	assert.deepEqual(Object.keys(query).sort(), QUERY_API);
});

test("Transition and Root barrels expose the Query service by identity", async () => {
	const query = await import("../../../src/aim-core/transition/query/index.js");
	const transition = await import("../../../src/aim-core/transition/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(transition.createTransitionQueryService, query.createTransitionQueryService);
	assert.strictEqual(root.createTransitionQueryService, query.createTransitionQueryService);
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

test("canonical Transition Query service never imports its legacy facade", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.doesNotMatch(source, /domain\/transition\/service\/TransitionQueryService/);
});

test("legacy productive consumers remain unchanged on the reference-identical facade", async () => {
	for (const path of LEGACY_CONSUMERS) {
		const source = await readFile(new URL(path, REPOSITORY_ROOT), "utf8");
		assert.match(
			source,
			/import\s*\{\s*createTransitionQueryService\s*\}\s*from\s*["'][^"']*domain\/transition\/service\/TransitionQueryService\.js["']/
		);
		assert.doesNotMatch(source, /aim-core\/transition\/query/);
	}
	const legacy = await import(
		"../../../src/domain/transition/service/TransitionQueryService.js"
	);
	const canonical = await import(
		"../../../src/aim-core/transition/query/createTransitionQueryService.js"
	);
	assert.strictEqual(
		legacy.createTransitionQueryService,
		canonical.createTransitionQueryService
	);
});
