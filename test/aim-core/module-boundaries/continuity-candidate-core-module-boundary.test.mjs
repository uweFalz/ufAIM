import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const CONTINUITY_ROOT = new URL(
	"src/aim-core/transition/continuity/",
	REPOSITORY_ROOT
);
const IMPLEMENTATION_URL = new URL(
	"validateContinuityCandidate.js",
	CONTINUITY_ROOT
);
const CONTINUITY_API = ["validateContinuityCandidate"];

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("Continuity Core retains candidate implementation and barrel", async () => {
	const files = (await readdir(CONTINUITY_ROOT)).filter((name) =>
		name.endsWith(".js")
	);
	for (const expected of ["index.js", "validateContinuityCandidate.js"]) {
		assert.equal(files.includes(expected), true, expected);
	}
});

test("canonical Continuity candidate validator has zero imports", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), []);
});

test("canonical Continuity candidate validator has no forbidden dependency", async () => {
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
		"RegistryResolver",
		"upgradeLegacy",
		"createVersionedTransitionEvaluator",
		"Kappa",
		"createVersionedContinuityModel",
		"createTransitionContinuitySolver",
		"transitionDB",
		"axtranNew",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("Continuity barrel retains the candidate validator API", async () => {
	const continuity = await import(
		"../../../src/aim-core/transition/continuity/index.js"
	);
	for (const name of CONTINUITY_API) {
		assert.equal(name in continuity, true, name);
	}
});

test("Transition and Root barrels expose the validator by identity", async () => {
	const continuity = await import(
		"../../../src/aim-core/transition/continuity/index.js"
	);
	const transition = await import("../../../src/aim-core/transition/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(
		transition.validateContinuityCandidate,
		continuity.validateContinuityCandidate
	);
	assert.strictEqual(
		root.validateContinuityCandidate,
		continuity.validateContinuityCandidate
	);
});

test("legacy Continuity index shares validator solver and model identities", async () => {
	const continuity = await import(
		"../../../src/aim-core/transition/continuity/index.js"
	);
	const legacy = await import(
		"../../../src/domain/transition/versioned/continuity/index.js"
	);
	assert.strictEqual(
		legacy.validateContinuityCandidate,
		continuity.validateContinuityCandidate
	);
	assert.strictEqual(
		legacy.createTransitionContinuitySolver,
		continuity.createTransitionContinuitySolver
	);
	assert.strictEqual(
		legacy.createVersionedContinuityModel,
		continuity.createVersionedContinuityModel
	);
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
		[true, true, true, true, true, true, true]
	);
});

test("canonical Continuity candidate validator never imports its legacy facade", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.doesNotMatch(
		source,
		/src\/domain\/transition\/versioned|domain\/transition\/versioned/
	);
});
