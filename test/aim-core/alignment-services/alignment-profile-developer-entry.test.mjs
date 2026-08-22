import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import {
	isVerticalConstructiveState,
} from "../../../src/aim-core/alignment/profile/VerticalConstructiveState.js";
import {
	isCantConstructiveState,
} from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";
import {
	isChainageMapping,
} from "../../../src/aim-core/alignment/profile/ChainageMapping.js";
import {
	AIM_CORE_PROFILE_DEMO_VERSION,
	buildAlignmentProfileDemoRecord,
	runAlignmentProfileDemo,
} from "../../../tools/aim-core-profile-demo.mjs";

const executeFile = promisify(execFile);
const fixtureUrl = new URL(
	"../../fixtures/aim-core/alignment-profile-demo.json",
	import.meta.url
);
const toolUrl = new URL(
	"../../../tools/aim-core-profile-demo.mjs",
	import.meta.url
);
const repositoryUrl = new URL("../../../", import.meta.url);

async function fixture() {
	return JSON.parse(await readFile(fixtureUrl, "utf8"));
}

function expectPrefixedTypeError(operation) {
	assert.throws(operation, (error) => {
		assert.equal(error instanceof TypeError, true);
		assert.equal(error.message.startsWith("aim-core-profile-demo:"), true);
		return true;
	});
}

test("fixed fixture is exact-version synthetic data with the required IDs, positions, and no forbidden source/user fields", async () => {
	const value = await fixture();
	assert.equal(value.fixtureVersion, "aim-core-profile-demo/0.1");
	assert.equal(value.alignmentId, "demo-alignment-A");
	assert.deepEqual(value.positions, [0, 50, 100, 150, 200]);
	assert.equal(value.vertical.id, "demo-vertical-A");
	assert.equal(value.cant.id, "demo-cant-A");
	assert.equal(value.chainageMappings[0].id, "demo-chainage-K-v1");
	const serialized = JSON.stringify(value);
	for (const forbidden of [
		"source",
		"provenance",
		"filename",
		"private",
		"user",
		"regulatory",
		"crs",
		"gauge",
		"speed",
		"ui",
	]) {
		assert.equal(serialized.toLowerCase().includes(forbidden), false, forbidden);
	}
});

test("buildAlignmentProfileDemoRecord creates valid frozen vertical, cant, and chainage Core states for the explicit Alignment ID", async () => {
	const record = buildAlignmentProfileDemoRecord(await fixture());
	assert.equal(record.alignmentId, "demo-alignment-A");
	assert.equal(isVerticalConstructiveState(record.vertical), true);
	assert.equal(isCantConstructiveState(record.cant), true);
	assert.equal(record.chainageMappings.every(isChainageMapping), true);
	assert.equal(record.vertical.alignmentId, record.alignmentId);
	assert.equal(record.cant.alignmentId, record.alignmentId);
	assert.equal(record.chainageMappings[0].alignmentId, record.alignmentId);
	assert.equal(Object.isFrozen(record), true);
	assert.equal(Object.isFrozen(record.chainageMappings), true);
});

test("builder rejects wrong version, missing shapes, invalid positions, or blank Alignment ID with prefixed TypeError", async () => {
	const valid = await fixture();
	for (const invalid of [
		{ ...valid, fixtureVersion: "aim-core-profile-demo/0.2" },
		{ ...valid, vertical: null },
		{ ...valid, cant: null },
		{ ...valid, chainageMappings: null },
		{ ...valid, positions: [0, Number.NaN] },
		{ ...valid, alignmentId: " " },
	]) {
		expectPrefixedTypeError(() => buildAlignmentProfileDemoRecord(invalid));
	}
});

test("runAlignmentProfileDemo returns the exact five-position vertical/cant/chainage values above", async () => {
	const result = await runAlignmentProfileDemo();
	assert.equal(result.demoVersion, AIM_CORE_PROFILE_DEMO_VERSION);
	assert.equal(result.fixtureVersion, "aim-core-profile-demo/0.1");
	assert.equal(result.synthetic, true);
	assert.deepEqual(result.batch.positions, [0, 50, 100, 150, 200]);
	assert.deepEqual(
		result.batch.results.map((entry) => ({
			s: entry.s,
			elevation: entry.vertical.value.elevation,
			gradient: entry.vertical.value.gradient,
			crossLevel: entry.cant.value.crossLevel,
			twist: entry.cant.value.twist,
			addresses: entry.chainage.mappings[0].candidates.map(
				(candidate) => candidate.address
			),
		})),
		[
			{ s: 0, elevation: 10, gradient: 0.01, crossLevel: 0, twist: 0.001, addresses: [1000] },
			{ s: 50, elevation: 10.5, gradient: 0.01, crossLevel: 0.05, twist: 0.001, addresses: [1050] },
			{ s: 100, elevation: 11, gradient: 0.01, crossLevel: 0.1, twist: 0.001, addresses: [1100, 1200] },
			{ s: 150, elevation: 11.5, gradient: 0.01, crossLevel: 0.15, twist: 0.001, addresses: [1250] },
			{ s: 200, elevation: 12, gradient: 0.01, crossLevel: 0.2, twist: 0.001, addresses: [1300] },
		]
	);
});

test("result preserves the two ordered chainage candidates at s=100 and all scheme/version identities", async () => {
	const result = await runAlignmentProfileDemo();
	const boundary = result.batch.results[2];
	assert.equal(boundary.alignmentId, "demo-alignment-A");
	const mapping = boundary.chainage.mappings[0];
	assert.equal(mapping.schemeId, "K");
	assert.equal(mapping.schemeVersion, "v1");
	assert.deepEqual(
		mapping.candidates.map((candidate) => [
			candidate.segmentId,
			candidate.address,
		]),
		[
			["BACK", 1100],
			["AHEAD", 1200],
		]
	);
});

test("two independent demo runs are deeply equal and returned demo envelope/batch/arrays/results are frozen", async () => {
	const first = await runAlignmentProfileDemo();
	const second = await runAlignmentProfileDemo();
	assert.deepEqual(first, second);
	assert.equal(Object.isFrozen(first), true);
	assert.equal(Object.isFrozen(first.batch), true);
	assert.equal(Object.isFrozen(first.batch.positions), true);
	assert.equal(Object.isFrozen(first.batch.results), true);
	assert.equal(first.batch.results.every(Object.isFrozen), true);
});

test("direct CLI exits zero, writes one parseable JSON document matching runAlignmentProfileDemo, writes no stderr, and module import alone produces no stdout/stderr side effect", async () => {
	const toolPath = decodeURIComponent(toolUrl.pathname);
	const direct = await executeFile(process.execPath, [toolPath], {
		cwd: decodeURIComponent(repositoryUrl.pathname),
	});
	assert.equal(direct.stderr, "");
	assert.equal(direct.stdout.endsWith("\n"), true);
	assert.deepEqual(JSON.parse(direct.stdout), await runAlignmentProfileDemo());

	const imported = await executeFile(
		process.execPath,
		["--input-type=module", "--eval", `await import(${JSON.stringify(toolUrl.href)})`],
		{ cwd: decodeURIComponent(repositoryUrl.pathname) }
	);
	assert.equal(imported.stdout, "");
	assert.equal(imported.stderr, "");
});

test("dependency/scope scan confirms only fixed fixture access and authorized imports, no runtime reference from app/ or src/ to the tool/fixture, and no browser, DOM, Worker, Messaging, SPOT, storage, persistence, import, GND, LandXML, selection, UI, network, environment, argv option parsing, or private-data dependency", async () => {
	const source = await readFile(toolUrl, "utf8");
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
		(match) => match[1]
	);
	assert.deepEqual(imports, [
		"node:fs/promises",
		"node:url",
		"../src/aim-core/alignment/profile/VerticalConstructiveState.js",
		"../src/aim-core/alignment/profile/CantConstructiveState.js",
		"../src/aim-core/alignment/profile/ChainageMapping.js",
		"../src/services/alignment/AlignmentProfileApplicationService.js",
	]);
	assert.equal(
		source.includes("../test/fixtures/aim-core/alignment-profile-demo.json"),
		true
	);
	assert.equal((source.match(/readFile\(/g) ?? []).length, 1);
	for (const forbidden of [
		"document",
		"window",
		"Worker",
		"Messaging",
		"SPOT",
		"storage",
		"persistence",
		"LandXML",
		"GND",
		"selection",
		"fetch(",
		"process.env",
		"process.stdin",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
	assert.equal(source.includes("process.argv.slice"), false);
	assert.equal(source.includes("process.argv[2]"), false);

	const referenceScan = await executeFile(
		"rg",
		[
			"-l",
			"aim-core-profile-demo|alignment-profile-demo.json",
			"app",
			"src",
		],
		{
			cwd: decodeURIComponent(repositoryUrl.pathname),
		}
	).catch((error) => {
		if (error.code === 1) {
			return { stdout: "", stderr: "" };
		}
		throw error;
	});
	assert.equal(referenceScan.stdout, "");
	assert.equal(referenceScan.stderr, "");
});
