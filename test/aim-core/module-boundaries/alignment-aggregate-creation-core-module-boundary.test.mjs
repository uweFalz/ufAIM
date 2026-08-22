import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const AUTHORING_ROOT = new URL(
	"src/aim-core/alignment/authoring/",
	REPOSITORY_ROOT
);
const IMPLEMENTATION_URL = new URL(
	"createEmptyAlignmentData.js",
	AUTHORING_ROOT
);
const LEGACY_URL = new URL(
	"src/domain/alignment/editor/createEmptyAlignmentData.js",
	REPOSITORY_ROOT
);

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("Authoring Core directory contains contracts aggregate creation and barrel", async () => {
	const files = (await readdir(AUTHORING_ROOT))
		.filter((name) => name.endsWith(".js"))
		.sort();
	for (const expected of [
		"AlignmentAuthoringContract.js",
		"AlignmentRepositoryPort.js",
		"createEmptyAlignmentData.js",
		"index.js",
	]) {
		assert.equal(files.includes(expected), true, expected);
	}
});

test("canonical aggregate creation has zero imports", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), []);
});

test("canonical aggregate creation has no forbidden dependency or coupling", async () => {
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
		"geometry",
		"Kappa",
		"transition",
		"editOps",
		"buildSparse",
		"Horizontal",
		"Cant",
		"Profile",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("canonical module exports exactly one aggregate creation function", async () => {
	const canonical = await import(
		"../../../src/aim-core/alignment/authoring/createEmptyAlignmentData.js"
	);
	assert.deepEqual(Object.keys(canonical), ["createEmptyAlignmentData"]);
});

test("Authoring and Root barrels expose aggregate creation by identity", async () => {
	const canonical = await import(
		"../../../src/aim-core/alignment/authoring/createEmptyAlignmentData.js"
	);
	const authoring = await import(
		"../../../src/aim-core/alignment/authoring/index.js"
	);
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(
		authoring.createEmptyAlignmentData,
		canonical.createEmptyAlignmentData
	);
	assert.strictEqual(
		root.createEmptyAlignmentData,
		canonical.createEmptyAlignmentData
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

test("legacy aggregate path is a logic-free canonical re-export", async () => {
	const source = await readFile(LEGACY_URL, "utf8");
	assert.equal(
		source,
		'export { createEmptyAlignmentData } from "../../../aim-core/alignment/authoring/createEmptyAlignmentData.js";\n'
	);
});

test("AlignmentApplicationService remains unchanged on the reference-identical legacy facade", async () => {
	const service = await readFile(
		new URL(
			"src/services/alignment/AlignmentApplicationService.js",
			REPOSITORY_ROOT
		),
		"utf8"
	);
	assert.match(
		service,
		/import\s*\{\s*createEmptyAlignmentData\s*\}\s*from\s*"@src\/domain\/alignment\/editor\/createEmptyAlignmentData\.js";/
	);
	assert.doesNotMatch(
		service,
		/aim-core\/alignment\/authoring\/createEmptyAlignmentData/
	);
	const legacy = await import(
		"../../../src/domain/alignment/editor/createEmptyAlignmentData.js"
	);
	const canonical = await import(
		"../../../src/aim-core/alignment/authoring/createEmptyAlignmentData.js"
	);
	assert.strictEqual(
		legacy.createEmptyAlignmentData,
		canonical.createEmptyAlignmentData
	);
});

test("canonical aggregate creation never imports its legacy facade", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.doesNotMatch(source, /src\/domain\/alignment|domain\/alignment/);
});
