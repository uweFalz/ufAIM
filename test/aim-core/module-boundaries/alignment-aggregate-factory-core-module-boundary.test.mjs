import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const CANONICAL = new URL(
	"src/aim-core/alignment/aggregate/AlignmentFactory.js",
	ROOT
);
const LEGACY = new URL(
	"src/domain/alignment/build/AlignmentFactory.js",
	ROOT
);
const BASELINE_HASH =
	"70e1cd5cffe39f1d096cc61b117cb5fad1d2980a0b194e217cbc1a470368632f";
const IMPORTS = [
	"../../geometry/Alignment2D.js",
	"../../geometry/FixedElement.js",
	"../../geometry/TransitionElement.js",
	"../../geometry/ZeroLengthFixed.js",
	"../../geometry/ImmediateElement.js",
	"../../geometry/KinkElement.js",
];

function importSpecifiers(source) {
	return [
		...source.matchAll(
			/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g
		),
	].map((match) => match[1]);
}

test("canonical Aggregate Factory has exactly six approved Geometry imports", async () => {
	const source = await readFile(CANONICAL, "utf8");
	assert.deepEqual(importSpecifiers(source), IMPORTS);
	for (const specifier of IMPORTS) {
		assert.match(specifier, /^\.\.\/\.\.\/geometry\//);
	}
});

test("canonical Aggregate Factory has no forbidden dependency", async () => {
	const source = await readFile(CANONICAL, "utf8");
	for (const forbidden of [
		"src/domain/",
		"src/lib/",
		"app/",
		"src/services/",
		"src/import/",
		"src/shared/",
		"src/model/",
		"transitionLookup",
		".json",
		"window",
		"document",
		"Worker",
		"Messaging",
		"storage",
		"persistence",
		"MapLibre",
		"THREE",
		"transitionDB",
		"CRS",
		"Cant",
		"Profile",
		"Topology",
		"node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("Factory direct Aggregate and Root APIs share one exact authority", async () => {
	const canonical = await import(
		"../../../src/aim-core/alignment/aggregate/AlignmentFactory.js"
	);
	const aggregate = await import(
		"../../../src/aim-core/alignment/aggregate/index.js"
	);
	const legacy = await import(
		"../../../src/domain/alignment/build/AlignmentFactory.js"
	);
	const root = await import("../../../src/aim-core/index.js");
	assert.deepEqual(Object.keys(canonical), ["makeAlignment2DFromSparse"]);
	assert.strictEqual(legacy.makeAlignment2DFromSparse, canonical.makeAlignment2DFromSparse);
	assert.strictEqual(aggregate.makeAlignment2DFromSparse, canonical.makeAlignment2DFromSparse);
	assert.strictEqual(root.makeAlignment2DFromSparse, canonical.makeAlignment2DFromSparse);
});

test("legacy Factory is the exact one-line canonical facade", async () => {
	assert.equal(
		await readFile(LEGACY, "utf8"),
		'export { makeAlignment2DFromSparse } from "../../../aim-core/alignment/aggregate/AlignmentFactory.js";\n'
	);
});

test("canonical body mechanically preserves the adopted Factory baseline", async () => {
	const source = await readFile(CANONICAL, "utf8");
	const restored = source
		.replace(
			"// src/aim-core/alignment/aggregate/AlignmentFactory.js",
			"// src/domain/alignment/build/AlignmentFactory.js"
		)
		.replace("../../geometry/Alignment2D.js", "../Alignment2D.js")
		.replace("../../geometry/FixedElement.js", "../elements/FixedElement.js")
		.replace("../../geometry/TransitionElement.js", "../elements/TransitionElement.js")
		.replace("../../geometry/ZeroLengthFixed.js", "../elements/ZeroLengthFixed.js")
		.replace("../../geometry/ImmediateElement.js", "../elements/ImmediateElement.js")
		.replace("../../geometry/KinkElement.js", "../elements/KinkElement.js")
		.replace("\n\t\t);\n\n\t\t/*", "\n\t\t);\n\t\t\n\t\t/*");
	assert.equal(
		createHash("sha256").update(restored).digest("hex"),
		BASELINE_HASH
	);
});

test("productive consumers remain on the legacy Factory facade", async () => {
	for (const path of [
		"app/controllers/curvatureBandController.js",
		"src/domain/alignment/_e2eAlignmentTest.js",
		"src/domain/alignment/service/sampleSparseAlignmentForView.js",
		"src/domain/alignment/service/sampleSparseAlignmentForView_old.js",
		"src/domain/projection/AlignmentProjectionService.js",
		"src/services/alignment/_e2eAlignmentEditModelBoundaryTest.js",
	]) {
		const source = await readFile(new URL(path, ROOT), "utf8");
		assert.match(source, /AlignmentFactory\.js/, path);
		assert.doesNotMatch(source, /aim-core\/alignment\/aggregate/, path);
	}
});
