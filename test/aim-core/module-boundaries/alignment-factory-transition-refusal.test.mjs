import assert from "node:assert/strict";
import test from "node:test";

import { makeAlignment2DFromSparse } from "../../../src/aim-core/alignment/aggregate/AlignmentFactory.js";
import { RegistryResolver } from "../../../src/domain/transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "../../../src/aim-core/transition/runtime/KappaFcnBuilder.js";
import { TransitionElement } from "../../../src/aim-core/geometry/TransitionElement.js";
import { ImmediateElement } from "../../../src/aim-core/geometry/ImmediateElement.js";
import { KinkElement } from "../../../src/aim-core/geometry/KinkElement.js";
import { ZeroLengthFixed } from "../../../src/aim-core/geometry/ZeroLengthFixed.js";

const startPose = { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } };
const runtime = { kappa: (u) => u, kappaInt: (u) => u * u / 2 };
const descriptorResolver = { resolveTransitionDescriptor: () => ({ id: "custom" }) };
const kappaBuilder = { buildPresetFromDescriptor: () => runtime };

function sparse(transition = {}) {
	return [
		{ id: "A", type: "fixed", arcLength: 10, curvature: 0 },
		{ id: "T", type: "transition", arcLength: 7, transType: "custom", ...transition },
		{ id: "B", type: "fixed", arcLength: 20, curvature: 0.01 },
	];
}

function build(transition = {}, collaborators = {}) {
	return makeAlignment2DFromSparse({
		startPose, sparse: sparse(transition), descriptorResolver, kappaBuilder,
		...collaborators,
	});
}

function refuses(action, stage, extra = {}) {
	assert.throws(action, (error) => {
		assert.equal(error.name, "AlignmentTransitionBuildError");
		assert.equal(error.code, "ALIGNMENT_TRANSITION_BUILD_FAILED");
		assert.equal(error.stage, stage);
		assert.equal(error.elementId, extra.elementId ?? "T");
		assert.equal(error.index, 1);
		assert.equal(error.transType, extra.transType ?? "custom");
		assert.equal(error.arcLength, extra.arcLength ?? 7);
		assert.match(error.message, /positive-length transition refused/);
		assert.ok(error.message.includes(`element=${JSON.stringify(error.elementId)}`));
		assert.ok(error.message.includes("index=1"));
		assert.ok(error.message.includes(`transType=${JSON.stringify(error.transType)}`));
		assert.ok(error.message.includes(`arcLength=${error.arcLength}`));
		assert.ok(error.message.includes(`at ${stage}`));
		assert.ok(Object.hasOwn(error, "cause"));
		if (Object.hasOwn(extra, "cause")) assert.strictEqual(error.cause, extra.cause);
		return true;
	});
}

for (const transType of [undefined, null, ""]) {
	test(`positive transition with missing transType ${String(transType)} refuses without resolving`, () => {
		let calls = 0;
		refuses(() => build({ transType }, {
			descriptorResolver: { resolveTransitionDescriptor() { calls++; } },
		}), "transType", { transType: "" });
		assert.equal(calls, 0);
	});
}

test("an unknown real registry type refuses rather than shortening the alignment", () => {
	refuses(() => build({ transType: "UNREGISTERED-097" }, {
		descriptorResolver: new RegistryResolver(), kappaBuilder: KappaFcnBuilder,
	}), "descriptor", { transType: "unregistered-097" });
});

for (const collaborator of [undefined, null, {}, { resolveTransitionDescriptor: true }]) {
	test(`missing/non-callable resolver is contextual (${JSON.stringify(collaborator)})`, () => {
		refuses(() => build({}, { descriptorResolver: collaborator }), "descriptor");
	});
}

for (const collaborator of [undefined, null, {}, { buildPresetFromDescriptor: true }]) {
	test(`missing/non-callable builder is contextual (${JSON.stringify(collaborator)})`, () => {
		refuses(() => build({}, { kappaBuilder: collaborator }), "preset");
	});
}

for (const descriptor of [undefined, null, false, 1, "custom", []]) {
	test(`invalid descriptor result refuses before preset building (${JSON.stringify(descriptor)})`, () => {
		let calls = 0;
		refuses(() => build({}, {
			descriptorResolver: { resolveTransitionDescriptor: () => descriptor },
			kappaBuilder: { buildPresetFromDescriptor() { calls++; return runtime; } },
		}), "descriptor");
		assert.equal(calls, 0);
	});
}

for (const [stage, collaborators] of [
	["descriptor", (cause) => ({
		descriptorResolver: { resolveTransitionDescriptor() { throw cause; } },
	})],
	["preset", (cause) => ({
		kappaBuilder: { buildPresetFromDescriptor() { throw cause; } },
	})],
]) {
	for (const cause of [new Error(`${stage}-failure`), "non-Error failure"]) {
		test(`${stage} failure preserves original cause ${String(cause)}`, () => {
			refuses(() => build({}, collaborators(cause)), stage, { cause });
		});
	}
}

for (const preset of [
	undefined, null, {}, { kappa: runtime.kappa },
	{ kappa: true, kappaInt: runtime.kappaInt },
	{ kappa: runtime.kappa, kappaInt: 1 },
]) {
	test(`invalid runtime preset refuses (${JSON.stringify(preset)})`, () => {
		refuses(() => build({}, {
			kappaBuilder: { buildPresetFromDescriptor: () => preset },
		}), "preset");
	});
}

test("a TransitionElement constructor failure retains its cause and positive length", () => {
	const cause = new Error("constructor-access");
	let reads = 0;
	const preset = {
		get kappa() {
			if (++reads === 2) throw cause;
			return runtime.kappa;
		},
		kappaInt: runtime.kappaInt,
	};
	refuses(() => build({}, {
		kappaBuilder: { buildPresetFromDescriptor: () => preset },
	}), "element", { cause });
	assert.equal(reads, 2, "the second access is in the actual TransitionElement constructor");
});

test("refusal preserves sparse evidence and reports generated ID and legacy length spelling", () => {
	const input = sparse({ id: undefined, arcLength: undefined, arclength: "7", transType: "" });
	input[1].meta = { sourceType: 8, note: "unresolved source evidence" };
	const before = structuredClone(input);
	for (const stub of input) Object.freeze(stub);
	Object.freeze(input);
	refuses(() => makeAlignment2DFromSparse({
		startPose, sparse: input, descriptorResolver, kappaBuilder,
	}), "transType", { elementId: "T_1", transType: "" });
	assert.deepEqual(input, before);
});

test("even a very small positive transition cannot use the zero-length special path", () => {
	refuses(() => build({ transType: "", arcLength: 1e-15 }),
		"transType", { transType: "", arcLength: 1e-15 });
});

test("explicit zero-length holder, Immediate and numeric/vector Kink remain intact", () => {
	let calls = 0;
	const never = () => { calls++; throw new Error("zero-length path must not resolve/build"); };
	const turn = 0.2;
	const { alignment, warnings } = makeAlignment2DFromSparse({
		startPose,
		sparse: [
			{ id: "Z", type: "fixed", arcLength: 0, curvature: 0.01 },
			{ id: "I", type: "transition", arcLength: 0, transType: "immediate" },
			{ id: "K", type: "transition", arcLength: 0, transType: "kink", deltaDir: turn },
			{ id: "V", type: "transition", arcLength: 0, transType: "kink",
				deltaDir: { x: Math.cos(turn), y: Math.sin(turn) } },
			{ id: "G", type: "fixed", arcLength: 10, curvature: 0.02 },
		],
		descriptorResolver: { resolveTransitionDescriptor: never },
		kappaBuilder: { buildPresetFromDescriptor: never },
	});
	assert.equal(calls, 0);
	assert.deepEqual(warnings, []);
	assert.ok(alignment.elements[0] instanceof ZeroLengthFixed);
	assert.ok(alignment.elements[1] instanceof ImmediateElement);
	assert.ok(alignment.elements[2] instanceof KinkElement);
	assert.ok(alignment.elements[3] instanceof KinkElement);
	assert.equal(alignment.elements[2].deltaDir, turn);
	assert.ok(Math.abs(alignment.elements[3].deltaDir - turn) < 1e-15);
	assert.equal(alignment.arcLength, 10);
});

test("valid continuous transition keeps all declared length and collaborator identities", () => {
	const { alignment, warnings } = build();
	assert.ok(alignment.elements[1] instanceof TransitionElement);
	assert.equal(alignment.elements[1].arcLength, 7);
	assert.equal(alignment.arcLength, 37);
	assert.strictEqual(alignment.elements[1].runtime, runtime);
	assert.equal(alignment.elements[1].kappaA, 0);
	assert.equal(alignment.elements[1].kappaB, 0.01);
	assert.deepEqual(warnings, []);
});
