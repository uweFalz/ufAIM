import assert from "node:assert/strict";
import test from "node:test";

import {
	AlignmentProfileProjectionControllerError,
	createAlignmentProfileProjectionController,
} from "../../../app/controllers/alignment-profile/createAlignmentProfileProjectionController.js";
import { createAlignmentProfileViewModel } from "../../../app/controllers/alignment-profile/createAlignmentProfileViewModel.js";
import { AlignmentProfileSynchronizedView } from "../../../app/view/alignment-profile/AlignmentProfileSynchronizedView.js";

const alignmentId = "alignment-profile-1";
const revision = Object.freeze({ id: "R9", parentId: "R8" });

function projection(overrides = {}) {
	return Object.freeze({
		status: "projected",
		alignmentId,
		revision,
		cursor: Object.freeze({
			parameterKind: "intrinsic-s",
			s: 125,
		}),
		profileStatePresence: "present",
		vertical: Object.freeze({
			status: "unknown",
			reason: "VERTICAL_NOT_COVERED",
		}),
		chainage: Object.freeze({
			status: "ambiguous",
			candidates: Object.freeze([{ id: "mapping-1" }]),
		}),
		cant: Object.freeze({
			status: "partial",
			reference: Object.freeze({
				status: "partial",
				workingReference: "midpointGoverningRailEdges",
				sourceReference: Object.freeze({
					status: "unknown",
					reason: "SOURCE_REFERENCE_NOT_AVAILABLE",
				}),
			}),
		}),
		...overrides,
	});
}

function serviceReturning(result) {
	const calls = [];
	return {
		calls,
		service: {
			async projectAt(request) {
				calls.push(request);
				return result;
			},
		},
	};
}

function expectControllerError(code, action) {
	return assert.rejects(action, (error) => {
		assert.equal(
			error instanceof AlignmentProfileProjectionControllerError,
			true
		);
		assert.equal(error.code, code);
		return true;
	});
}

test("controller delegates the explicit cursor and returns the matching service projection without mutation", async () => {
	const expected = projection();
	const injected = serviceReturning(expected);
	const controller = createAlignmentProfileProjectionController({
		alignmentProfileApplicationService: injected.service,
	});
	const context = { alignmentId, revision, s: 125 };

	const actual = await controller.projectAt(context);

	assert.strictEqual(actual, expected);
	assert.deepEqual(injected.calls, [{ alignmentId, s: 125 }]);
	assert.deepEqual(context, { alignmentId, revision, s: 125 });
	assert.equal(Object.isFrozen(controller), true);
});

test("controller rejects invalid service shape and explicit context", async () => {
	assert.throws(
		() => createAlignmentProfileProjectionController(),
		(error) =>
			error instanceof AlignmentProfileProjectionControllerError &&
			error.code === "INVALID_SERVICE"
	);
	const controller = createAlignmentProfileProjectionController({
		alignmentProfileApplicationService: {
			async projectAt() {
				return projection();
			},
		},
	});
	await expectControllerError("INVALID_CONTEXT", () =>
		controller.projectAt({ alignmentId, s: 125 })
	);
	await expectControllerError("INVALID_CONTEXT", () =>
		controller.projectAt({ alignmentId, revision, s: Number.NaN })
	);
});

test("controller rejects alignment, revision, and cursor mismatches deterministically", async () => {
	const cases = [
		[
			"ALIGNMENT_MISMATCH",
			projection({ alignmentId: "alignment-other" }),
		],
		[
			"REVISION_MISMATCH",
			projection({ revision: { id: "R8", parentId: "R7" } }),
		],
		[
			"CURSOR_MISMATCH",
			projection({
				cursor: { parameterKind: "intrinsic-s", s: 124 },
			}),
		],
		[
			"CURSOR_MISMATCH",
			projection({
				cursor: { parameterKind: "chainage", s: 125 },
			}),
		],
	];
	for (const [code, result] of cases) {
		const injected = serviceReturning(result);
		const controller = createAlignmentProfileProjectionController({
			alignmentProfileApplicationService: injected.service,
		});
		await expectControllerError(code, () =>
			controller.projectAt({ alignmentId, revision, s: 125 })
		);
	}
});

test("view model retains the exact evaluated fields and uncertain statuses without inference", () => {
	const source = projection();
	const model = createAlignmentProfileViewModel(source);

	assert.equal(Object.isFrozen(model), true);
	assert.strictEqual(model.revision, source.revision);
	assert.strictEqual(model.cursor, source.cursor);
	assert.strictEqual(model.vertical, source.vertical);
	assert.strictEqual(model.chainage, source.chainage);
	assert.strictEqual(model.cant, source.cant);
	assert.equal(model.vertical.status, "unknown");
	assert.equal(model.chainage.status, "ambiguous");
	assert.equal(model.cant.status, "partial");
	assert.equal(model.cant.reference.status, "partial");
	assert.equal(
		model.cant.reference.workingReference,
		"midpointGoverningRailEdges"
	);
	assert.equal(
		model.cant.reference.sourceReference.status,
		"unknown"
	);
});

class FakeElement {
	constructor(tagName, ownerDocument) {
		this.tagName = tagName;
		this.ownerDocument = ownerDocument;
		this.dataset = {};
		this.children = [];
		this.textContent = "";
	}

	append(...children) {
		this.children.push(...children);
	}

	replaceChildren(...children) {
		this.children = children;
	}
}

test("dedicated view renders only the injected view model into its injected host", () => {
	const documentRef = {
		createElement(tagName) {
			return new FakeElement(tagName, documentRef);
		},
	};
	const host = new FakeElement("host", documentRef);
	const source = projection();
	const model = createAlignmentProfileViewModel(source);
	const view = new AlignmentProfileSynchronizedView({ host });

	const root = view.render(model);

	assert.strictEqual(host.children[0], root);
	assert.equal(root.dataset.alignmentProfile, alignmentId);
	assert.equal(root.dataset.profilePresence, "present");
	assert.deepEqual(
		root.children.map((section) => section.dataset.profileSection),
		["vertical", "chainage", "cant"]
	);
	assert.match(root.children[0].children[1].textContent, /"unknown"/);
	assert.match(root.children[1].children[1].textContent, /"ambiguous"/);
	assert.match(root.children[2].children[1].textContent, /"partial"/);
	assert.match(
		root.children[2].children[1].textContent,
		/"midpointGoverningRailEdges"/
	);
	assert.strictEqual(model.cant, source.cant);
});
