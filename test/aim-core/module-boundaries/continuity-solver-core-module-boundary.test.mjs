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
	"solveTransitionContinuity.js",
	CONTINUITY_ROOT
);
const LEGACY_URL = new URL(
	"src/domain/transition/versioned/continuity/solveTransitionContinuity.js",
	REPOSITORY_ROOT
);
const CONTINUITY_API = [
	"createVersionedContinuityModel",
	"createTransitionContinuitySolver",
	"validateContinuityCandidate",
];

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("Continuity Core directory contains candidate validator solver model and barrel", async () => {
	assert.deepEqual(
		(await readdir(CONTINUITY_ROOT))
			.filter((name) => name.endsWith(".js"))
			.sort(),
		[
			"createVersionedContinuityModel.js",
			"index.js",
			"solveTransitionContinuity.js",
			"validateContinuityCandidate.js",
		]
	);
});

test("canonical solver imports exactly one Grammar symbol", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), [
		"../grammar/TransitionQuantityRoles.js",
	]);
	const match = source.match(
		/import\s*\{\s*TRANSITION_SCHEMA_VERSION\s*\}\s*from\s*"\.\.\/grammar\/TransitionQuantityRoles\.js";/
	);
	assert.ok(match);
});

test("canonical solver has no forbidden dependency", async () => {
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
		"createVersionedTransitionEvaluator",
		"Kappa",
		"createVersionedContinuityModel",
		"validateContinuityCandidate",
		"transitionDB",
		"axtranNew",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("Continuity barrel exposes candidate validator solver and model", async () => {
	const continuity = await import(
		"../../../src/aim-core/transition/continuity/index.js"
	);
	assert.deepEqual(Object.keys(continuity).sort(), CONTINUITY_API.sort());
});

test("Transition Root and legacy index expose solver and model identities", async () => {
	const canonical = await import(
		"../../../src/aim-core/transition/continuity/solveTransitionContinuity.js"
	);
	const continuity = await import(
		"../../../src/aim-core/transition/continuity/index.js"
	);
	const transition = await import("../../../src/aim-core/transition/index.js");
	const root = await import("../../../src/aim-core/index.js");
	const legacyIndex = await import(
		"../../../src/domain/transition/versioned/continuity/index.js"
	);
	assert.strictEqual(
		continuity.createTransitionContinuitySolver,
		canonical.createTransitionContinuitySolver
	);
	assert.strictEqual(
		transition.createTransitionContinuitySolver,
		canonical.createTransitionContinuitySolver
	);
	assert.strictEqual(
		root.createTransitionContinuitySolver,
		canonical.createTransitionContinuitySolver
	);
	assert.strictEqual(
		legacyIndex.createTransitionContinuitySolver,
		canonical.createTransitionContinuitySolver
	);
	assert.strictEqual(
		legacyIndex.createVersionedContinuityModel,
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

test("legacy solver is a logic-free canonical re-export", async () => {
	const source = await readFile(LEGACY_URL, "utf8");
	assert.equal(
		source,
		'export { createTransitionContinuitySolver } from "../../../../aim-core/transition/continuity/solveTransitionContinuity.js";\n'
	);
});

test("canonical solver never imports legacy model facade or candidate validator", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.equal(
		importSpecifiers(source).some((specifier) =>
			specifier.includes("domain/transition/versioned")
		),
		false
	);
	assert.doesNotMatch(source, /validateContinuityCandidate/);
});
