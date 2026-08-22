import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const CORE_ROOT = new URL("../../../src/aim-core/", import.meta.url);
const PROFILE_ROOT = new URL("alignment/profile/", CORE_ROOT);
const REPOSITORY_ROOT = new URL("../../../", import.meta.url);

const EXPECTED_API = [
	"ALIGNMENT_PROFILE_EVALUATION_RESULT_VERSION",
	"ALIGNMENT_PROFILE_STATE_READER_PORT_VERSION",
	"AlignmentProfileEvaluationService",
	"AlignmentProfileEvaluationServiceError",
	"CANT_CONSTRUCTIVE_STATE_VERSION",
	"CHAINAGE_MAPPING_VERSION",
	"CantConstructiveStateError",
	"ChainageMappingError",
	"VERTICAL_CONSTRUCTIVE_STATE_VERSION",
	"VerticalConstructiveStateError",
	"appendCantElement",
	"appendChainageSegment",
	"appendVerticalElement",
	"assertAlignmentProfileStateReaderPort",
	"assertCantConstructiveState",
	"assertChainageMapping",
	"assertVerticalConstructiveState",
	"createCantConstructiveState",
	"createChainageMapping",
	"createVerticalConstructiveState",
	"evaluateCantAt",
	"evaluateVerticalAt",
	"isCantConstructiveState",
	"isChainageMapping",
	"isVerticalConstructiveState",
	"mapChainageToIntrinsic",
	"mapIntrinsicToChainage",
].sort();

async function javascriptFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
		if (entry.isDirectory()) files.push(...await javascriptFiles(url));
		else if (entry.name.endsWith(".js")) files.push(url);
	}
	return files;
}

function importSpecifiers(source) {
	return [...source.matchAll(/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g)]
		.map((match) => match[1]);
}

test("standalone Profile Core has only internal relative static dependencies", async () => {
	const files = await javascriptFiles(PROFILE_ROOT);
	assert.equal(files.length, 6);
	for (const file of files) {
		const source = await readFile(file, "utf8");
		for (const specifier of importSpecifiers(source)) {
			assert.match(specifier, /^\.\.?\//, `${file.pathname}: ${specifier}`);
			const resolved = new URL(specifier, file);
			assert.ok(resolved.href.startsWith(PROFILE_ROOT.href), `${file.pathname}: ${specifier}`);
		}
		assert.doesNotMatch(
			source,
			/(?:app\/|src\/(?:services|import|shared|model\/spot)\/|\b(?:window|document|Worker|SharedWorker|localStorage|sessionStorage|indexedDB|MapLibre|THREE|process|node:)\b)/,
			file.pathname
		);
	}
});

test("canonical Core never imports legacy domain facades", async () => {
	for (const file of await javascriptFiles(CORE_ROOT)) {
		const source = await readFile(file, "utf8");
		assert.doesNotMatch(source, /domain\/alignment/);
	}
});

test("Application Service and adapter import the canonical Profile Core", async () => {
	for (const relativePath of [
		"src/services/alignment/AlignmentProfileApplicationService.js",
		"src/services/alignment/StaticAlignmentProfileStateReaderAdapter.js",
	]) {
		const source = await readFile(new URL(relativePath, REPOSITORY_ROOT), "utf8");
		assert.match(source, /aim-core\/alignment\/profile/);
		assert.doesNotMatch(source, /domain\/alignment\/(?:vertical|cant|chainage|ports\/AlignmentProfileStateReaderPort|services\/AlignmentProfileEvaluationService)/);
	}
});

test("developer demo constructs Profile state through canonical Core exports", async () => {
	const source = await readFile(new URL("tools/aim-core-profile-demo.mjs", REPOSITORY_ROOT), "utf8");
	assert.match(source, /src\/aim-core\/alignment\/profile\/VerticalConstructiveState\.js/);
	assert.match(source, /src\/aim-core\/alignment\/profile\/CantConstructiveState\.js/);
	assert.match(source, /src\/aim-core\/alignment\/profile\/ChainageMapping\.js/);
	assert.doesNotMatch(source, /src\/domain\/alignment\/(?:vertical|cant|chainage)/);
});

test("Core barrel retains the complete reference-identical Profile API in a fresh Node ESM process", () => {
	const rootBarrelUrl = new URL("src/aim-core/index.js", REPOSITORY_ROOT).href;
	const profileBarrelUrl = new URL("src/aim-core/alignment/profile/index.js", REPOSITORY_ROOT).href;
	const output = execFileSync(
		process.execPath,
		["--input-type=module", "--eval", `
			import * as root from ${JSON.stringify(rootBarrelUrl)};
			import * as profile from ${JSON.stringify(profileBarrelUrl)};
			process.stdout.write(JSON.stringify({
				rootKeys: Object.keys(root).sort(),
				profileKeys: Object.keys(profile).sort(),
				profileIdentity: Object.keys(profile).every((name) => root[name] === profile[name]),
			}));
		`],
		{ encoding: "utf8", cwd: new URL(REPOSITORY_ROOT) }
	);
	const result = JSON.parse(output);
	assert.deepEqual(result.profileKeys, EXPECTED_API);
	assert.equal(result.profileIdentity, true);
	assert.deepEqual(
		result.rootKeys.filter((name) => EXPECTED_API.includes(name)),
		EXPECTED_API
	);
});
