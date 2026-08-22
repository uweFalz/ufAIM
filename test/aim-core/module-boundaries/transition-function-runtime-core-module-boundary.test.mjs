import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const RUNTIME_ROOT = new URL("src/aim-core/transition/runtime/", ROOT);
const KAPPA = new URL("KappaFcnBuilder.js", RUNTIME_ROOT);
const ANCHORS = new URL("computeAnchorsFromTotal.js", RUNTIME_ROOT);
const CLAMP = new URL("clamp01.js", RUNTIME_ROOT);

function imports(source) {
	return [...source.matchAll(
		/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
	)].map((match) => match[1]);
}

test("Runtime directory contains exactly three implementations and its barrel", async () => {
	assert.deepEqual(
		(await readdir(RUNTIME_ROOT)).filter((name) => name.endsWith(".js")).sort(),
		[
			"KappaFcnBuilder.js",
			"clamp01.js",
			"computeAnchorsFromTotal.js",
			"index.js",
		]
	);
});

test("canonical Kappa runtime imports exactly seven approved Core modules", async () => {
	assert.deepEqual(imports(await readFile(KAPPA, "utf8")), [
		"../ast/buildProtoAst.js",
		"../ast/evalAst.js",
		"../ast/symDiff.js",
		"../ast/symInt.js",
		"../ast/simplify.js",
		"./clamp01.js",
		"./computeAnchorsFromTotal.js",
	]);
});

test("private runtime helpers have zero imports and exact direct APIs", async () => {
	assert.deepEqual(imports(await readFile(ANCHORS, "utf8")), []);
	assert.deepEqual(imports(await readFile(CLAMP, "utf8")), []);
	const anchors = await import(
		"../../../src/aim-core/transition/runtime/computeAnchorsFromTotal.js"
	);
	const clamp = await import(
		"../../../src/aim-core/transition/runtime/clamp01.js"
	);
	assert.deepEqual(Object.keys(anchors), ["computeAnchorsFromTotal"]);
	assert.deepEqual(Object.keys(clamp), ["clamp01"]);
});

test("runtime sources contain no forbidden external dependency", async () => {
	const source = await Promise.all(
		["KappaFcnBuilder.js", "computeAnchorsFromTotal.js", "clamp01.js"]
			.map((name) => readFile(new URL(name, RUNTIME_ROOT), "utf8"))
	).then((parts) => parts.join("\n"));
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
		"RegistryResolver",
		"transitionLookup",
		".json",
		"Alignment",
		"CRS",
		"Cant",
		"GND",
		"IFC",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("Runtime barrel exposes exactly its three current APIs", async () => {
	const runtime = await import(
		"../../../src/aim-core/transition/runtime/index.js"
	);
	assert.deepEqual(Object.keys(runtime), [
		"KappaFcnBuilder",
		"clamp01",
		"computeAnchorsFromTotal",
	]);
});

test("Runtime Transition and Root expose the same authorities", async () => {
	const runtime = await import(
		"../../../src/aim-core/transition/runtime/index.js"
	);
	const transition = await import("../../../src/aim-core/transition/index.js");
	const root = await import("../../../src/aim-core/index.js");
	for (const name of Object.keys(runtime)) {
		assert.strictEqual(transition[name], runtime[name]);
		assert.strictEqual(root[name], runtime[name]);
	}
});

test("fresh Root retains every accepted Transition export by identity", () => {
	const runtimeUrl = new URL(
		"src/aim-core/transition/runtime/index.js",
		ROOT
	).href;
	const transitionUrl = new URL("src/aim-core/transition/index.js", ROOT).href;
	const rootUrl = new URL("src/aim-core/index.js", ROOT).href;
	const output = execFileSync(process.execPath, [
		"--input-type=module",
		"--eval",
		`
			const runtime = await import(${JSON.stringify(runtimeUrl)});
			const transition = await import(${JSON.stringify(transitionUrl)});
			const root = await import(${JSON.stringify(rootUrl)});
			if (!Object.keys(transition).every((name) => root[name] === transition[name])) {
				throw new Error("Root replaced an accepted Transition export");
			}
			if (!Object.keys(runtime).every((name) => transition[name] === runtime[name])) {
				throw new Error("Transition replaced a Runtime export");
			}
			process.stdout.write("true");
		`,
	], { encoding: "utf8" });
	assert.equal(output, "true");
});

test("legacy Kappa and anchor files are exact logic-free facades", async () => {
	assert.equal(
		await readFile(
			new URL("src/domain/transition/build/KappaFcnBuilder.js", ROOT),
			"utf8"
		),
		'export { KappaFcnBuilder } from "../../../aim-core/transition/runtime/KappaFcnBuilder.js";\n'
	);
	assert.equal(
		await readFile(
			new URL(
				"src/domain/transition/registry/compose/computeAnchorsFromTotal.js",
				ROOT
			),
			"utf8"
		),
		'export { computeAnchorsFromTotal } from "../../../../aim-core/transition/runtime/computeAnchorsFromTotal.js";\n'
	);
});

test("canonical runtime never imports either legacy facade", async () => {
	const source = await readFile(KAPPA, "utf8");
	assert.doesNotMatch(source, /domain\/transition|registry\/compose/);
});

test("dormant compose helpers remain outside the Runtime API", async () => {
	const runtime = await import(
		"../../../src/aim-core/transition/runtime/index.js"
	);
	assert.equal("composeTotal" in runtime, false);
	assert.equal("solvePartitionC1" in runtime, false);
});
