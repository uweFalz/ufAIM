import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const TRANSITION_ROOT = new URL("src/aim-core/transition/", REPOSITORY_ROOT);
const GRAMMAR_ROOT = new URL("grammar/", TRANSITION_ROOT);
const IMPLEMENTATION_URL = new URL("TransitionQuantityRoles.js", GRAMMAR_ROOT);
const GRAMMAR_API = [
	"SUPPORTED_EVALUATION_QUANTITIES",
	"TRANSITION_COMPONENT_ORDER",
	"TRANSITION_SCHEMA_VERSION",
	"TRANSITION_UPGRADER_VERSION",
	"TransitionComponentRole",
	"TransitionQuantityRole",
	"TransitionRepresentationLevel",
	"ZERO_LENGTH_POLICY",
	"isSupportedEvaluationQuantity",
].sort();

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("grammar contains exactly its implementation and barrel while transition barrel remains separate", async () => {
	assert.deepEqual(
		(await readdir(GRAMMAR_ROOT)).filter((name) => name.endsWith(".js")).sort(),
		["TransitionQuantityRoles.js", "index.js"]
	);
	assert.deepEqual(
		(await readdir(TRANSITION_ROOT)).filter((name) => name.endsWith(".js")).sort(),
		["index.js"]
	);
});

test("canonical transition grammar implementation has zero imports", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), []);
});

test("canonical transition grammar has no forbidden dependencies", async () => {
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
		"AXTRAN",
		"solver",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("grammar API remains exact and reference-identical through transition and root barrels", async () => {
	const grammar = await import(
		"../../../src/aim-core/transition/grammar/index.js"
	);
	const transition = await import("../../../src/aim-core/transition/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.deepEqual(Object.keys(grammar).sort(), GRAMMAR_API);
	for (const name of GRAMMAR_API) {
		assert.strictEqual(transition[name], grammar[name], name);
		assert.strictEqual(root[name], grammar[name], name);
	}
});

test("fresh Root-Core import retains accepted APIs and adds grammar without replacement", () => {
	const rootUrl = new URL("src/aim-core/index.js", REPOSITORY_ROOT).href;
	const profileUrl = new URL(
		"src/aim-core/alignment/profile/index.js",
		REPOSITORY_ROOT
	).href;
	const topologyUrl = new URL(
		"src/aim-core/alignment/topology/index.js",
		REPOSITORY_ROOT
	).href;
	const authoringUrl = new URL(
		"src/aim-core/alignment/authoring/index.js",
		REPOSITORY_ROOT
	).href;
	const grammarUrl = new URL(
		"src/aim-core/transition/grammar/index.js",
		REPOSITORY_ROOT
	).href;
	const script = `
		import * as root from ${JSON.stringify(rootUrl)};
		import * as profile from ${JSON.stringify(profileUrl)};
		import * as topology from ${JSON.stringify(topologyUrl)};
		import * as authoring from ${JSON.stringify(authoringUrl)};
		import * as grammar from ${JSON.stringify(grammarUrl)};
		const identities = [profile, topology, authoring, grammar]
			.map((api) => Object.keys(api).every((name) => root[name] === api[name]));
		process.stdout.write(JSON.stringify({
			root: Object.keys(root).sort(),
			profile: Object.keys(profile).sort(),
			topology: Object.keys(topology).sort(),
			authoring: Object.keys(authoring).sort(),
			grammar: Object.keys(grammar).sort(),
			identities,
		}));
	`;
	const result = JSON.parse(
		execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
			cwd: REPOSITORY_ROOT,
			encoding: "utf8",
		})
	);
	assert.deepEqual(result.identities, [true, true, true, true]);
	assert.deepEqual(result.grammar, GRAMMAR_API);
	for (const name of [
		...result.profile,
		...result.topology,
		...result.authoring,
		...result.grammar,
	]) {
		assert.equal(result.root.includes(name), true, name);
	}
});

test("canonical transition grammar never imports the legacy facade", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.doesNotMatch(
		source,
		/src\/domain\/transition\/versioned|domain\/transition\/versioned/
	);
});
