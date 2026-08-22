import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const AXTRAN_ROOT = new URL(
	"src/aim-core/transition/axtran/",
	REPOSITORY_ROOT
);
const IMPLEMENTATION_URL = new URL(
	"buildFutureAxtranInputContract.js",
	AXTRAN_ROOT
);
const AXTRAN_API = ["buildFutureAxtranInputContract"];

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("AXTRAN contract directory contains exactly its implementation and barrel", async () => {
	assert.deepEqual(
		(await readdir(AXTRAN_ROOT)).filter((name) => name.endsWith(".js")).sort(),
		["buildFutureAxtranInputContract.js", "index.js"]
	);
});

test("canonical AXTRAN contract imports only canonical Transition grammar", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), [
		"../grammar/TransitionQuantityRoles.js",
	]);
});

test("canonical AXTRAN contract has no forbidden dependency", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	for (const forbidden of [
		"app/",
		"src/services/",
		"src/import/",
		"src/shared/",
		"src/model/spot/",
		"domain/transition/versioned",
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
		"evaluator",
		"registry",
		"transitionDB",
		"solver implementation",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
	assert.equal(
		importSpecifiers(source).some((specifier) => specifier.includes("axtranNew")),
		false
	);
});

test("AXTRAN barrel exposes exactly the one-function API", async () => {
	const axtran = await import("../../../src/aim-core/transition/axtran/index.js");
	assert.deepEqual(Object.keys(axtran).sort(), AXTRAN_API);
});

test("Transition and Root barrels expose the canonical function by identity", async () => {
	const axtran = await import("../../../src/aim-core/transition/axtran/index.js");
	const transition = await import("../../../src/aim-core/transition/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(
		transition.buildFutureAxtranInputContract,
		axtran.buildFutureAxtranInputContract
	);
	assert.strictEqual(
		root.buildFutureAxtranInputContract,
		axtran.buildFutureAxtranInputContract
	);
});

test("fresh Root-Core import retains all accepted module identities", () => {
	const urls = {
		root: new URL("src/aim-core/index.js", REPOSITORY_ROOT).href,
		transition: new URL(
			"src/aim-core/transition/index.js",
			REPOSITORY_ROOT
		).href,
		profile: new URL(
			"src/aim-core/alignment/profile/index.js",
			REPOSITORY_ROOT
		).href,
		topology: new URL(
			"src/aim-core/alignment/topology/index.js",
			REPOSITORY_ROOT
		).href,
		authoring: new URL(
			"src/aim-core/alignment/authoring/index.js",
			REPOSITORY_ROOT
		).href,
		grammar: new URL(
			"src/aim-core/transition/grammar/index.js",
			REPOSITORY_ROOT
		).href,
		axtran: new URL(
			"src/aim-core/transition/axtran/index.js",
			REPOSITORY_ROOT
		).href,
	};
	const script = `
		const urls = ${JSON.stringify(urls)};
		const root = await import(urls.root);
		const transition = await import(urls.transition);
		const modules = await Promise.all([
			import(urls.profile),
			import(urls.topology),
			import(urls.authoring),
			import(urls.grammar),
			import(urls.axtran),
		]);
		process.stdout.write(JSON.stringify({
			root: modules.map((api) =>
				Object.keys(api).every((name) => root[name] === api[name])
			),
			transition: modules.slice(3).map((api) =>
				Object.keys(api).every((name) => transition[name] === api[name])
			),
		}));
	`;
	const result = JSON.parse(
		execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
			cwd: REPOSITORY_ROOT,
			encoding: "utf8",
		})
	);
	assert.deepEqual(result.root, [true, true, true, true, true]);
	assert.deepEqual(result.transition, [true, true]);
});

test("canonical AXTRAN contract never imports its legacy facade", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.doesNotMatch(
		source,
		/src\/domain\/transition\/versioned|domain\/transition\/versioned/
	);
});
