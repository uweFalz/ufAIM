// src/services/alignment/_e2eAlignmentEditModelBoundaryTest.js

import { AlignmentApplicationService } from "./AlignmentApplicationService.js";
import { AlignmentMapper } from "@src/model/spot/model/AlignmentSpotObjectMapper.js";
import { createAlignmentSpotObject } from "@src/model/spot/model/createAlignmentSpotObject.js";
import { validateSparseAlignment } from "@spot/validation/validateSparseAlignment.js";
import { projectFocusedSpotObject } from "@projection/ViewProjectionController.js";
import { buildSparseFromEditModel } from "@src/domain/alignment/editor/buildSparseAlignment.js";
import { makeAlignment2DFromSparse } from "@src/domain/alignment/build/AlignmentFactory.js";
import { RegistryResolver } from "@src/domain/transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "@src/domain/transition/build/KappaFcnBuilder.js";
import transitionLookup from "@src/domain/transition/transitionLookup.json" with { type: "json" };

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

	return {
		gateway: {
			async getActiveAlignment() {
				return active;
			},
			async saveObject(object, opts = {}) {
				saveCalls.push({ object, opts });
				lastSaved = object;
				active = object;
				return object;
			},
		},
		setActive(object) {
			active = object;
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

(async function runAlignmentEditModelBoundaryE2E() {
	console.log("AlignmentEditModelBoundary E2E starting...");

	const mapper = new AlignmentMapper();
	const store = {
		getState() {
			return {};
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
	const removed = await service.removeElement({ elementId });
	assert(removed?.changed === true, "removeElement should change alignment");
	assert(removed.alignmentData.editModel.elements.length === 0, "removeElement should clear elements");
	assert(removed.sparseAlignment == null, "removeElement on last element should clear sparseAlignment");
	assert(removed.spotObject?.data?.kernel == null, "removed alignment should not keep kernel");
	assert(gateway.getSaveCalls().at(-1)?.opts?.focus === true, "remove should request focus");

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

	const denied = await service.addStraight({ length: 25 });
	assert(denied?.changed === false, "imported alignment must not edit");
	assert(denied?.editable === false, "imported alignment must be marked non-editable");
	assert(denied?.code === "NATIVE_EDIT_MODEL_REQUIRED", "imported edit denial code missing");
	assert(denied?.provenance?.kind === "import", "imported provenance kind missing");
	assert(denied?.provenance?.native === false, "imported provenance native flag missing");

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
		};
	}

	console.log("AlignmentEditModelBoundary E2E PASSED");
})();
