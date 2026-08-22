import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
const aliases = {
	"@src/": "src/",
	"@spot/": "src/model/spot/",
	"@projection/": "src/domain/projection/",
	"@transition/": "src/domain/transition/",
	"@alignment/": "src/domain/alignment/",
	"@domain/": "src/domain/",
	"@shared/": "src/shared/",
	"@kgeom/": "src/lib/geom/",
	"@kmath/": "src/lib/math/",
	"@utils/": "src/lib/utils/",
};
registerHooks({
	resolve(specifier, context, nextResolve) {
		for (const [prefix, target] of Object.entries(aliases)) {
			if (specifier.startsWith(prefix)) {
				return nextResolve(
					new URL(
						target + specifier.slice(prefix.length),
						rootUrl
					).href,
					context
				);
			}
		}
		return nextResolve(specifier, context);
	},
});

const moduleUrl = new URL(
	"../../../src/domain/alignment/horizontal/HorizontalConstructiveState.js",
	import.meta.url
);
const {
	isHorizontalConstructiveState,
	assertHorizontalConstructiveState,
	assertEditableHorizontalSequence,
	deriveSparseHorizontalRealization,
} = await import(moduleUrl);

function makeState() {
	return {
		type: "AlignmentData",
		id: "horizontal-A",
		name: "Horizontal A",
		editModel: {
			startPose: {
				p: { x: 0, y: 0 },
				t: { x: 1, y: 0 },
			},
			elements: [
				{
					id: "S0",
					type: "straight",
					parameters: { length: 80 },
				},
				{
					id: "T1",
					type: "transition",
					parameters: {
						length: 40,
						transitionType: "clothoid",
					},
				},
				{
					id: "A2",
					type: "arc",
					parameters: {
						length: 90,
						curvature: 0.004,
						radius: 250,
					},
				},
			],
		},
	};
}

test("valid straight-transition-arc state is recognized", () => {
	const state = makeState();
	assert.equal(isHorizontalConstructiveState(state), true);
	assert.equal(assertHorizontalConstructiveState(state), state);
});

test("empty ordered element sequence is valid and realizes to null", () => {
	const state = makeState();
	state.editModel.elements = [];
	assert.equal(isHorizontalConstructiveState(state), true);
	assert.equal(deriveSparseHorizontalRealization(state), null);
});

test("unknown Alignment and element members are accepted and preserved", () => {
	const state = makeState();
	state.unknownAlignment = { zero: 0, false: false };
	state.editModel.elements[0].unknownElement = { empty: "" };
	const before = structuredClone(state);
	assert.equal(assertHorizontalConstructiveState(state), state);
	assert.deepEqual(state, before);
});

test("missing or blank Alignment identity is rejected", () => {
	const missing = makeState();
	delete missing.id;
	const blank = makeState();
	blank.id = " ";
	assert.equal(isHorizontalConstructiveState(missing), false);
	assert.equal(isHorizontalConstructiveState(blank), false);
	assert.throws(
		() => assertHorizontalConstructiveState(blank, "fixture"),
		/^TypeError: fixture: invalid constructive horizontal Alignment state/
	);
});

test("missing or non-finite start pose is rejected", () => {
	const missing = makeState();
	delete missing.editModel.startPose;
	const nonFinite = makeState();
	nonFinite.editModel.startPose.t.y = Infinity;
	assert.equal(isHorizontalConstructiveState(missing), false);
	assert.equal(isHorizontalConstructiveState(nonFinite), false);
});

test("duplicate stable element identity is rejected", () => {
	const state = makeState();
	state.editModel.elements[1].id = "S0";
	assert.equal(isHorizontalConstructiveState(state), false);
});

test("unsupported element kind is rejected", () => {
	const state = makeState();
	state.editModel.elements[1].type = "vertical";
	assert.equal(isHorizontalConstructiveState(state), false);
});

test("adjacent straight and arc are rejected with explicit-transition message", () => {
	const state = makeState();
	state.editModel.elements = [
		state.editModel.elements[0],
		state.editModel.elements[2],
	];
	assert.throws(
		() => assertEditableHorizontalSequence(state),
		/adjacent fixed alignment elements require an explicit transition: S0 -> A2/
	);
});

test("transition separates fixed elements", () => {
	const state = makeState();
	assert.equal(assertEditableHorizontalSequence(state), state);
});

test("SparseAlignment realization is valid and input remains byte-identical", () => {
	const state = makeState();
	const before = structuredClone(state);
	const sparse = deriveSparseHorizontalRealization(state);
	assert.equal(sparse.type, "sparseAlignment");
	assert.equal(sparse.id, "horizontal-A_sparse");
	assert.equal(sparse.sparse.length, 3);
	assert.equal(sparse.sparse[0].id, "S0");
	assert.equal(sparse.sparse[1].id, "T1");
	assert.equal(sparse.sparse[2].id, "A2");
	assert.deepEqual(state, before);
});

test("domain module has only the permitted builder dependency", async () => {
	const source = await readFile(moduleUrl, "utf8");
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)]
		.map((match) => match[1]);
	assert.deepEqual(imports, ["../editor/buildSparseAlignment.js"]);
});

test("domain module contains no browser App SPOT selection persistence or import dependency", async () => {
	const source = await readFile(moduleUrl, "utf8");
	for (const forbidden of [
		"app/",
		"window",
		"document",
		"Worker",
		"Messaging",
		"SPOT",
		"workspaceSelection",
		"persistence",
		"MapLibre",
		"GND",
		"src/import",
	]) {
		assert.equal(
			source.includes(forbidden),
			false,
			`forbidden dependency: ${forbidden}`
		);
	}
});
