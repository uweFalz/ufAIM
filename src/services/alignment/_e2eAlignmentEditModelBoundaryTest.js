// src/services/alignment/_e2eAlignmentEditModelBoundaryTest.js

import { AlignmentApplicationService } from "./AlignmentApplicationService.js";
import { AlignmentMapper } from "@src/model/spot/model/AlignmentSpotObjectMapper.js";
import { createAlignmentSpotObject } from "@src/model/spot/model/createAlignmentSpotObject.js";
import { validateSparseAlignment } from "@spot/validation/validateSparseAlignment.js";
import { projectFocusedSpotObject } from "@projection/ViewProjectionController.js";

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
	assert(added.sparseAlignment?.type === "sparseAlignment", "addStraight should derive sparseAlignment");
	expectValidSparse(added.sparseAlignment, "derived sparse after addStraight");
	assert(added.spotObject?.data?.kernel, "addStraight spotObject should carry kernel");
	assert(added.spotObject?.data?.kernel === added.sparseAlignment, "kernel and sparseAlignment should be identical on update");
	assert(gateway.getSaveCalls().at(-1)?.opts?.focus === true, "edit should request focus");

	const elementId = added.alignmentData.editModel.elements[0].id;
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

	if (typeof window !== "undefined") {
		window.__alignmentEditModelBoundaryE2E = {
			passed: true,
			ts: Date.now(),
		};
	}

	console.log("AlignmentEditModelBoundary E2E PASSED");
})();
