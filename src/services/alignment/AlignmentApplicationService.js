// src/services/alignment/AlignmentApplicationService.js
//
// AlignmentApplicationService
//
// Application use cases for SPOT Alignment authoring.
//
// Responsibilities:
// - create native AlignmentData or derive an editable representation from SparseAlignment
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
// - import parsing or alteration of original import evidence
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
		return this._editActiveAlignmentSafe({
			source:
				"alignment-editor-add-straight",
			code: "ALIGNMENT_EDIT_STRAIGHT_REJECTED",

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
		return this._editActiveAlignmentSafe({
			source:
				"alignment-editor-remove-element",
			code: "ALIGNMENT_EDIT_REMOVE_REJECTED",

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
		return this._editActiveAlignmentSafe({
			source:
				"alignment-editor-update-straight-length",
			code: "ALIGNMENT_EDIT_STRAIGHT_REJECTED",

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
		return this._editActiveAlignmentSafe({
			source:
				"alignment-editor-clear-elements",
			code: "ALIGNMENT_EDIT_CLEAR_REJECTED",

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

		let alignmentData =
			this.mapper.readAlignmentDataFromSpotObject(
				spotObject
			);

		if (!this.hasNativeEditModel(alignmentData)) {
			alignmentData = this.materializeAlignmentDataFromSparse(spotObject);
		}

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

		this.assertStructurallyEditableSequence(nextAlignmentData);

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

	assertStructurallyEditableSequence(alignmentData) {
		const elements = Array.isArray(alignmentData?.editModel?.elements) ? alignmentData.editModel.elements : [];
		const fixed = (element) => ["straight", "arc"].includes(String(element?.type ?? "").toLowerCase());
		for (let index = 1; index < elements.length; index += 1) {
			if (fixed(elements[index - 1]) && fixed(elements[index])) {
				throw new Error(`adjacent fixed alignment elements require an explicit transition: ${String(elements[index - 1]?.id ?? index - 1)} -> ${String(elements[index]?.id ?? index)}`);
			}
		}
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

	materializeAlignmentDataFromSparse(spotObject) {
		const kernel = spotObject?.data?.kernel ?? spotObject?.data?.sparseAlignment ?? null;
		const sparse = Array.isArray(kernel?.sparse) ? kernel.sparse : (Array.isArray(kernel?.elements) ? kernel.elements : []);
		const startPose = kernel?.startPose ?? null;
		if (!startPose?.p || !startPose?.t || !sparse.length) return null;
		const elements = sparse.map((element) => {
			const kind = String(element?.kind ?? element?.meta?.sourceElementType ?? element?.type ?? "").toLowerCase();
			const length = Number(element?.arcLength ?? element?.length);
			if (kind === "straight" || element?.type === "fixed" && Number(element?.curvature) === 0) {
				return { id: String(element.id), type: "straight", length, parameters: { length } };
			}
			if (kind === "arc" || element?.type === "fixed") {
				const curvature = Number(element?.curvature);
				return { id: String(element.id), type: "arc", length, curvature, parameters: { length, curvature } };
			}
			if (kind === "transition" || element?.type === "transition") {
				const transitionType = String(element?.transType ?? element?.transitionType ?? "clothoid");
				const w1 = element?.opts?.w1, w2 = element?.opts?.w2;
				return { id: String(element.id), type: "transition", length, transitionType, opts: { ...(element?.opts ?? {}) }, parameters: { length, transitionType, ...(w1 != null ? { w1 } : {}), ...(w2 != null ? { w2 } : {}) } };
			}
			throw new Error(`Unsupported imported alignment element ${String(element?.id ?? "unknown")}`);
		});
		return {
			type: "AlignmentData",
			id: String(spotObject?.id ?? kernel?.id ?? "alignment"),
			name: spotObject?.data?.name ?? kernel?.name ?? spotObject?.id ?? "Alignment",
			source: {
				kind: "derived-edit-representation",
				native: false,
				derivedFrom: "sparseAlignment",
				originalImportEvidence: structuredClone(spotObject?.meta?.source ?? spotObject?.data?.meta?.source ?? null),
			},
			editModel: { startPose: { p: { ...startPose.p }, t: { ...startPose.t } }, elements },
			sparseAlignment: kernel,
		};
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
