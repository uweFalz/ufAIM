import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	createTransitionAxtranPreviewController,
} from "../../../app/controllers/transition-axtran/createTransitionAxtranPreviewController.js";

const ROOT = new URL("../../../", import.meta.url);
const INIT_URL = new URL("app/runtime/init/initFeatures.js", ROOT);
const BRIDGE_URL = new URL("app/controllers/bridges/transitionEditorBridge.js", ROOT);
const VIEW_URL = new URL("app/view/editors/transitionEditorView.js", ROOT);

function makeProjection() {
	const service = {
		resolveTransition() {
			return {
				descriptor: {
					id: "clothoid",
					family: "linear",
					meta: { source: "catalogue" },
				},
				record: { id: "clothoid", version: "transition/v1" },
			};
		},
		evaluate() {
			return {
				status: "evaluated",
				quantity: "curvature",
				value: 0.004,
			};
		},
		evaluateContinuity() {
			return {
				status: "evaluated",
				residuals: [{ id: "join-1", value: 0 }],
			};
		},
		solveContinuity() {
			return {
				candidate: { id: "candidate-1", state: "prepared" },
				validation: { ok: true, errors: [], warnings: [] },
			};
		},
		prepareAxtranInput() {
			return {
				contractVersion: "future-axtran-input/v1",
				status: "prepared-only",
			};
		},
	};
	const controller = createTransitionAxtranPreviewController({
		transitionAxtranApplicationService: service,
	});

	return controller.createPreview({
		active: {
			alignmentId: "alignment-1",
			revision: "revision-7",
			elementId: "element-3",
		},
		selected: {
			recordId: "clothoid",
			parameters: { w1: 0.25, w2: 0.75 },
		},
		evaluation: {
			quantity: "curvature",
			at: {
				role: "normalized-longitudinal-parameter",
				value: 0.5,
			},
		},
		continuityProblem: {
			knownParameters: {},
			freeParameters: [],
			fixedParameters: [],
			constraints: [],
			boundaryConditions: [],
		},
		axtranInput: {
			requestedOutputQuantities: ["curvature"],
		},
		provenance: {
			source: "transition-editor",
			alignmentRevision: "revision-7",
		},
	});
}

async function importViewForNode() {
	const source = await readFile(VIEW_URL, "utf8");
	const nodeSource = source
		.replace(
			/import \* as JXG from "jsxgraph";/,
			"const JXG = { JSXGraph: { initBoard() { throw new Error('not used'); } } };",
		)
		.replace(
			/import \{ clampNumber \} from "@utils\/helpers\.js";/,
			"const clampNumber = (value, min, max) => Math.max(min, Math.min(max, Number(value)));",
		);
	return import(`data:text/javascript;base64,${Buffer.from(nodeSource).toString("base64")}`);
}

test("visible Engineering Preview renders the complete unapplied projection", async () => {
	const {
		createTransitionAxtranEngineeringPreviewViewModel,
	} = await importViewForNode();
	const viewSource = await readFile(VIEW_URL, "utf8");
		const projection = makeProjection();
		const viewModel =
			createTransitionAxtranEngineeringPreviewViewModel(projection);

		assert.equal(viewModel.status, "unapplied");
		assert.deepEqual(
			viewModel.rows.map(([label]) => label),
			[
				"Active Alignment",
				"Descriptor / record",
				"Representative κ evaluation",
				"Continuity status / residuals",
				"Continuity candidate validation",
				"Prepared AXTRAN contract",
				"Provenance",
				"Structured errors",
			],
		);
	assert.match(viewSource, /Transition AXTRAN Engineering Preview/);
	assert.match(viewSource, /UNAPPLIED \/ NICHT ANGEWENDET/);
	assert.match(viewSource, /status\.dataset\.previewStatus = model\.status/);
	assert.equal(viewModel.rows[1][1].recordId, "clothoid");
	assert.equal(viewModel.rows[2][1].value, 0.004);
	assert.equal(viewModel.rows[3][1].residuals[0].id, "join-1");
	assert.equal(viewModel.rows[5][1].contractVersion, "future-axtran-input/v1");
	assert.equal(viewModel.rows[5][1].status, "prepared-only");
	assert.equal(viewModel.rows[6][1].alignmentRevision, "revision-7");
});

test("wiring uses productive catalogue/service injection and canonical active readback", async () => {
	const [initSource, bridgeSource] = await Promise.all([
		readFile(INIT_URL, "utf8"),
		readFile(BRIDGE_URL, "utf8"),
	]);

	assert.match(initSource, /new TransitionCatalogueAdapter\(\)/);
	assert.match(initSource, /new TransitionAxtranApplicationService\(/);
	assert.match(initSource, /createTransitionAxtranPreviewController\(/);
	assert.match(
		initSource,
		/previewController: transitionAxtranPreviewController/,
	);

	assert.match(bridgeSource, /workspace_selection/);
	assert.match(bridgeSource, /send\("Spot\.GetState", \{\}\)/);
	assert.match(bridgeSource, /alignmentData\?\.meta\?\.modifiedAt/);
	assert.match(bridgeSource, /previewController\.createPreview\(/);
	assert.match(
		bridgeSource,
		/view\?\.renderEngineeringPreview\?\.\(projection\)/,
	);
});

test("preview refresh path is read-only and cannot apply or persist Alignment state", async () => {
	const bridgeSource = await readFile(BRIDGE_URL, "utf8");
	const start = bridgeSource.indexOf("async function refreshEngineeringPreview");
	const end = bridgeSource.indexOf("\n\tasync function selectLevel", start);
	assert.ok(start >= 0 && end > start, "preview refresh function must be present");
	const previewPath = bridgeSource.slice(start, end);

	assert.match(previewPath, /readActiveAlignmentContext\(\)/);
	assert.doesNotMatch(
		previewPath,
		/Spot\.AddObjects|Spot\.RemoveObject|saveById|applyWorkingCopy|updateArc|alignmentRepository/,
	);
	assert.doesNotMatch(
		previewPath,
		/dispatchProductiveAlignmentChange|ufaim:alignment-changed/,
	);
});
