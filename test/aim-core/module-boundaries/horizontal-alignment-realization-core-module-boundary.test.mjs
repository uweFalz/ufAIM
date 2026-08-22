import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const AGGREGATE = new URL(
	"../../../src/aim-core/alignment/aggregate/",
	import.meta.url
);
const SPARSE = new URL("SparseAlignmentBuilder.js", AGGREGATE);
const HORIZONTAL = new URL("HorizontalConstructiveState.js", AGGREGATE);
const LEGACY_SPARSE = new URL(
	"../../../src/domain/alignment/editor/buildSparseAlignment.js",
	import.meta.url
);
const LEGACY_HORIZONTAL = new URL(
	"../../../src/domain/alignment/horizontal/HorizontalConstructiveState.js",
	import.meta.url
);

const expectedAggregateFiles = [
	"AlignmentFactory.js",
	"HorizontalConstructiveState.js",
	"SparseAlignmentBuilder.js",
	"index.js",
];
const SPARSE_BASELINE_HASH =
	"0b694d4b4954e08acb3c754ab166856645d417608f220750069dac5fc5b4ad43";
const HORIZONTAL_BASELINE_HASH =
	"c10a77840a1a7bf6c6d338d2020b1f8719ae5a8fdc8c52d5c48bd6e2fe442ee7";

function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}

test("Aggregate Core contains the accepted Factory and horizontal realization modules", async () => {
	const files = (await readdir(AGGREGATE))
		.filter((name) => name.endsWith(".js"))
		.sort();
	assert.deepEqual(files, expectedAggregateFiles);
});

test("canonical Sparse builder imports only canonical Factory", async () => {
	const source = await readFile(SPARSE, "utf8");
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)]
		.map((match) => match[1]);
	assert.deepEqual(imports, ["./AlignmentFactory.js"]);
});

test("canonical Horizontal state imports only canonical Sparse builder", async () => {
	const source = await readFile(HORIZONTAL, "utf8");
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)]
		.map((match) => match[1]);
	assert.deepEqual(imports, ["./SparseAlignmentBuilder.js"]);
});

test("canonical Sparse body mechanically preserves the productive baseline", async () => {
	const source = await readFile(SPARSE, "utf8");
	const restored = source
		.replace(
			"// src/aim-core/alignment/aggregate/SparseAlignmentBuilder.js",
			"// src/domain/alignment/editor/buildSparseAlignment.js"
		)
		.replace(
			" * This file has no application-layer dependencies.",
			" * This file does not know SPOT, View, Projection, Cockpit or Import."
		)
		.replace(
			'import { makeAlignment2DFromSparse } from "./AlignmentFactory.js";',
			[
				'import transitionLookup from "@transition/transitionLookup.json" with { type: "json" };',
				'import { RegistryResolver } from "@transition/registry/RegistryResolver.js";',
				'import { KappaFcnBuilder } from "@transition/build/KappaFcnBuilder.js";',
				'import { makeAlignment2DFromSparse } from "../build/AlignmentFactory.js";',
				"",
				"const descriptorResolver = new RegistryResolver(transitionLookup);",
			].join("\n")
		)
		.replace(
			[
				"export function buildSparseAlignment(",
				"\talignmentData,",
				"\t{",
				"\t\tdescriptorResolver,",
				"\t\tkappaBuilder,",
				"\t\talignmentFactory = makeAlignment2DFromSparse,",
				"\t} = {}",
				") {",
			].join("\n"),
			"export function buildSparseAlignment(alignmentData) {"
		)
		.replace("const built = alignmentFactory({", "const built = makeAlignment2DFromSparse({")
		.replace("\t\tkappaBuilder,\n", "\t\tkappaBuilder: KappaFcnBuilder,\n")
		.replace(
			"export function buildSparseFromEditModel(alignmentData, dependencies = {}) {\n" +
				"\treturn buildSparseAlignment(alignmentData, dependencies);\n" +
				"}",
			"export function buildSparseFromEditModel(alignmentData) {\n" +
				"\treturn buildSparseAlignment(alignmentData);\n" +
				"}"
		);
	assert.equal(sha256(restored), SPARSE_BASELINE_HASH);
});

test("canonical Horizontal body mechanically preserves the productive baseline", async () => {
	const source = await readFile(HORIZONTAL, "utf8");
	const restored = source
		.replace(
			'import { buildSparseFromEditModel } from "./SparseAlignmentBuilder.js";',
			'import { buildSparseFromEditModel } from "../editor/buildSparseAlignment.js";'
		)
		.replace(
			[
				"export function deriveSparseHorizontalRealization(",
				"\tvalue,",
				"\t{",
				"\t\tsparseBuilder = buildSparseFromEditModel,",
				"\t\t...dependencies",
				"\t} = {}",
				") {",
			].join("\n"),
			"export function deriveSparseHorizontalRealization(value) {"
		)
		.replace(
			"return sparseBuilder(value, dependencies);",
			"return buildSparseFromEditModel(value);"
		);
	assert.equal(sha256(restored), HORIZONTAL_BASELINE_HASH);
});

test("canonical horizontal realization has no forbidden concrete dependency", async () => {
	const source = [
		await readFile(SPARSE, "utf8"),
		await readFile(HORIZONTAL, "utf8"),
	].join("\n");
	for (const forbidden of [
		"transitionLookup.json",
		"RegistryResolver",
		"KappaFcnBuilder",
		"src/domain/",
		"src/lib/",
		"@transition/",
		"@src/",
		"app/",
		"window",
		"document",
		"Worker",
		"Messaging",
		"SPOT",
		"storage",
		"persistence",
		"MapLibre",
		"Three",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("Aggregate and Root expose the five horizontal APIs without replacing Factory", async () => {
	const [aggregate, root, factory] = await Promise.all([
		import(new URL("index.js", AGGREGATE)),
		import(new URL("../../../src/aim-core/index.js", import.meta.url)),
		import(new URL("AlignmentFactory.js", AGGREGATE)),
	]);
	for (const name of [
		"buildSparseAlignment",
		"buildSparseFromEditModel",
		"isHorizontalConstructiveState",
		"assertHorizontalConstructiveState",
		"assertEditableHorizontalSequence",
		"deriveSparseHorizontalRealization",
	]) {
		assert.equal(typeof aggregate[name], "function", name);
		assert.strictEqual(root[name], aggregate[name], name);
	}
	assert.strictEqual(
		aggregate.makeAlignment2DFromSparse,
		factory.makeAlignment2DFromSparse
	);
});

test("legacy adapters contain orchestration only and canonical Core never imports them", async () => {
	const sparse = await readFile(LEGACY_SPARSE, "utf8");
	const horizontal = await readFile(LEGACY_HORIZONTAL, "utf8");
	assert.match(sparse, /transitionLookup\.json/);
	assert.match(sparse, /RegistryResolver/);
	assert.match(sparse, /KappaFcnBuilder/);
	assert.match(sparse, /SparseAlignmentBuilder\.js/);
	assert.doesNotMatch(sparse, /function buildSparseElementFromEditor/);
	assert.doesNotMatch(sparse, /function annotateSparseWithPoseAndStation/);
	assert.match(horizontal, /HorizontalConstructiveState\.js/);
	assert.match(horizontal, /buildSparseAlignment\.js/);
	assert.doesNotMatch(horizontal, /function isObject/);
	assert.doesNotMatch(horizontal, /adjacent fixed alignment elements/);
	assert.doesNotMatch(await readFile(SPARSE, "utf8"), /domain\/alignment/);
	assert.doesNotMatch(await readFile(HORIZONTAL, "utf8"), /domain\/alignment/);
});

test("concrete transition catalogue remains outside canonical Core", async () => {
	const canonical = [
		await readFile(SPARSE, "utf8"),
		await readFile(HORIZONTAL, "utf8"),
	].join("\n");
	const legacy = await readFile(LEGACY_SPARSE, "utf8");
	assert.doesNotMatch(canonical, /transitionLookup\.json/);
	assert.match(legacy, /transitionLookup\.json/);
});

test("productive consumers retain configured legacy entry points", async () => {
	for (const path of [
		"app/_e2eAlignmentNativeUiTest.js",
		"app/_e2eCurvatureBandTest.js",
		"app/_e2eGeoRuntimeAcceptanceTest.js",
		"app/_e2eSpotWorkspaceTest.js",
		"app/controllers/curvatureBandController.js",
		"src/services/alignment/AlignmentApplicationService.js",
		"src/services/alignment/_e2eAlignmentEditModelBoundaryTest.js",
	]) {
		const source = await readFile(new URL(path, ROOT), "utf8");
		assert.match(
			source,
			/domain\/alignment\/(editor\/buildSparseAlignment|horizontal\/HorizontalConstructiveState)\.js/,
			path
		);
		assert.doesNotMatch(source, /aim-core\/alignment\/aggregate/, path);
	}
});
