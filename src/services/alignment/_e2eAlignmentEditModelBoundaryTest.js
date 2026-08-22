// src/services/alignment/_e2eAlignmentEditModelBoundaryTest.js

import { AlignmentApplicationService } from "./AlignmentApplicationService.js";
import AlignmentProfileApplicationService from "./AlignmentProfileApplicationService.js";
import { AlignmentMapper } from "@src/model/spot/model/AlignmentSpotObjectMapper.js";
import { createAlignmentSpotObject } from "@src/model/spot/model/createAlignmentSpotObject.js";
import { validateSparseAlignment } from "@spot/validation/validateSparseAlignment.js";
import { projectFocusedSpotObject } from "@projection/ViewProjectionController.js";
import { buildSparseFromEditModel } from "@src/domain/alignment/editor/buildSparseAlignment.js";
import { makeAlignment2DFromSparse } from "@src/domain/alignment/build/AlignmentFactory.js";
import { RegistryResolver } from "@src/domain/transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "@src/domain/transition/build/KappaFcnBuilder.js";
import transitionLookup from "@src/domain/transition/transitionLookup.json" with { type: "json" };
import {
	appendVerticalElement,
	createVerticalConstructiveState,
} from "@src/aim-core/alignment/profile/VerticalConstructiveState.js";
import {
	appendCantElement,
	createCantConstructiveState,
} from "@src/aim-core/alignment/profile/CantConstructiveState.js";
import {
	appendChainageSegment,
	createChainageMapping,
} from "@src/aim-core/alignment/profile/ChainageMapping.js";

function assert(condition, message) {
	if (!condition) {
		throw new Error(`AlignmentEditModelBoundary E2E FAIL: ${message}`);
	}
}

function expectValidSparse(sparseAlignment, message) {
	const validation = validateSparseAlignment(sparseAlignment);
	assert(validation.ok, `${message} :: ${JSON.stringify(validation.errors)}`);
}

function makeGateway() {
	let active = null;
	let lastSaved = null;
	const saveCalls = [];
	const objects = new Map();

	return {
		gateway: {
			async getActiveAlignment() {
				return active;
			},
			async getObjectById(objectId) {
				return objects.get(objectId) ?? null;
			},
			async saveObject(object, opts = {}) {
				saveCalls.push({ object, opts });
				lastSaved = object;
				objects.set(object.id, object);
				if (opts.focus) active = object;
				return object;
			},
		},
		setActive(object) {
			active = object;
			if (object?.id) objects.set(object.id, object);
		},
		setObject(object) {
			if (object?.id) objects.set(object.id, object);
		},
		getLastSaved() {
			return lastSaved;
		},
		getSaveCalls() {
			return saveCalls;
		},
	};
}

const descriptorResolver = new RegistryResolver(transitionLookup);
const kappaBuilder = KappaFcnBuilder;

function buildAlignmentFromSparse(sparseAlignment) {
	const built = makeAlignment2DFromSparse({
		startPose: sparseAlignment.startPose,
		sparse: sparseAlignment.sparse,
		descriptorResolver,
		kappaBuilder,
	});

	assert(Array.isArray(built.warnings), "alignment build warnings contract missing");
	assert(built.warnings.length === 0, `alignment build warnings: ${JSON.stringify(built.warnings)}`);
	return built.alignment;
}

function makeComposedNativeAlignmentData({ id = "native_composed_1", name = "Native Composed" } = {}) {
	const now = new Date().toISOString();

	const alignmentData = {
		type: "AlignmentData",
		id,
		name,
		source: { kind: "editor", native: true },
		editModel: {
			startPose: {
				p: { x: 0, y: 0 },
				t: { x: 1, y: 0 },
			},
			elements: [
				{ id: "S0", type: "straight", parameters: { length: 80 }, length: 80 },
				{ id: "T1", type: "transition", parameters: { length: 40, transitionType: "bloss", w1: 0.2, w2: 0.85 }, length: 40, transitionType: "bloss", opts: { w1: 0.2, w2: 0.85 } },
				{ id: "A2", type: "arc", parameters: { length: 90, curvature: 1 / 250 }, length: 90, curvature: 1 / 250 },
				{ id: "T3", type: "transition", parameters: { length: 35, transitionType: "clothoid" }, length: 35, transitionType: "clothoid" },
				{ id: "A4", type: "arc", parameters: { length: 70, curvature: -1 / 300 }, length: 70, curvature: -1 / 300 },
				{ id: "T5", type: "transition", parameters: { length: 30, transitionType: "bloss", w1: 0.75, w2: 0.9 }, length: 30, transitionType: "bloss", opts: { w1: 0.75, w2: 0.9 } },
				{ id: "S6", type: "straight", parameters: { length: 40 }, length: 40 },
			],
		},
		sparseAlignment: null,
		meta: {
			lifecycle: "draft",
			dirty: true,
			createdAt: now,
			modifiedAt: now,
		},
	};

	alignmentData.sparseAlignment = buildSparseFromEditModel(alignmentData);
	return alignmentData;
}

function makeProfileState(alignmentId) {
	const vertical = appendVerticalElement(
		createVerticalConstructiveState({
			id: `${alignmentId}-vertical`,
			alignmentId,
		}),
		{
			id: "V",
			type: "constant-gradient",
			startS: 0,
			endS: 100,
			startElevation: 10,
			gradient: 0.01,
		}
	);
	const cant = appendCantElement(
		createCantConstructiveState({
			id: `${alignmentId}-cant`,
			alignmentId,
		}),
		{
			id: "C",
			type: "linear-cross-level",
			startS: 0,
			endS: 100,
			startCrossLevel: 0,
			crossLevelRate: 0.001,
		}
	);
	const chainageMapping = appendChainageSegment(
		createChainageMapping({
			id: `${alignmentId}-K-v1`,
			alignmentId,
			schemeId: "K",
			schemeVersion: "v1",
		}),
		{
			id: "K0",
			startS: 0,
			endS: 100,
			startAddress: 1000,
			direction: 1,
		}
	);
	return {
		vertical,
		cant,
		chainageMappings: [chainageMapping],
	};
}

function assertBoundaryContinuity(alignment, sparse, eps = 2e-3) {
	let s = 0;
	for (let i = 0; i < sparse.length - 1; i++) {
		s += Number(sparse[i].arcLength) || 0;
		const pL = alignment.pointAt(Math.max(0, s - 1e-6), { quality: "balanced" });
		const pR = alignment.pointAt(Math.min(alignment.arcLength, s + 1e-6), { quality: "balanced" });
		const d = Math.hypot(pR.x - pL.x, pR.y - pL.y);
		assert(d < eps, `boundary continuity failed at s=${s}, d=${d}`);
	}
}

function assertWorld2TrackRoundtrip(alignment, stations, offsets) {
	for (const s of stations) {
		const pose = alignment.poseAt(s, { quality: "balanced" });
		const n = { x: -pose.t.y, y: pose.t.x };

		for (const q of offsets) {
			const x = pose.p.x + q * n.x;
			const y = pose.p.y + q * n.y;
			const hit = alignment.world2Track(x, y, { samples: 160, refineSteps: 24 });

			assert(!!hit, `world2Track null at s=${s}, q=${q}`);
			assert(Math.abs(hit.s - s) < 0.2, `world2Track s mismatch at s=${s}, q=${q}, got ${hit.s}`);
			assert(Math.abs(hit.q - q) < 0.15, `world2Track q mismatch at s=${s}, q=${q}, got ${hit.q}`);
		}
	}
}

const alignmentEditModelBoundaryPromise = (async function runAlignmentEditModelBoundaryE2E() {
	console.log("AlignmentEditModelBoundary E2E starting...");

	const mapper = new AlignmentMapper();
	let windowState = {};
	const store = {
		getState() {
			return windowState;
		},
		actions: {
			setWorkspaceSelection(selection) {
				windowState = { ...windowState, workspace_selection: { ...selection } };
			},
		},
	};
	const gateway = makeGateway();
	const service = new AlignmentApplicationService({
		store,
		spotGateway: gateway.gateway,
		mapper,
	});

	const created = await service.newAlignment({ name: "E2E Alignment" });
	assert(created?.alignmentData?.type === "AlignmentData", "new alignment data missing");
	assert(created?.alignmentData?.editModel, "new alignment editModel missing");
	assert(created?.alignmentData?.sparseAlignment == null, "new alignment should not invent sparseAlignment");
	assert(
		JSON.stringify(created?.alignmentData?.profileState) ===
			JSON.stringify({
				vertical: null,
				cant: null,
				chainageMappings: [],
			}),
		"new alignment should carry explicit empty profileState"
	);
	assert(created?.spotObject?.data?.alignmentData?.editModel, "spotObject missing embedded alignmentData");
	assert(created?.spotObject?.data?.kernel == null, "new alignment kernel should be null");
	assert(gateway.getSaveCalls().at(-1)?.opts?.focus === true, "new alignment should request focus");
	gateway.setActive(created.spotObject);

	const added = await service.addStraight({ length: 50 });
	assert(added?.changed === true, "addStraight should change alignment");
	assert(Array.isArray(added?.alignmentData?.editModel?.elements), "addStraight editModel missing elements");
	assert(added.alignmentData.editModel.elements.length === 1, "addStraight should add one element");
	assert(added.alignmentData.editModel.elements[0]?.parameters?.length === 50, "initial straight length should be 50");
	assert(added.sparseAlignment?.type === "sparseAlignment", "addStraight should derive sparseAlignment");
	expectValidSparse(added.sparseAlignment, "derived sparse after addStraight");
	assert(added.spotObject?.data?.kernel, "addStraight spotObject should carry kernel");
	assert(added.spotObject?.data?.kernel === added.sparseAlignment, "kernel and sparseAlignment should be identical on update");
	assert(gateway.getSaveCalls().at(-1)?.opts?.focus === true, "edit should request focus");

	const updatedLength = await service.updateStraightLength({
		elementId: added.alignmentData.editModel.elements[0].id,
		length: 125,
	});
	assert(updatedLength?.changed === true, "updateStraightLength should change alignment");
	assert(updatedLength.alignmentData.editModel.elements.length === 1, "updateStraightLength should keep one element");
	assert(updatedLength.alignmentData.editModel.elements[0]?.parameters?.length === 125, "updated straight length should be 125");
	assert(updatedLength.sparseAlignment?.sparse?.[0]?.arcLength === 125, "sparse arcLength should reflect updated straight length");
	expectValidSparse(updatedLength.sparseAlignment, "derived sparse after updateStraightLength");

	const projectedAfterUpdate = projectFocusedSpotObject(updatedLength.spotObject, { maxStep: 2 });
	assert(Array.isArray(projectedAfterUpdate?.polyline2d) && projectedAfterUpdate.polyline2d.length >= 2, "updated alignment should project");

	const elementId = updatedLength.alignmentData.editModel.elements[0].id;
	store.actions.setWorkspaceSelection({
		primaryId: updatedLength.spotObject.id,
		contextIds: [],
		elementId,
		source: "alignment-edit-boundary-e2e",
		crsId: null,
	});
	const removed = await service.removeElement({ elementId });
	assert(removed?.changed === true, "removeElement should change alignment");
	assert(removed.alignmentData.editModel.elements.length === 0, "removeElement should clear elements");
	assert(removed.sparseAlignment == null, "removeElement on last element should clear sparseAlignment");
	assert(removed.spotObject?.data?.kernel == null, "removed alignment should not keep kernel");
	assert(gateway.getSaveCalls().at(-1)?.opts?.focus === true, "remove should request focus");
	assert(store.getState().workspace_selection.primaryId === removed.spotObject.id, "last-element removal should retain parent alignment selection");
	assert(store.getState().workspace_selection.elementId == null, "last-element removal should clear element selection");

	const rebuilt = await service.addStraight({ length: 25 });
	assert(rebuilt?.sparseAlignment?.type === "sparseAlignment", "rebuilt sparseAlignment missing");
	expectValidSparse(rebuilt.sparseAlignment, "derived sparse after rebuild");
	const cleared = await service.clearElements();
	assert(cleared?.changed === true, "clearElements should change alignment");
	assert(cleared.alignmentData.editModel.elements.length === 0, "clearElements should empty elements");
	assert(cleared.sparseAlignment == null, "clearElements should clear sparseAlignment");
	assert(cleared.spotObject?.data?.kernel == null, "cleared alignment should not keep kernel");
	assert(gateway.getSaveCalls().at(-1)?.opts?.focus === true, "clear should request focus");

	const importedSparse = {
		type: "sparseAlignment",
		version: "sparse_v1",
		startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
		sparse: [
			{
				type: "fixed",
				poseA: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
				arcLength: 10,
				curvature: 0,
			},
		],
	};

	const importedSpot = createAlignmentSpotObject({
		id: "imported_alignment",
		name: "Imported Alignment",
		kernel: importedSparse,
		sparseAlignment: importedSparse,
		alignmentData: null,
		meta: {
			source: {
				kind: "import",
				native: false,
				parserId: "landXML",
			},
		},
	});

	gateway.setActive(importedSpot);

	const importedProjected = projectFocusedSpotObject(importedSpot, { maxStep: 2 });
	assert(Array.isArray(importedProjected?.polyline2d) && importedProjected.polyline2d.length >= 2, "imported alignment should project");

	const importedElementId = service.materializeAlignmentDataFromSparse(importedSpot)?.editModel?.elements?.[0]?.id;
	const editedImport = await service.updateStraightLength({ elementId: importedElementId, length: 20 });
	assert(editedImport?.changed === true, "imported sparse alignment should support a derived edit representation");
	assert(editedImport?.alignmentData?.source?.kind === "derived-edit-representation", "derived import edit provenance kind missing");
	assert(editedImport?.alignmentData?.source?.native === false, "derived import edit representation must not claim native origin");
	assert(editedImport?.alignmentData?.source?.originalImportEvidence?.kind === "import", "original import evidence must remain attached");
	assert(editedImport?.spotObject?.meta?.source?.kind === "import", "SPOT import evidence must remain unchanged");
	expectValidSparse(editedImport.sparseAlignment, "edited imported alignment sparse valid");

	const adjacentFixed = await service.addStraight({ length: 25 });
	assert(adjacentFixed?.changed === false && adjacentFixed?.ok === false, "adjacent fixed elements must be rejected structurally");
	assert(adjacentFixed?.status === "rejected", "adjacent fixed rejection status missing");
	assert(adjacentFixed?.code === "ALIGNMENT_EDIT_STRAIGHT_REJECTED", "adjacent fixed rejection code missing");

	const composedAlignmentData = makeComposedNativeAlignmentData();
	const composedSpot = createAlignmentSpotObject({
		id: composedAlignmentData.id,
		name: composedAlignmentData.name,
		kernel: composedAlignmentData.sparseAlignment,
		sparseAlignment: composedAlignmentData.sparseAlignment,
		alignmentData: composedAlignmentData,
		meta: {
			source: { kind: "editor", native: true },
		},
	});

	gateway.setActive(composedSpot);

	assert(
		service.hasNativeEditModel(composedAlignmentData),
		"service should recognize valid constructive horizontal state"
	);
	const duplicateIdentity = structuredClone(composedAlignmentData);
	duplicateIdentity.editModel.elements[1].id =
		duplicateIdentity.editModel.elements[0].id;
	assert(
		!service.hasNativeEditModel(duplicateIdentity),
		"service should reject duplicate constructive element IDs"
	);
	const adjacentFixedState = structuredClone(composedAlignmentData);
	adjacentFixedState.editModel.elements = [
		adjacentFixedState.editModel.elements[0],
		adjacentFixedState.editModel.elements[2],
	];
	let adjacentFixedMessage = "";
	try {
		service.assertStructurallyEditableSequence(adjacentFixedState);
	} catch (error) {
		adjacentFixedMessage = String(error?.message ?? error);
	}
	assert(
		adjacentFixedMessage ===
			"adjacent fixed alignment elements require an explicit " +
				"transition: S0 -> A2",
		"service should preserve adjacent-fixed rejection text"
	);
	const emptyConstructiveState = structuredClone(composedAlignmentData);
	emptyConstructiveState.editModel.elements = [];
	assert(
		service.deriveSparseAlignmentFromEditModel(
			emptyConstructiveState
		) === null,
		"empty constructive horizontal state should realize to null"
	);
	const composedBeforeDerivation = structuredClone(
		composedAlignmentData
	);
	const composedRealization =
		service.deriveSparseAlignmentFromEditModel(
			composedAlignmentData
		);
	expectValidSparse(
		composedRealization,
		"domain-owned composed realization valid"
	);
	assert(
		JSON.stringify(composedAlignmentData) ===
			JSON.stringify(composedBeforeDerivation),
		"horizontal realization must preserve constructive input"
	);

	const explicitAlignmentData = makeComposedNativeAlignmentData({
		id: "explicit_non_active",
		name: "Explicit Non Active",
	});
	explicitAlignmentData.profileState = makeProfileState(
		explicitAlignmentData.id
	);
	explicitAlignmentData.source.provenance = {
		kind: "synthetic-e2e",
		reference: "profile-spine",
	};
	explicitAlignmentData.extension = {
		owner: "alignment-edit-boundary",
	};
	const explicitProfileBefore = structuredClone(
		explicitAlignmentData.profileState
	);
	const explicitKeysBefore = Object.keys(explicitAlignmentData);
	const explicitSpot = createAlignmentSpotObject({
		id: explicitAlignmentData.id,
		name: explicitAlignmentData.name,
		kernel: explicitAlignmentData.sparseAlignment,
		sparseAlignment: explicitAlignmentData.sparseAlignment,
		alignmentData: explicitAlignmentData,
		meta: { source: { kind: "editor", native: true } },
	});
	gateway.setObject(explicitSpot);
	store.actions.setWorkspaceSelection({
		primaryId: composedSpot.id,
		contextIds: ["retained-context"],
		elementId: "A2",
		source: "explicit-id-boundary-e2e",
	});
	const selectionBeforeExplicit = structuredClone(
		store.getState().workspace_selection
	);
	const explicitEdit = await service.updateArcByAlignmentId({
		alignmentId: explicitSpot.id,
		elementId: "A2",
		curvature: 1 / 225,
	});
	assert(explicitEdit?.status === "changed", "explicit-ID arc edit should change non-active alignment");
	assert(explicitEdit?.alignmentId === explicitSpot.id, "explicit-ID result identity mismatch");
	assert(explicitEdit?.alignmentState?.editModel?.elements?.find((e) => e.id === "A2")?.parameters?.curvature === 1 / 225, "explicit-ID arc curvature should update");
	assert(
		JSON.stringify(explicitEdit?.alignmentState?.profileState) ===
			JSON.stringify(explicitProfileBefore),
		"horizontal edit must preserve profileState"
	);
	assert(JSON.stringify(store.getState().workspace_selection) === JSON.stringify(selectionBeforeExplicit), "explicit-ID arc edit must preserve active selection byte-equivalently");
	assert(gateway.getSaveCalls().at(-1)?.opts?.focus === false, "explicit-ID adapter save must disable focus");
	const reloadedExplicit = await service.alignmentRepository.loadById(
		explicitSpot.id
	);
	assert(
		JSON.stringify(reloadedExplicit) ===
			JSON.stringify(explicitEdit.alignmentState),
		"repository reopen must preserve complete AlignmentData"
	);
	assert(
		JSON.stringify(reloadedExplicit.profileState) ===
			JSON.stringify(explicitProfileBefore),
		"repository reopen must preserve profileState"
	);
	assert(
		JSON.stringify(Object.keys(reloadedExplicit)) ===
			JSON.stringify(explicitKeysBefore),
		"repository reopen must preserve AlignmentData key order"
	);
	assert(
		reloadedExplicit.source.provenance.reference === "profile-spine" &&
			reloadedExplicit.extension.owner === "alignment-edit-boundary",
		"repository reopen must preserve provenance and unknown siblings"
	);
	const profileService = new AlignmentProfileApplicationService({
		alignmentRepository: service.alignmentRepository,
	});
	const reopenedEvaluation = await profileService.evaluateAt({
		alignmentId: explicitSpot.id,
		s: 50,
	});
	assert(
		reopenedEvaluation.vertical.value.elevation === 10.5 &&
			reopenedEvaluation.cant.value.crossLevel === 0.05 &&
			reopenedEvaluation.chainage.mappings[0].candidates[0]
				.address === 1050,
		"reopened profile evaluation must preserve vertical/cant/chainage values"
	);

	const baseSparse = composedSpot.data.kernel;
	expectValidSparse(baseSparse, "composed base sparse valid");
	const baseAlignment = buildAlignmentFromSparse(baseSparse);
	assertBoundaryContinuity(baseAlignment, baseSparse.sparse);

	const beforeArcPos = baseAlignment.pointAt(baseAlignment.arcLength, { quality: "balanced" });

	const posArcEdit = await service.updateArc({
		elementId: "A2",
		curvature: 1 / 220,
	});
	assert(posArcEdit?.changed === true, "positive arc edit should change alignment");
	assert(store.getState().workspace_selection.elementId === "A2", "active arc wrapper should preserve selected element");
	expectValidSparse(posArcEdit.sparseAlignment, "positive arc edit sparse valid");
	assert(posArcEdit.alignmentData.editModel.elements.find((e) => e.id === "A2")?.parameters?.curvature > 0, "positive arc curvature should remain positive");

	const negArcEdit = await service.updateArc({
		elementId: "A4",
		radius: -260,
	});
	assert(negArcEdit?.changed === true, "negative arc radius edit should change alignment");
	expectValidSparse(negArcEdit.sparseAlignment, "negative arc edit sparse valid");
	assert(negArcEdit.alignmentData.editModel.elements.find((e) => e.id === "A4")?.parameters?.curvature < 0, "negative arc curvature should remain negative");

	const arcLengthEdit = await service.updateArc({
		elementId: "A2",
		length: 110,
	});
	assert(arcLengthEdit?.changed === true, "arc length edit should change alignment");
	assert(arcLengthEdit.alignmentData.editModel.elements.find((e) => e.id === "A2")?.parameters?.length === 110, "arc length should update");

	const transitionLengthEdit = await service.updateTransition({
		elementId: "T1",
		length: 55,
	});
	assert(transitionLengthEdit?.changed === true, "transition length edit should change alignment");
	assert(transitionLengthEdit.alignmentData.editModel.elements.find((e) => e.id === "T1")?.parameters?.length === 55, "transition length should update");

	const transitionFamilyEdit = await service.updateTransition({
		elementId: "T3",
		transitionType: "bloss",
	});
	assert(transitionFamilyEdit?.changed === true, "transition family edit should change alignment");
	assert(transitionFamilyEdit.alignmentData.editModel.elements.find((e) => e.id === "T3")?.parameters?.transitionType === "bloss", "transition family should update to bloss");

	const transitionAsymEdit = await service.updateTransition({
		elementId: "T5",
		w1: 0.15,
		w2: 0.6,
	});
	assert(transitionAsymEdit?.changed === true, "transition asym edit should change alignment");
	const t5 = transitionAsymEdit.alignmentData.editModel.elements.find((e) => e.id === "T5");
	assert(t5?.parameters?.w1 === 0.15 && t5?.parameters?.w2 === 0.6, "transition asym parameters should update");

	const afterSparse = transitionAsymEdit.sparseAlignment;
	expectValidSparse(afterSparse, "post-edit composed sparse valid");
	const afterAlignment = buildAlignmentFromSparse(afterSparse);
	assertBoundaryContinuity(afterAlignment, afterSparse.sparse);

	const afterArcPos = afterAlignment.pointAt(afterAlignment.arcLength, { quality: "balanced" });
	const downstreamShift = Math.hypot(afterArcPos.x - beforeArcPos.x, afterArcPos.y - beforeArcPos.y);
	assert(downstreamShift > 1e-2, `downstream geometry should change after composed edits, shift=${downstreamShift}`);

	assertWorld2TrackRoundtrip(
		afterAlignment,
		[0, 50, 80, 135, 225, afterAlignment.arcLength - 1e-4, afterAlignment.arcLength],
		[-3, 0, 2.5]
	);

	const saveCountBeforeInvalid = gateway.getSaveCalls().length;
	const invalidArc = await service.updateArc({
		elementId: "A2",
		radius: 0,
	});
	assert(invalidArc?.changed === false, "invalid arc edit should not change alignment");
	assert(invalidArc?.ok === false, "invalid arc edit should be structured rejection");
	assert(gateway.getSaveCalls().length === saveCountBeforeInvalid, "invalid arc edit must not persist");

	const invalidTransitionLen = await service.updateTransition({
		elementId: "T1",
		length: -5,
	});
	assert(invalidTransitionLen?.changed === false, "invalid transition length should not change alignment");
	assert(invalidTransitionLen?.ok === false, "invalid transition length should be structured rejection");
	assert(gateway.getSaveCalls().length === saveCountBeforeInvalid, "invalid transition length must not persist");

	const unknownTransitionType = await service.updateTransition({
		elementId: "T3",
		transitionType: "not_a_family",
	});
	assert(unknownTransitionType?.changed === false, "unknown transition type should not change alignment");
	assert(unknownTransitionType?.ok === false, "unknown transition type should be structured rejection");
	assert(gateway.getSaveCalls().length === saveCountBeforeInvalid, "unknown transition type must not persist");

	const keepStraight = await service.updateStraightLength({
		elementId: "S0",
		length: 95,
	});
	assert(keepStraight?.changed === true, "straight path must remain operational after arc/transition edits");
	assert(keepStraight.alignmentData.editModel.elements.find((e) => e.id === "S0")?.parameters?.length === 95, "straight length should still update");
	expectValidSparse(keepStraight.sparseAlignment, "straight edit after composed edits should still derive sparse");

	if (typeof window !== "undefined") {
		window.__alignmentEditModelBoundaryE2E = {
			passed: true,
			ts: Date.now(),
			completedAt: new Date().toISOString(),
		};
	}

	console.log("AlignmentEditModelBoundary E2E PASSED");
})();

if (typeof window !== "undefined") window.__alignmentEditModelBoundaryE2EPromise = alignmentEditModelBoundaryPromise;
alignmentEditModelBoundaryPromise.catch((error) => {
	const message = String(error?.message ?? error);
	if (typeof window !== "undefined") window.__alignmentEditModelBoundaryE2E = { passed: false, error: message, ts: Date.now(), completedAt: new Date().toISOString() };
	console.error(`AlignmentEditModelBoundary E2E FAILED: ${message}`);
});
