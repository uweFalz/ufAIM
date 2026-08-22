import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const CANONICAL = new URL(
	"src/aim-core/geometry/ZeroLengthFixed.js",
	ROOT
);
const LEGACY = new URL(
	"src/domain/alignment/elements/ZeroLengthFixed.js",
	ROOT
);

function imports(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("canonical ZeroLengthFixed has exactly one canonical dependency", async () => {
	const source = await readFile(CANONICAL, "utf8");
	assert.deepEqual(imports(source), ["./FixedElement.js"]);
	assert.match(
		source,
		/import\s*\{\s*FixedElement\s*\}\s*from\s*"\.\/FixedElement\.js"/
	);
});

test("canonical ZeroLengthFixed has no forbidden dependency", async () => {
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
		"TransitionElement",
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

test("direct canonical API is exactly one class", async () => {
	const canonical = await import(
		"../../../src/aim-core/geometry/ZeroLengthFixed.js"
	);
	assert.deepEqual(Object.keys(canonical), ["ZeroLengthFixed"]);
	assert.equal(typeof canonical.ZeroLengthFixed, "function");
});

test("legacy facade is exact and canonical never imports it", async () => {
	assert.equal(
		await readFile(LEGACY, "utf8"),
		'export { ZeroLengthFixed } from "../../../aim-core/geometry/ZeroLengthFixed.js";\n'
	);
	assert.doesNotMatch(
		await readFile(CANONICAL, "utf8"),
		/domain\/alignment|src\/domain/
	);
});

test("Geometry and Root expose one ZeroLengthFixed authority", async () => {
	const canonical = await import(
		"../../../src/aim-core/geometry/ZeroLengthFixed.js"
	);
	const geometry = await import("../../../src/aim-core/geometry/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.strictEqual(
		geometry.ZeroLengthFixed,
		canonical.ZeroLengthFixed
	);
	assert.strictEqual(root.ZeroLengthFixed, canonical.ZeroLengthFixed);
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
