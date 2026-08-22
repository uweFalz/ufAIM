import assert from "node:assert/strict";
import test from "node:test";

import * as authoring from "../../../src/aim-core/alignment/authoring/index.js";
import * as canonical from "../../../src/aim-core/alignment/authoring/alignmentEditOps.js";
import * as legacy from "../../../src/domain/alignment/editor/alignmentEditOps.js";
import * as root from "../../../src/aim-core/index.js";

const NOW = "2026-07-27T01:00:00.000Z";

function fixture() {
	return {
		type: "AlignmentData",
		id: "alignment-A",
		name: "Edit Operations",
		source: { kind: "native", native: true, sourceExtension: "keep" },
		editModel: {
			startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
			elements: [],
			editExtension: { keep: true },
		},
		sparseAlignment: { stale: true },
		meta: { lifecycle: "draft", dirty: false, extension: "keep" },
		extensionEvidence: { preserve: true },
	};
}

function withGeneratedIds(run) {
	const realNow = Date.now;
	const realRandom = Math.random;
	let nowCall = 0;
	let randomCall = 0;
	try {
		Date.now = () => 1_700_000_000_000 + nowCall++;
		Math.random = () => 0.1 + randomCall++ / 100;
		return run();
	} finally {
		Date.now = realNow;
		Math.random = realRandom;
	}
}

function runEveryOperation(api) {
	return withGeneratedIds(() => {
		const original = fixture();
		let value = api.addStraightElement(original, { length: "100", now: NOW });
		value = api.insertStraightElement(value, {
			index: "0",
			length: { value: 25 },
			now: NOW,
		});
		value = api.addArcElement(value, {
			length: 80,
			radius: -400,
			now: NOW,
		});
		value = api.insertArcElement(value, {
			index: 1,
			length: 60,
			curvature: 0.004,
			now: NOW,
		});
		value = api.addTransitionElement(value, {
			length: 50,
			transitionType: "CLOTHOID",
			w1: -1,
			w2: 2,
			now: NOW,
		});
		value = api.insertTransitionElement(value, {
			index: 2,
			length: 40,
			transitionType: "Bloss",
			now: NOW,
		});
		const [first, arc, transition] = [
			api.readAlignmentElements(value)[0],
			api.readAlignmentElements(value).find((element) => element.type === "arc"),
			api.readAlignmentElements(value).find(
				(element) => element.type === "transition"
			),
		];
		assert.strictEqual(api.findElementById(value, first.id), first);
		value = api.updateStraightLengthById(value, {
			elementId: first.id,
			length: 30,
			now: NOW,
		});
		value = api.updateArcById(value, {
			elementId: arc.id,
			radius: 250,
			now: NOW,
		});
		value = api.updateTransitionById(value, {
			elementId: transition.id,
			length: 45,
			transitionType: "COSINE",
			w1: 0.2,
			w2: 0.8,
			now: NOW,
		});
		value = api.replaceElementById(value, {
			elementId: first.id,
			nextElement: { extension: "replacement" },
			now: NOW,
		});
		value = api.moveElementById(value, {
			elementId: first.id,
			toIndex: 4,
			now: NOW,
		});
		value = api.removeElementById(value, {
			elementId: arc.id,
			now: NOW,
		});
		value = api.removeElementAtIndex(value, { index: "0", now: NOW });
		const beforeClear = value;
		value = api.clearElements(value, { now: NOW });
		return { original, beforeClear, value };
	});
}

test("legacy canonical Authoring and Root exports share one authority", () => {
	assert.deepEqual(Object.keys(legacy), Object.keys(canonical));
	for (const name of Object.keys(canonical)) {
		assert.strictEqual(legacy[name], canonical[name], name);
		assert.strictEqual(authoring[name], canonical[name], name);
		assert.strictEqual(root[name], canonical[name], name);
	}
});

test("representative sequence covers every public operation identically", () => {
	const oldRun = runEveryOperation(legacy);
	const newRun = runEveryOperation(canonical);
	assert.deepEqual(newRun, oldRun);
	assert.deepEqual(oldRun.original, fixture());
	assert.deepEqual(newRun.original, fixture());
	assert.notStrictEqual(newRun.value, oldRun.value);
	assert.deepEqual(newRun.value.editModel.elements, []);
	assert.equal(newRun.value.sparseAlignment, null);
	assert.equal(newRun.value.meta.dirty, true);
	assert.equal(newRun.value.meta.modifiedAt, NOW);
	assert.deepEqual(newRun.value.extensionEvidence, { preserve: true });
	assert.deepEqual(newRun.value.editModel.editExtension, { keep: true });
});

test("generated IDs retain Date Math format calls and global restoration", () => {
	const realNow = Date.now;
	const realRandom = Math.random;
	const calls = [];
	try {
		Date.now = () => {
			calls.push("Date.now");
			return 1_700_000_000_000;
		};
		Math.random = () => {
			calls.push("Math.random");
			return 0.123456789;
		};
		const changed = canonical.addStraightElement(fixture(), {
			length: 10,
			now: NOW,
		});
		assert.equal(changed.editModel.elements[0].id, "straight_loyw3v28_4fzzzx");
		assert.deepEqual(calls, ["Date.now", "Math.random"]);
	} finally {
		Date.now = realNow;
		Math.random = realRandom;
	}
	assert.strictEqual(Date.now, realNow);
	assert.strictEqual(Math.random, realRandom);
});

test("insert indices preserve coercion clamping and exact errors", () => {
	const base = fixture();
	const appended = withGeneratedIds(() =>
		canonical.insertStraightElement(base, {
			index: 999,
			length: 10,
			now: NOW,
		})
	);
	const prepended = withGeneratedIds(() =>
		canonical.insertStraightElement(appended, {
			index: -9,
			length: 20,
			now: NOW,
		})
	);
	assert.equal(prepended.editModel.elements[0].parameters.length, 20);
	assert.throws(
		() =>
			canonical.insertStraightElement(base, {
				index: 0.5,
				length: 10,
				now: NOW,
			}),
		{ message: "resolveInsertIndex: index must be an integer" }
	);
	assert.throws(
		() => canonical.removeElementAtIndex(base, { index: 0, now: NOW }),
		{ message: "removeElementAtIndex: index out of range" }
	);
});

test("straight arc and transition normalization and exact errors remain", () => {
	assert.throws(
		() => canonical.addStraightElement(fixture(), { length: 0, now: NOW }),
		{ message: "insertStraightElement: length must be a positive number" }
	);
	assert.throws(
		() =>
			canonical.addArcElement(fixture(), {
				length: 10,
				curvature: 0,
				now: NOW,
			}),
		{ message: "insertArcElement: arc curvature: value must be non-zero" }
	);
	assert.throws(
		() =>
			canonical.addTransitionElement(fixture(), {
				length: 10,
				transitionType: "clothoid",
				w1: 0.8,
				w2: 0.2,
				now: NOW,
			}),
		{ message: "insertTransitionElement: transition w2 must be >= w1" }
	);
});

test("missing identifiers and replacement inputs retain exact behavior", () => {
	assert.throws(
		() => canonical.removeElementById(fixture(), { elementId: " " }),
		{ message: "removeElementById: missing elementId" }
	);
	assert.throws(
		() => canonical.replaceElementById(fixture(), { elementId: "x" }),
		{ message: "replaceElementById: missing nextElement" }
	);
	assert.throws(
		() => canonical.moveElementById(fixture(), { elementId: null }),
		{ message: "moveElementById: missing elementId" }
	);
});

test("not-found and already-positioned operations return the input by identity", () => {
	const base = withGeneratedIds(() =>
		canonical.addStraightElement(fixture(), { length: 10, now: NOW })
	);
	assert.strictEqual(
		canonical.removeElementById(base, { elementId: "missing", now: NOW }),
		base
	);
	assert.strictEqual(
		canonical.replaceElementById(base, {
			elementId: "missing",
			nextElement: {},
			now: NOW,
		}),
		base
	);
	assert.strictEqual(
		canonical.moveElementById(base, {
			elementId: "missing",
			toIndex: 0,
			now: NOW,
		}),
		base
	);
	assert.strictEqual(
		canonical.moveElementById(base, {
			elementId: base.editModel.elements[0].id,
			toIndex: 0,
			now: NOW,
		}),
		base
	);
	const empty = fixture();
	assert.strictEqual(canonical.clearElements(empty, { now: NOW }), empty);
});

test("read and find preserve aliases fallbacks and null results", () => {
	const elements = [{ id: "a" }, null, { id: "b" }];
	const value = { editModel: { elements } };
	assert.strictEqual(canonical.readAlignmentElements(value), elements);
	assert.strictEqual(canonical.findElementById(value, "a"), elements[0]);
	assert.equal(canonical.findElementById(value, "missing"), null);
	assert.equal(canonical.findElementById(value, ""), null);
	assert.deepEqual(canonical.readAlignmentElements(null), []);
});

test("unknown extensions key order mutation and aliasing remain unchanged", () => {
	const base = fixture();
	const changed = withGeneratedIds(() =>
		canonical.addStraightElement(base, { length: 10, now: NOW })
	);
	assert.deepEqual(Object.keys(changed), [
		"type",
		"id",
		"name",
		"source",
		"editModel",
		"sparseAlignment",
		"meta",
		"extensionEvidence",
	]);
	assert.notStrictEqual(changed, base);
	assert.notStrictEqual(changed.editModel, base.editModel);
	assert.notStrictEqual(changed.editModel.elements, base.editModel.elements);
	assert.strictEqual(changed.source, base.source);
	assert.strictEqual(changed.extensionEvidence, base.extensionEvidence);
	assert.deepEqual(base, fixture());
});
