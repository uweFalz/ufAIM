import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const CANONICAL_URL = new URL(
	"src/aim-core/alignment/authoring/alignmentEditOps.js",
	REPOSITORY_ROOT
);
const LEGACY_URL = new URL(
	"src/domain/alignment/editor/alignmentEditOps.js",
	REPOSITORY_ROOT
);
const EDIT_OPERATIONS_API = [
	"addArcElement",
	"addStraightElement",
	"addTransitionElement",
	"clearElements",
	"findElementById",
	"insertArcElement",
	"insertStraightElement",
	"insertTransitionElement",
	"moveElementById",
	"readAlignmentElements",
	"removeElementAtIndex",
	"removeElementById",
	"replaceElementById",
	"updateArcById",
	"updateStraightLengthById",
	"updateTransitionById",
].sort();

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("canonical edit operations module has zero imports", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), []);
});

test("canonical edit operations have no forbidden runtime dependency", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
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
		"buildSparse",
		"Kappa",
		"AXTRAN",
		"Cant",
		"Profile",
		"Topology",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("canonical edit operations expose exactly the existing sixteen functions", async () => {
	const canonical = await import(
		"../../../src/aim-core/alignment/authoring/alignmentEditOps.js"
	);
	assert.deepEqual(Object.keys(canonical).sort(), EDIT_OPERATIONS_API);
	for (const name of EDIT_OPERATIONS_API) {
		assert.equal(typeof canonical[name], "function", name);
	}
});

test("Authoring and Root barrels retain every edit operation by identity", async () => {
	const canonical = await import(
		"../../../src/aim-core/alignment/authoring/alignmentEditOps.js"
	);
	const authoring = await import(
		"../../../src/aim-core/alignment/authoring/index.js"
	);
	const root = await import("../../../src/aim-core/index.js");
	for (const name of EDIT_OPERATIONS_API) {
		assert.strictEqual(authoring[name], canonical[name], name);
		assert.strictEqual(root[name], canonical[name], name);
	}
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

test("legacy edit operations path is a logic-free canonical facade", async () => {
	assert.equal(
		await readFile(LEGACY_URL, "utf8"),
		'export * from "../../../aim-core/alignment/authoring/alignmentEditOps.js";\n'
	);
});

test("canonical edit operations never import the legacy facade", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.doesNotMatch(source, /src\/domain\/alignment|domain\/alignment/);
});

test("productive consumers remain unchanged on the reference-identical legacy facade", async () => {
	const service = await readFile(
		new URL(
			"src/services/alignment/AlignmentApplicationService.js",
			REPOSITORY_ROOT
		),
		"utf8"
	);
	const controller = await readFile(
		new URL("app/controllers/curvatureBandController.js", REPOSITORY_ROOT),
		"utf8"
	);
	for (const source of [service, controller]) {
		assert.match(
			source,
			/@src\/domain\/alignment\/editor\/alignmentEditOps\.js/
		);
		assert.doesNotMatch(source, /aim-core\/alignment\/authoring\/alignmentEditOps/);
	}
	const legacy = await import(
		"../../../src/domain/alignment/editor/alignmentEditOps.js"
	);
	const canonical = await import(
		"../../../src/aim-core/alignment/authoring/alignmentEditOps.js"
	);
	for (const name of EDIT_OPERATIONS_API) {
		assert.strictEqual(legacy[name], canonical[name], name);
	}
});

test("edit operations Core source has no buildSparse geometry or other domain import", async () => {
	const source = await readFile(CANONICAL_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), []);
	assert.doesNotMatch(
		source,
		/from\s+["'][^"']*(?:buildSparse|geometry|cant|profile|topology|transition)[^"']*["']/i
	);
});
