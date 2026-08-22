import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const AUTHORING_ROOT = new URL(
	"src/aim-core/alignment/authoring/",
	REPOSITORY_ROOT
);
const IMPLEMENTATIONS = [
	"AlignmentAuthoringContract.js",
	"AlignmentRepositoryPort.js",
];
const AUTHORING_API = [
	"ALIGNMENT_AUTHORING_CONTRACT_VERSION",
	"ALIGNMENT_AUTHORING_OPERATIONS",
	"ALIGNMENT_AUTHORING_REJECTION_CODES",
	"ALIGNMENT_AUTHORING_RESULT_VERSION",
	"ALIGNMENT_REPOSITORY_PORT_VERSION",
	"assertAlignmentRepositoryPort",
	"validateAlignmentAuthoringRequest",
].sort();

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("standalone authoring module retains its two contract implementations and barrel", async () => {
	const files = (await readdir(AUTHORING_ROOT))
		.filter((name) => name.endsWith(".js"))
		.sort();
	for (const expected of [...IMPLEMENTATIONS, "index.js"]) {
		assert.equal(files.includes(expected), true, expected);
	}
});

test("canonical authoring implementations have zero imports and no forbidden dependencies", async () => {
	for (const name of IMPLEMENTATIONS) {
		const source = await readFile(new URL(name, AUTHORING_ROOT), "utf8");
		assert.deepEqual(importSpecifiers(source), [], name);
		for (const forbidden of [
			"app/",
			"src/services/",
			"src/import/",
			"src/shared/",
			"src/model/spot/",
			"domain/alignment/authoring",
			"domain/alignment/ports",
			"window",
			"document",
			"Worker",
			"Messaging",
			"SPOT",
			"selection",
			"focus",
			"storage",
			"persistence",
			"GND",
			"IFC",
			"renderer",
			"AXTRAN",
			"transitionDB",
			"profile",
			"topology",
			"node:",
		]) {
			assert.equal(source.includes(forbidden), false, `${name}: ${forbidden}`);
		}
	}
});

test("canonical authoring never imports a legacy facade", async () => {
	for (const name of IMPLEMENTATIONS) {
		const source = await readFile(new URL(name, AUTHORING_ROOT), "utf8");
		assert.doesNotMatch(
			source,
			/src\/domain\/alignment|domain\/alignment/,
			name
		);
	}
});

test("authoring barrel retains the expected contract API", async () => {
	const authoring = await import(
		"../../../src/aim-core/alignment/authoring/index.js"
	);
	for (const name of AUTHORING_API) {
		assert.equal(name in authoring, true, name);
	}
});

test("fresh Root-Core import retains Profile and Topology identities and adds Authoring", () => {
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
	const script = `
		import * as root from ${JSON.stringify(rootUrl)};
		import * as profile from ${JSON.stringify(profileUrl)};
		import * as topology from ${JSON.stringify(topologyUrl)};
		import * as authoring from ${JSON.stringify(authoringUrl)};
		process.stdout.write(JSON.stringify({
			root: Object.keys(root).sort(),
			profile: Object.keys(profile).sort(),
			topology: Object.keys(topology).sort(),
			authoring: Object.keys(authoring).sort(),
			profileIdentity: Object.keys(profile).every((name) => root[name] === profile[name]),
			topologyIdentity: Object.keys(topology).every((name) => root[name] === topology[name]),
			authoringIdentity: Object.keys(authoring).every((name) => root[name] === authoring[name]),
		}));
	`;
	const result = JSON.parse(
		execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
			cwd: REPOSITORY_ROOT,
			encoding: "utf8",
		})
	);
	assert.equal(result.profileIdentity, true);
	assert.equal(result.topologyIdentity, true);
	assert.equal(result.authoringIdentity, true);
	for (const name of AUTHORING_API) {
		assert.equal(result.authoring.includes(name), true, name);
	}
	for (const name of [
		...result.profile,
		...result.topology,
		...result.authoring,
	]) {
		assert.equal(result.root.includes(name), true, name);
	}
});

test("productive service and adapter import canonical authoring paths only", async () => {
	const service = await readFile(
		new URL(
			"src/services/alignment/AlignmentApplicationService.js",
			REPOSITORY_ROOT
		),
		"utf8"
	);
	const adapter = await readFile(
		new URL(
			"src/services/alignment/SpotAlignmentRepositoryAdapter.js",
			REPOSITORY_ROOT
		),
		"utf8"
	);
	for (const source of [service, adapter]) {
		assert.doesNotMatch(
			source,
			/@src\/domain\/alignment\/authoring|@src\/domain\/alignment\/ports\/AlignmentRepositoryPort/
		);
	}
	assert.match(
		service,
		/@src\/aim-core\/alignment\/authoring\/AlignmentAuthoringContract\.js/
	);
	assert.match(
		service,
		/@src\/aim-core\/alignment\/authoring\/AlignmentRepositoryPort\.js/
	);
	assert.match(
		adapter,
		/@src\/aim-core\/alignment\/authoring\/AlignmentRepositoryPort\.js/
	);
});
