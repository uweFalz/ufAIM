// src/services/alignment/AlignmentApplicationService.js
//
// AlignmentApplicationService
//
// Application use cases for native Alignment authoring.
//
// Responsibilities:
// - create native AlignmentData
// - load the active Alignment SpotObject
// - execute immutable Alignment edits
// - rebuild derived SparseAlignment
// - map AlignmentData to SpotObject
// - persist through SpotGateway
// - restore window-local workspace focus
//
// NOT:
// - rendering
// - projection
// - cockpit HTML
// - import parsing
// - SPOT storage implementation
// - direct messaging orchestration

import { createEmptyAlignmentData } from "@src/domain/alignment/editor/createEmptyAlignmentData.js";

import {
	addStraightElement,
	addArcElement,
	addTransitionElement,
	updateStraightLengthById,
	updateArcById,
	updateTransitionById,
	removeElementById,
	clearElements,
} from "@src/domain/alignment/editor/alignmentEditOps.js";

import { buildSparseFromEditModel } from "@src/domain/alignment/editor/buildSparseAlignment.js";
import { RegistryResolver } from "@src/domain/transition/registry/RegistryResolver.js";
import transitionLookup from "@src/domain/transition/transitionLookup.json" with { type: "json" };

import { AlignmentMapper } from "@src/model/spot/model/AlignmentSpotObjectMapper.js";

import { SpotGateway } from "./SpotGateway.js";

const transitionDescriptorResolver = new RegistryResolver(transitionLookup);

export class AlignmentApplicationService {
	constructor({
		store,
		messaging,
		spotGateway,
		mapper,
	} = {}) {
		this.store = store ?? null;
		this.messaging = messaging ?? null;

		if (!this.store?.getState) {
			throw new Error(
				"AlignmentApplicationService: missing store.getState"
			);
		}

		this.spotGateway =
			spotGateway ??
			new SpotGateway({
				store: this.store,
				messaging: this.messaging,
			});

		this.mapper =
			mapper ??
			new AlignmentMapper();
	}

	async newAlignment({
		name = "New Alignment",
	} = {}) {
		const alignmentData =
			createEmptyAlignmentData({
				name,
			});

		const spotObject =
			this.mapper.createAlignmentSpotObjectFromData(
				alignmentData
			);

		await this.spotGateway.saveObject(
			spotObject,
			{
				source: "alignment-editor-new",
				focus: true,
			}
		);

		return {
			changed: true,
			alignmentData,
			sparseAlignment:
				alignmentData.sparseAlignment ??
				null,
			spotObject,
		};
	}

	async addStraight({
		length = 100,
	} = {}) {
		return this._editActiveAlignment({
			source:
				"alignment-editor-add-straight",

			edit: (alignmentData) =>
				addStraightElement(
					alignmentData,
					{
						length,
					}
				),
		});
	}

	async addArc({
		length = 100,
		curvature,
		radius,
	} = {}) {
		return this._editActiveAlignmentSafe({
			source: "alignment-editor-add-arc",
			code: "ALIGNMENT_EDIT_ARC_REJECTED",
			edit: (alignmentData) =>
				addArcElement(alignmentData, {
					length,
					curvature,
					radius,
				}),
		});
	}

	async addTransition({
		length = 60,
		transitionType = "clothoid",
		w1,
		w2,
	} = {}) {
		return this._editActiveAlignmentSafe({
			source: "alignment-editor-add-transition",
			code: "ALIGNMENT_EDIT_TRANSITION_REJECTED",
			edit: (alignmentData) => {
				this._assertTransitionTypeSupported(transitionType);
				return addTransitionElement(alignmentData, {
					length,
					transitionType,
					w1,
					w2,
				});
			},
		});
	}

	async removeElement({
		elementId,
	} = {}) {
		return this._editActiveAlignment({
			source:
				"alignment-editor-remove-element",

			edit: (alignmentData) =>
				removeElementById(
					alignmentData,
					{
						elementId,
					}
				),
		});
	}

	async updateStraightLength({
		elementId,
		length,
	} = {}) {
		return this._editActiveAlignment({
			source:
				"alignment-editor-update-straight-length",

			edit: (alignmentData) =>
				updateStraightLengthById(
					alignmentData,
					{
						elementId,
						length,
					}
				),
		});
	}

	async updateArc({
		elementId,
		length,
		curvature,
		radius,
	} = {}) {
		return this._editActiveAlignmentSafe({
			source: "alignment-editor-update-arc",
			code: "ALIGNMENT_EDIT_ARC_REJECTED",
			edit: (alignmentData) =>
				updateArcById(alignmentData, {
					elementId,
					length,
					curvature,
					radius,
				}),
		});
	}

	async updateTransition({
		elementId,
		length,
		transitionType,
		w1,
		w2,
	} = {}) {
		return this._editActiveAlignmentSafe({
			source: "alignment-editor-update-transition",
			code: "ALIGNMENT_EDIT_TRANSITION_REJECTED",
			edit: (alignmentData) => {
				if (transitionType != null) {
					this._assertTransitionTypeSupported(transitionType);
				}

				return updateTransitionById(alignmentData, {
					elementId,
					length,
					transitionType,
					w1,
					w2,
				});
			},
		});
	}

	async clearElements() {
		return this._editActiveAlignment({
			source:
				"alignment-editor-clear-elements",

			edit: (alignmentData) =>
				clearElements(
					alignmentData
				),
		});
	}

	async _editActiveAlignment({
		source,
		edit,
	} = {}) {
		if (typeof edit !== "function") {
			throw new Error(
				"AlignmentApplicationService._editActiveAlignment: missing edit function"
			);
		}

		const spotObject =
			await this.spotGateway
				.getActiveAlignment();

		if (!spotObject) {
			return null;
		}

		const alignmentData =
			this.mapper.readAlignmentDataFromSpotObject(
				spotObject
			);

		if (!this.hasNativeEditModel(alignmentData)) {
			if (spotObject?.type === "alignment") {
				return this.makeNativeEditDeniedResult({
					spotObject,
					alignmentData,
					source: spotObject?.meta?.source ?? spotObject?.data?.meta?.source ?? null,
				});
			}

			return null;
		}

		const nextAlignmentData =
			edit(alignmentData);

		if (!nextAlignmentData) {
			throw new Error(
				"AlignmentApplicationService: edit returned no AlignmentData"
			);
		}

		if (
			nextAlignmentData ===
			alignmentData
		) {
			return {
				changed: false,
				alignmentData,
				sparseAlignment:
					alignmentData
						.sparseAlignment ??
					null,
				spotObject,
			};
		}

		const sparseAlignment =
			this.deriveSparseAlignmentFromEditModel(
				nextAlignmentData
			);

		const committedAlignmentData = {
			...nextAlignmentData,
			sparseAlignment,
		};

		const nextSpotObject =
			this.mapper.updateAlignmentSpotObjectFromData(
				spotObject,
				committedAlignmentData
			);

		await this.spotGateway.saveObject(
			nextSpotObject,
			{
				source,
				focus: true,
			}
		);

		return {
			changed: true,
			alignmentData:
				committedAlignmentData,
			sparseAlignment,
			spotObject:
				nextSpotObject,
		};
	}

	async _editActiveAlignmentSafe({
		source,
		code,
		edit,
	} = {}) {
		try {
			return await this._editActiveAlignment({ source, edit });
		} catch (err) {
			return {
				changed: false,
				ok: false,
				status: "rejected",
				code: code ?? "ALIGNMENT_EDIT_REJECTED",
				reason: String(err?.message ?? err),
			};
		}
	}

	_assertTransitionTypeSupported(transitionType) {
		const t = String(transitionType ?? "").trim().toLowerCase();
		if (!t) {
			throw new Error("transition type is required");
		}

		transitionDescriptorResolver.resolveTransitionDescriptor(t);
	}

	deriveSparseAlignmentFromEditModel(alignmentData) {
		const elements = Array.isArray(alignmentData?.editModel?.elements)
			? alignmentData.editModel.elements
			: [];

		if (!elements.length) {
			return null;
		}

		return buildSparseFromEditModel(alignmentData);
	}

	hasNativeEditModel(alignmentData) {
		return !!(
			alignmentData &&
			alignmentData.type === "AlignmentData" &&
			isObject(alignmentData.editModel)
		);
	}

	makeNativeEditDeniedResult({
		spotObject,
		alignmentData = null,
		source = null,
	} = {}) {
		const kernel = this.mapper.readAlignmentKernelFromSpotObject(spotObject);

		return {
			changed: false,
			editable: false,
			ok: false,
			status: "blocked",
			code: "NATIVE_EDIT_MODEL_REQUIRED",
			reason: "native_edit_model_required",
			objectId: spotObject?.id ?? null,
			alignmentData: alignmentData ?? null,
			sparseAlignment: kernel ?? null,
			spotObject,
			provenance: {
				source: isObject(source) ? source : null,
				native: alignmentData?.source?.native ?? false,
				kind: alignmentData?.source?.kind ?? source?.kind ?? null,
			},
		};
	}
}

function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

export default AlignmentApplicationService;
