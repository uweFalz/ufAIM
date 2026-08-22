import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const CANONICAL = new URL("src/aim-core/geometry/pose2.js", ROOT);
const LEGACY = new URL("src/lib/geom/frame/pose2.js", ROOT);
const API = [
	"heading",
	"isPose2",
	"localFromWorld",
	"normal",
	"point",
	"poseFromHeading",
	"poseFromTangent",
	"poseFromTwoPoints",
	"posePoint",
	"poseTangent",
	"poseX",
	"poseY",
	"sanitizePose",
	"tangent",
	"worldFromLocal",
].sort();

function imports(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("canonical pose2 imports exactly three canonical vec2 symbols", async () => {
	const source = await readFile(CANONICAL, "utf8");
	assert.deepEqual(imports(source), ["./vec2.js"]);
	assert.match(
		source,
		/import\s*\{\s*normalize,\s*rot90,\s*dot\s*\}\s*from\s*"\.\/vec2\.js"/
	);
});

test("canonical pose2 has no forbidden dependency", async () => {
	const source = await readFile(CANONICAL, "utf8");
	for (const forbidden of [
		"src/domain/",
		"src/lib/",
		"app/",
		"src/services/",
		"src/import/",
		"src/shared/",
		"src/model/spot/",
		"window",
		"document",
		"Worker",
		"Messaging",
		"storage",
		"persistence",
		"MapLibre",
		"THREE",
		"AlignmentFactory",
		"Transition",
		"Profile",
		"Topology",
		"CRS",
		"Cant",
		"GND",
		"IFC",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("direct pose2 API is exact and retained by Geometry and Root", async () => {
	const canonical = await import("../../../src/aim-core/geometry/pose2.js");
	const geometry = await import("../../../src/aim-core/geometry/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.deepEqual(Object.keys(canonical).sort(), API);
	for (const name of API) {
		assert.strictEqual(geometry[name], canonical[name], name);
		assert.strictEqual(root[name], canonical[name], name);
	}
});

test("legacy pose2 is an exact logic-free canonical facade", async () => {
	assert.equal(
		await readFile(LEGACY, "utf8"),
		'export * from "../../../aim-core/geometry/pose2.js";\n'
	);
	assert.doesNotMatch(
		await readFile(CANONICAL, "utf8"),
		/src\/lib\/geom|lib\/geom/
	);
});

test("fresh Root retains every Geometry export by identity", () => {
	const geometryUrl = new URL(
		"src/aim-core/geometry/index.js",
		ROOT
	).href;
	const rootUrl = new URL("src/aim-core/index.js", ROOT).href;
	const output = execFileSync(
		process.execPath,
		[
			"--input-type=module",
			"--eval",
			`
				const geometry = await import(${JSON.stringify(geometryUrl)});
				const root = await import(${JSON.stringify(rootUrl)});
				process.stdout.write(String(
					Object.keys(geometry).every((name) => root[name] === geometry[name])
				));
			`,
		],
		{ cwd: ROOT, encoding: "utf8" }
	);
	assert.equal(output, "true");
});

test("Sparse validator stays on the legacy facade with canonical identities", async () => {
	const source = await readFile(
		new URL(
			"src/model/spot/validation/validateSparseAlignment.js",
			ROOT
		),
		"utf8"
	);
	assert.match(
		source,
		/import\s*\{\s*isPose2,\s*posePoint\s*\}\s*from\s*"\.\.\/\.\.\/\.\.\/lib\/geom\/frame\/pose2\.js"/
	);
	assert.doesNotMatch(source, /aim-core\/geometry\/pose2/);
	const legacy = await import("../../../src/lib/geom/frame/pose2.js");
	const canonical = await import("../../../src/aim-core/geometry/pose2.js");
	assert.strictEqual(legacy.isPose2, canonical.isPose2);
	assert.strictEqual(legacy.posePoint, canonical.posePoint);
});
