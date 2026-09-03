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
import { materializeAlignmentDataFromSparse } from "@src/domain/alignment/editor/materializeAlignmentDataFromSparse.js";

import {
	addStraightElement,
	addArcElement,
	addTransitionElement,
	updateStraightLengthById,
	updateArcById,
	updateTransitionById,
	removeElementById,
	clearElements,
	findElementById,
} from "@src/domain/alignment/editor/alignmentEditOps.js";

import {
	isHorizontalConstructiveState,
	assertEditableHorizontalSequence,
	deriveSparseHorizontalRealization,
} from "@src/domain/alignment/horizontal/HorizontalConstructiveState.js";
import { RegistryResolver } from "@src/domain/transition/registry/RegistryResolver.js";
import transitionLookup from "@src/domain/transition/transitionLookup.json" with { type: "json" };

import { AlignmentMapper } from "@src/model/spot/model/AlignmentSpotObjectMapper.js";

import { SpotGateway } from "./SpotGateway.js";
import { SpotAlignmentRepositoryAdapter } from "./SpotAlignmentRepositoryAdapter.js";
import {
	ALIGNMENT_AUTHORING_CONTRACT_VERSION,
	ALIGNMENT_AUTHORING_RESULT_VERSION,
	validateAlignmentAuthoringRequest,
} from "@src/aim-core/alignment/authoring/AlignmentAuthoringContract.js";
import { assertAlignmentRepositoryPort } from "@src/aim-core/alignment/authoring/AlignmentRepositoryPort.js";

const transitionDescriptorResolver = new RegistryResolver(transitionLookup);
const histories = new WeakMap();
const HISTORY_LIMIT = 32;

export class AlignmentApplicationService {
	constructor({
		store,
		messaging,
		spotGateway,
		mapper,
		alignmentRepository,
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

		this.alignmentRepository =
			alignmentRepository ??
			new SpotAlignmentRepositoryAdapter({
				spotGateway: this.spotGateway,
				mapper: this.mapper,
			});
		assertAlignmentRepositoryPort(this.alignmentRepository);
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
				alignmentData,
				{
					crsId: null,
					crsStatus: "local-cartesian",
					meta: {
						source: { kind: "native", native: true },
						engineeringCrsId: "engineering-nullCRS",
						placementMode: "local-cartesian",
					},
				}
			);

		const previousSelection = structuredClone(this.store.getState()?.workspace_selection ?? null);

		const saved =
			await this.spotGateway.saveObject(
			spotObject,
			{
				source: "alignment-editor-new",
				focus: true,
			}
		);
		const storedSpotObject =
			saved?.spotObject ??
			saved ??
			null;
		const storedAlignmentData =
			this.mapper.readAlignmentDataFromSpotObject(
				storedSpotObject
			);
		this._assertPersistedAlignment({
			requestedAlignmentData: alignmentData,
			storedAlignmentData,
			storedSpotObject,
		});
		this._pushHistory({ kind: "create", objectId: spotObject.id, previousSelection });

		return {
			changed: true,
			alignmentData: storedAlignmentData,
			sparseAlignment:
				storedAlignmentData.sparseAlignment ??
				null,
			spotObject: storedSpotObject,
			alignmentChange: this._makeAlignmentChange({
				source: "alignment-editor-new",
				alignmentData: storedAlignmentData,
				spotObject: storedSpotObject,
			}),
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

	async addTransitionArc({
		transitionLength = 60,
		arcLength = 100,
		curvature,
		radius,
		transitionType = "clothoid",
		w1,
		w2,
	} = {}) {
		return this._editActiveAlignmentSafe({
			source: "alignment-editor-add-transition-arc",
			code: "ALIGNMENT_EDIT_TRANSITION_ARC_REJECTED",
			edit: (alignmentData) => {
				this._assertTransitionTypeSupported(transitionType);
				const withTransition = addTransitionElement(alignmentData, { length: transitionLength, transitionType, w1, w2 });
				return addArcElement(withTransition, { length: arcLength, curvature, radius });
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
			selectAfterEdit: ({ previousSelection, previousAlignmentData, nextAlignmentData, spotObject }) => {
				const previousElements = previousAlignmentData?.editModel?.elements ?? [];
				const nextElements = nextAlignmentData?.editModel?.elements ?? [];
				const removedIndex = previousElements.findIndex(
					(element) => String(element?.id ?? "") === String(elementId ?? "")
				);
				if (removedIndex < 0) return previousSelection;
				return {
					...(previousSelection ?? {}),
					primaryId: spotObject?.id ?? previousSelection?.primaryId ?? null,
					elementId: nextElements[removedIndex]?.id
						?? nextElements[removedIndex - 1]?.id
						?? null,
					source: "alignment-editor-remove-element",
				};
			},
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
		const active = await this.spotGateway.getActiveAlignment();
		if (!active) {
			return {
				changed: false,
				ok: false,
				status: "rejected",
				code: "ALIGNMENT_EDIT_ARC_REJECTED",
				reason: "no active Alignment",
			};
		}

		const previousSelection = structuredClone(
			this.store.getState()?.workspace_selection ?? null
		);
		const originalSpotObject = structuredClone(active);
		const activeAlignmentData =
			this.mapper.readAlignmentDataFromSpotObject(active);
		let explicitContext = this;
		if (!this.hasNativeEditModel(activeAlignmentData)) {
			const materialized =
				this.materializeAlignmentDataFromSparse(active);
			if (this.hasNativeEditModel(materialized)) {
				const repository = this.alignmentRepository;
				explicitContext = Object.create(this);
				explicitContext.alignmentRepository = {
					loadById: async (alignmentId) =>
						alignmentId === active.id
							? structuredClone(materialized)
							: repository.loadById(alignmentId),
					saveById: (alignmentId, alignmentState) =>
						repository.saveById(alignmentId, alignmentState),
				};
			}
		}
		const result = await this.updateArcByAlignmentId.call(explicitContext, {
			alignmentId: active.id,
			elementId,
			length,
			curvature,
			radius,
		});

		if (result.status !== "changed") {
			return {
				changed: false,
				ok: false,
				status: "rejected",
				code: "ALIGNMENT_EDIT_ARC_REJECTED",
				reason: result.reason,
			};
		}

		const recommendation = result.focusRecommendation;
		if (recommendation && this.store.actions?.setWorkspaceSelection) {
			this.store.actions.setWorkspaceSelection({
				...(previousSelection ?? {}),
				primaryId: recommendation.alignmentId,
				elementId: recommendation.elementId,
				source: "alignment-editor-update-arc",
			});
		}
		this._pushHistory({
			kind: "edit",
			previousObject: originalSpotObject,
			previousSelection,
		});

		const spotObject =
			await this.spotGateway.getObjectById(result.alignmentId);
		this._assertPersistedAlignment({
			requestedAlignmentData: result.alignmentState,
			storedAlignmentData:
				this.mapper.readAlignmentDataFromSpotObject(
					spotObject
				),
			storedSpotObject: spotObject,
			elementId: result.elementId,
		});
		return {
			changed: true,
			alignmentData: result.alignmentState,
			sparseAlignment: result.alignmentState.sparseAlignment ?? null,
			spotObject,
			alignmentChange: this._makeAlignmentChange({
				source: "alignment-editor-update-arc",
				elementId: result.elementId,
				alignmentData: result.alignmentState,
				spotObject,
			}),
		};
	}

	async updateArcByAlignmentId({
		contractVersion = ALIGNMENT_AUTHORING_CONTRACT_VERSION,
		alignmentId,
		elementId,
		length,
		curvature,
		radius,
	} = {}) {
		const changes = {};
		if (length !== undefined) changes.length = length;
		if (curvature !== undefined) changes.curvature = curvature;
		if (radius !== undefined) changes.radius = radius;
		const validation = validateAlignmentAuthoringRequest({
			contractVersion,
			alignmentId,
			operation: "update-arc",
			elementId,
			changes,
		});
		if (!validation.ok) {
			return this._rejectExplicitArc({
				alignmentId,
				elementId,
				code: "INVALID_REQUEST",
				reason: validation.reason,
			});
		}

		const request = validation.value;
		const loaded = await this.alignmentRepository.loadById(
			request.alignmentId
		);
		if (!loaded) {
			return this._rejectExplicitArc({
				alignmentId: request.alignmentId,
				elementId: request.elementId,
				code: "ALIGNMENT_NOT_FOUND",
				reason: `Alignment ${request.alignmentId} was not found`,
			});
		}
		if (loaded.id !== request.alignmentId) {
			return this._rejectExplicitArc({
				alignmentId: request.alignmentId,
				elementId: request.elementId,
				code: "ALIGNMENT_ID_MISMATCH",
				reason: "Loaded Alignment ID does not match request",
			});
		}
		if (!this.hasNativeEditModel(loaded)) {
			return this._rejectExplicitArc({
				alignmentId: request.alignmentId,
				elementId: request.elementId,
				code: "CONSTRUCTIVE_SEQUENCE_REJECTED",
				reason: "native AlignmentData.editModel is required",
			});
		}

		const snapshot = structuredClone(loaded);
		const element = findElementById(snapshot, request.elementId);
		if (!element) {
			return this._rejectExplicitArc({
				alignmentId: request.alignmentId,
				elementId: request.elementId,
				code: "ELEMENT_NOT_FOUND",
				reason: `Element ${request.elementId} was not found`,
			});
		}
		if (String(element.type).toLowerCase() !== "arc") {
			return this._rejectExplicitArc({
				alignmentId: request.alignmentId,
				elementId: request.elementId,
				code: "ELEMENT_TYPE_MISMATCH",
				reason: `Element ${request.elementId} is not an arc`,
			});
		}
		if (
			!arcChangesHaveEffect(
				element,
				request.changes
			)
		) {
			return this._rejectExplicitArc({
				alignmentId: request.alignmentId,
				elementId: request.elementId,
				code: "NO_EFFECT",
				reason: "Alignment arc update produced no element change",
			});
		}

		let committedAlignmentData;
		try {
			const effectiveChanges =
				Object.prototype.hasOwnProperty.call(
					request.changes,
					"curvature"
				)
					? {
						...request.changes,
						curvature: undefined,
						radius:
							1 /
							request.changes
								.curvature,
					}
					: request.changes;
			const changed = updateArcById(snapshot, {
				elementId: request.elementId,
				...effectiveChanges,
			});
			const changedElement =
				findElementById(
					changed,
					request.elementId
				);
			if (
				samePlainData(
					element,
					changedElement
				)
			) {
				return this._rejectExplicitArc({
					alignmentId: request.alignmentId,
					elementId: request.elementId,
					code: "NO_EFFECT",
					reason: "Alignment arc update produced no element change",
				});
			}
			this.assertStructurallyEditableSequence(changed);
			committedAlignmentData = {
				...ensureAdvancedRevision(
					changed,
					loaded
				),
				sparseAlignment:
					this.deriveSparseAlignmentFromEditModel(changed),
			};
		} catch (error) {
			const reason = String(error?.message ?? error);
			const sequenceFailure =
				reason.includes("adjacent fixed") ||
				reason.includes("sparse sequence") ||
				reason.includes("buildSparse");
			return this._rejectExplicitArc({
				alignmentId: request.alignmentId,
				elementId: request.elementId,
				code: sequenceFailure
					? "CONSTRUCTIVE_SEQUENCE_REJECTED"
					: "INVALID_ARC_PARAMETERS",
				reason,
			});
		}

		let stored;
		try {
			stored = await this.alignmentRepository.saveById(
				request.alignmentId,
				committedAlignmentData
			);
			this._assertPersistedAlignment({
				requestedAlignmentData: committedAlignmentData,
				storedAlignmentData: stored,
				previousRevision: loaded?.meta?.modifiedAt ?? null,
				elementId: request.elementId,
			});
		} catch (error) {
			return this._rejectExplicitArc({
				alignmentId: request.alignmentId,
				elementId: request.elementId,
				code: "PERSISTENCE_ACKNOWLEDGEMENT_REJECTED",
				reason: String(error?.message ?? error),
			});
		}
		return {
			contractVersion: ALIGNMENT_AUTHORING_RESULT_VERSION,
			status: "changed",
			alignmentId: request.alignmentId,
			elementId: request.elementId,
			alignmentState: stored,
			focusRecommendation: {
				alignmentId: request.alignmentId,
				elementId: request.elementId,
			},
		};
	}

	_rejectExplicitArc({
		alignmentId,
		elementId,
		code,
		reason,
	}) {
		return {
			contractVersion: ALIGNMENT_AUTHORING_RESULT_VERSION,
			status: "rejected",
			alignmentId:
				typeof alignmentId === "string" ? alignmentId.trim() : "",
			elementId:
				typeof elementId === "string" && elementId.trim()
					? elementId.trim()
					: null,
			code,
			reason: String(reason || "Alignment arc update rejected"),
			focusRecommendation: null,
		};
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

	async undo() {
		const history = this._history();
		const entry = history.pop();
		if (!entry) return { changed: false, ok: false, status: "rejected", code: "ALIGNMENT_UNDO_EMPTY", reason: "no alignment edit to undo" };
		try {
			if (entry.kind === "create") {
				await this.messaging.sendCmdAwait("Spot.RemoveObject", { objectId: entry.objectId, source: "alignment-creation-undo" });
			} else if (entry.kind === "edit" && entry.previousObject) {
				await this.spotGateway.saveObject(entry.previousObject, { source: "alignment-edit-undo", focus: true });
			} else {
				throw new Error("unsupported alignment undo record");
			}
			if (entry.previousSelection && this.store.actions?.setWorkspaceSelection) this.store.actions.setWorkspaceSelection(entry.previousSelection);
			else if (entry.kind === "create") this.store.actions?.clearWorkspaceSelection?.();
			return { changed: true, ok: true, status: "undone", kind: entry.kind, objectId: entry.objectId ?? entry.previousObject?.id ?? null };
		} catch (error) {
			history.push(entry);
			return { changed: false, ok: false, status: "rejected", code: "ALIGNMENT_UNDO_REJECTED", reason: String(error?.message ?? error) };
		}
	}

	canUndo() {
		return this._history().length > 0;
	}

	getUndoDepth() {
		return this._history().length;
	}

	restoreUndoDepth(depth) {
		const history = this._history();
		const target = Math.max(0, Math.min(history.length, Math.trunc(Number(depth) || 0)));
		history.splice(target);
		return history.length;
	}

	_history() {
		let history = histories.get(this.store);
		if (!history) { history = []; histories.set(this.store, history); }
		return history;
	}

	_pushHistory(entry) {
		const history = this._history();
		history.push(structuredClone(entry));
		if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
	}

	async _editActiveAlignment({
		source,
		edit,
		selectAfterEdit,
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
			...ensureAdvancedRevision(
				nextAlignmentData,
				alignmentData
			),
			sparseAlignment,
		};

		const nextSpotObject =
			this.mapper.updateAlignmentSpotObjectFromData(
				spotObject,
				committedAlignmentData
			);
		const previousSelection = structuredClone(this.store.getState()?.workspace_selection ?? null);

		const saved =
			await this.spotGateway.saveObject(
			nextSpotObject,
			{
				source,
				focus: true,
			}
		);
		const storedSpotObject =
			saved?.spotObject ??
			saved ??
			null;
		const storedAlignmentData =
			this.mapper.readAlignmentDataFromSpotObject(
				storedSpotObject
			);
		this._assertPersistedAlignment({
			requestedAlignmentData: committedAlignmentData,
			storedAlignmentData,
			storedSpotObject,
			previousRevision: alignmentData?.meta?.modifiedAt ?? null,
		});
		// Saving with focus keeps the edited object active, but object focus is
		// intentionally narrower than the full workspace selection and may clear
		// the selected alignment element. An edit must retain that element focus;
		// dependent views decide later whether it became stale (for example after
		// removing the selected element).
		if (previousSelection && this.store.actions?.setWorkspaceSelection) {
			const nextSelection = typeof selectAfterEdit === "function"
				? selectAfterEdit({
					previousSelection,
					previousAlignmentData: alignmentData,
					nextAlignmentData: storedAlignmentData,
					spotObject: storedSpotObject,
				})
				: previousSelection;
			this.store.actions.setWorkspaceSelection(nextSelection ?? previousSelection);
		}
		this._pushHistory({
			kind: "edit",
			previousObject: spotObject,
			previousSelection,
		});

		return {
			changed: true,
			alignmentData:
				storedAlignmentData,
			sparseAlignment:
				storedAlignmentData.sparseAlignment,
			spotObject:
				storedSpotObject,
			alignmentChange: this._makeAlignmentChange({
				source,
				elementId: this.store.getState()?.workspace_selection?.elementId ?? null,
				alignmentData: storedAlignmentData,
				spotObject: storedSpotObject,
			}),
		};
	}

	_assertPersistedAlignment({
		requestedAlignmentData,
		storedAlignmentData,
		storedSpotObject = null,
		previousRevision = null,
		elementId = null,
	} = {}) {
		if (
			!storedAlignmentData ||
			storedAlignmentData.id !== requestedAlignmentData?.id ||
			(storedSpotObject && (
				storedSpotObject.type !== "alignment" ||
				storedSpotObject.id !== requestedAlignmentData?.id
			)) ||
			!samePlainData(
				storedAlignmentData,
				requestedAlignmentData
			) ||
			!samePlainData(
				storedAlignmentData?.sparseAlignment ?? null,
				requestedAlignmentData?.sparseAlignment ?? null
			)
		) {
			throw new Error(
				"AlignmentApplicationService: persisted Alignment acknowledgement mismatch"
			);
		}
		const revision =
			storedAlignmentData?.meta?.modifiedAt ??
			storedSpotObject?.meta?.modifiedAt ??
			null;
		if (
			previousRevision != null &&
			!revisionAdvances(
				revision,
				previousRevision
			)
		) {
			throw new Error(
				"AlignmentApplicationService: persisted Alignment revision did not advance"
			);
		}
		if (
			elementId &&
			!findElementById(
				storedAlignmentData,
				elementId
			)
		) {
			throw new Error(
				"AlignmentApplicationService: persisted edited element missing"
			);
		}
		return storedAlignmentData;
	}

	_makeAlignmentChange({
		source,
		elementId = null,
		alignmentData,
		spotObject,
	} = {}) {
		return {
			objectId: spotObject?.id ?? alignmentData?.id ?? null,
			elementId: elementId == null ? null : String(elementId),
			revision: alignmentData?.meta?.modifiedAt ?? spotObject?.meta?.modifiedAt ?? null,
			source: String(source ?? "alignment-editor"),
			alignmentData,
			spotObject,
		};
	}

	assertStructurallyEditableSequence(alignmentData) {
		return assertEditableHorizontalSequence(alignmentData);
	}

	async _editActiveAlignmentSafe({
		source,
		code,
		edit,
		selectAfterEdit,
	} = {}) {
		try {
			return await this._editActiveAlignment({ source, edit, selectAfterEdit });
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
		return deriveSparseHorizontalRealization(alignmentData);
	}

	hasNativeEditModel(alignmentData) {
		return isHorizontalConstructiveState(alignmentData);
	}

	materializeAlignmentDataFromSparse(spotObject) {
		return materializeAlignmentDataFromSparse(spotObject);
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

function ensureAdvancedRevision(nextState, previousState) {
	const previousRevision = previousState?.meta?.modifiedAt ?? null;
	const nextRevision = nextState?.meta?.modifiedAt ?? null;
	if (
		previousRevision == null ||
		revisionAdvances(
			nextRevision,
			previousRevision
		)
	) {
		return nextState;
	}
	const previousTime = Date.parse(previousRevision);
	const revision = new Date(
		Number.isFinite(previousTime)
			? Math.max(Date.now(), previousTime + 1)
			: Date.now()
	).toISOString();
	return {
		...nextState,
		meta: {
			...(nextState?.meta ?? {}),
			modifiedAt: revision,
		},
	};
}

function samePlainData(left, right) {
	try {
		return JSON.stringify(left) === JSON.stringify(right);
	} catch {
		return false;
	}
}

function revisionAdvances(nextRevision, previousRevision) {
	if (nextRevision == null) return false;
	const nextTime = Date.parse(nextRevision);
	const previousTime = Date.parse(previousRevision);
	if (
		Number.isFinite(nextTime) &&
		Number.isFinite(previousTime)
	) {
		return nextTime > previousTime;
	}
	return String(nextRevision) !== String(previousRevision);
}

function arcChangesHaveEffect(element, changes) {
	const currentLength =
		Number(
			element?.parameters?.length ??
			element?.length
		);
	const currentCurvature =
		Number(
			element?.parameters?.curvature ??
			element?.curvature
		);
	if (
		Object.prototype.hasOwnProperty.call(changes, "length") &&
		Number(changes.length) !== currentLength
	) {
		return true;
	}
	if (
		Object.prototype.hasOwnProperty.call(changes, "curvature") &&
		Number(changes.curvature) !== currentCurvature
	) {
		return true;
	}
	if (
		Object.prototype.hasOwnProperty.call(changes, "radius") &&
		1 / Number(changes.radius) !== currentCurvature
	) {
		return true;
	}
	return false;
}

export default AlignmentApplicationService;
