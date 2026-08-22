import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
const aliases = {
	"@src/": "src/",
	"@transition/": "src/domain/transition/",
};
registerHooks({
	resolve(specifier, context, nextResolve) {
		for (const [prefix, target] of Object.entries(aliases)) {
			if (specifier.startsWith(prefix)) {
				return nextResolve(
					new URL(target + specifier.slice(prefix.length), rootUrl).href,
					context
				);
			}
		}
		return nextResolve(specifier, context);
	},
});

import transitionLookup from "../../../src/domain/transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "../../../src/domain/transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "../../../src/aim-core/transition/runtime/KappaFcnBuilder.js";
import {
	buildSparseAlignment as canonicalBuild,
	buildSparseFromEditModel as canonicalBuildFromEdit,
} from "../../../src/aim-core/alignment/aggregate/SparseAlignmentBuilder.js";
import {
	assertEditableHorizontalSequence as canonicalAssertSequence,
	assertHorizontalConstructiveState as canonicalAssertState,
	deriveSparseHorizontalRealization as canonicalDerive,
	isHorizontalConstructiveState as canonicalIsState,
} from "../../../src/aim-core/alignment/aggregate/HorizontalConstructiveState.js";

const legacySparse = await import(
	"../../../src/domain/alignment/editor/buildSparseAlignment.js"
);
const legacyHorizontal = await import(
	"../../../src/domain/alignment/horizontal/HorizontalConstructiveState.js"
);
const aggregate = await import(
	"../../../src/aim-core/alignment/aggregate/index.js"
);
const root = await import("../../../src/aim-core/index.js");

function dependencies(overrides = {}) {
	return {
		descriptorResolver: new RegistryResolver(structuredClone(transitionLookup)),
		kappaBuilder: KappaFcnBuilder,
		...overrides,
	};
}

function makeState() {
	return {
		type: "AlignmentData",
		id: "alignment-030",
		name: "Alignment 030",
		editModel: {
			startPose: { p: { x: 10, y: -4 }, t: { x: 2, y: 0 } },
			elements: [
				{
					id: "S0",
					type: "straight",
					parameters: { length: 20 },
				},
				{
					id: "T1",
					type: "transition",
					parameters: {
						length: 30,
						transitionType: "clothoid",
						w1: 0.2,
						w2: 0.8,
					},
				},
				{
					id: "A2",
					type: "arc",
					parameters: { length: 40, radius: -250 },
				},
			],
		},
	};
}

function withoutTimestamp(value) {
	const copy = structuredClone(value);
	copy.meta.createdAt = "<timestamp>";
	return copy;
}

test("pure validation exports retain Legacy Canonical Aggregate and Root identity", () => {
	for (const [name, canonical] of [
		["isHorizontalConstructiveState", canonicalIsState],
		["assertHorizontalConstructiveState", canonicalAssertState],
		["assertEditableHorizontalSequence", canonicalAssertSequence],
	]) {
		assert.strictEqual(legacyHorizontal[name], canonical, name);
		assert.strictEqual(aggregate[name], canonical, name);
		assert.strictEqual(root[name], canonical, name);
	}
	assert.strictEqual(aggregate.buildSparseAlignment, canonicalBuild);
	assert.strictEqual(root.buildSparseAlignment, canonicalBuild);
	assert.strictEqual(aggregate.buildSparseFromEditModel, canonicalBuildFromEdit);
	assert.strictEqual(root.buildSparseFromEditModel, canonicalBuildFromEdit);
});

test("legacy configured and canonical injected sparse paths are equivalent", () => {
	const leftInput = makeState();
	const rightInput = structuredClone(leftInput);
	const leftBefore = structuredClone(leftInput);
	const rightBefore = structuredClone(rightInput);
	const legacy = legacySparse.buildSparseAlignment(leftInput);
	const canonical = canonicalBuild(rightInput, dependencies());
	assert.deepEqual(withoutTimestamp(legacy), withoutTimestamp(canonical));
	assert.deepEqual(leftInput, leftBefore);
	assert.deepEqual(rightInput, rightBefore);
	assert.deepEqual(
		withoutTimestamp(legacySparse.buildSparseFromEditModel(makeState())),
		withoutTimestamp(canonicalBuildFromEdit(makeState(), dependencies()))
	);
});

test("canonical dependency injection preserves exact calls references and order", () => {
	const state = makeState();
	const calls = [];
	const descriptorResolver = {
		resolveTransitionDescriptor(id) {
			calls.push(["resolve-preflight", id]);
			return { id };
		},
	};
	const alignmentFactory = (payload) => {
		calls.push(["factory", payload]);
		return {
			alignment: {
				poseAt(s, opts) {
					calls.push(["pose", s, opts]);
					return { p: { x: s, y: 0 }, t: { x: 1, y: 0 } };
				},
			},
			warnings: [],
		};
	};
	const kappaBuilder = { marker: "builder" };
	const result = canonicalBuild(state, {
		descriptorResolver,
		kappaBuilder,
		alignmentFactory,
	});
	assert.deepEqual(calls[0], ["resolve-preflight", "clothoid"]);
	assert.equal(calls[1][0], "factory");
	assert.strictEqual(calls[1][1].descriptorResolver, descriptorResolver);
	assert.strictEqual(calls[1][1].kappaBuilder, kappaBuilder);
	assert.deepEqual(
		calls.slice(2),
		[
			["pose", 0, { quality: "exact" }],
			["pose", 20, { quality: "exact" }],
			["pose", 50, { quality: "exact" }],
		]
	);
	assert.equal(result.length, 90);
});

test("canonical derive forwards dependencies and legacy derive remains equivalent", () => {
	const state = makeState();
	const calls = [];
	const sparseBuilder = (value, deps) => {
		calls.push([value, deps]);
		return { type: "sentinel" };
	};
	const marker = { descriptorResolver: {}, kappaBuilder: {} };
	assert.deepEqual(
		canonicalDerive(state, { sparseBuilder, ...marker }),
		{ type: "sentinel" }
	);
	assert.strictEqual(calls[0][0], state);
	assert.strictEqual(calls[0][1].descriptorResolver, marker.descriptorResolver);
	assert.strictEqual(calls[0][1].kappaBuilder, marker.kappaBuilder);
	assert.deepEqual(
		withoutTimestamp(legacyHorizontal.deriveSparseHorizontalRealization(makeState())),
		withoutTimestamp(canonicalDerive(makeState(), dependencies()))
	);
});

test("validation sequence empty derive and exact errors remain unchanged", () => {
	const state = makeState();
	assert.equal(canonicalIsState(state), true);
	assert.strictEqual(canonicalAssertState(state), state);
	assert.strictEqual(canonicalAssertSequence(state), state);
	const empty = makeState();
	empty.editModel.elements = [];
	assert.equal(canonicalDerive(empty), null);
	const duplicate = makeState();
	duplicate.editModel.elements[1].id = "S0";
	assert.equal(canonicalIsState(duplicate), false);
	assert.throws(
		() => canonicalAssertState(duplicate, "fixture"),
		/^TypeError: fixture: invalid constructive horizontal Alignment state/
	);
	const adjacent = makeState();
	adjacent.editModel.elements.splice(1, 1);
	assert.throws(
		() => canonicalAssertSequence(adjacent),
		/adjacent fixed alignment elements require an explicit transition: S0 -> A2/
	);
});

test("representative conversion failures and injected failures propagate exactly", () => {
	for (const mutate of [
		(value) => { value.editModel.startPose = null; },
		(value) => { value.editModel.elements = []; },
		(value) => { value.editModel.elements[0].parameters.length = 0; },
		(value) => { value.editModel.elements[1].parameters.transitionType = ""; },
		(value) => { value.editModel.elements[2].parameters.radius = 0; },
	]) {
		const left = makeState();
		const right = makeState();
		mutate(left);
		mutate(right);
		assert.throws(
			() => legacySparse.buildSparseAlignment(left),
			(error) => {
				assert.throws(
					() => canonicalBuild(right, dependencies()),
					(candidate) =>
						candidate.constructor === error.constructor &&
						candidate.message === error.message
				);
				return true;
			}
		);
	}
	assert.throws(
		() => canonicalBuild(makeState(), {
			...dependencies(),
			alignmentFactory() {
				throw new Error("factory-x");
			},
		}),
		/^Error: factory-x/
	);
});
