// app/controllers/alignmentEditorController.js

import { createEmptyAlignmentData } from "@src/domain/alignment/editor/createEmptyAlignmentData.js";
import { addStraightElement } from "@src/domain/alignment/editor/alignmentEditOps.js";

export class AlignmentEditorController {
	constructor({ store, messaging, logLine } = {}) {
		this.store = store ?? null;
		this.messaging = messaging ?? null;
		this.logLine = typeof logLine === "function" ? logLine : () => {};

		if (!this.messaging?.sendCmdAwait) {
			throw new Error("AlignmentEditorController: missing messaging.sendCmdAwait");
		}
	}

	async newAlignment({ name = "New Alignment" } = {}) {
		const alignmentData = createEmptyAlignmentData({ name });
		const spotObject = makeSpotObjectFromAlignmentData(alignmentData);

		await this.messaging.sendCmdAwait("Spot.AddObjects", {
			objects: [spotObject],
			source: "alignment-editor",
		});

		this._setWorkspaceFocus(spotObject.id);

		this.logLine?.(`[AlignmentEditor] New Alignment created: ${spotObject.id}`);

		return {
			alignmentData,
			spotObject,
		};
	}

	async addStraightToActiveAlignment({ length = 100 } = {}) {
		const activeObjectId = this._getActiveObjectId();

		if (!activeObjectId) {
			this.logLine?.("[AlignmentEditor] Add Straight failed: no active alignment");
			return null;
		}

		const spotState = await this.messaging.sendCmdAwait("Spot.GetState", {});
		const spotObject = getSpotObjectById(spotState, activeObjectId);

		if (!spotObject || spotObject.type !== "alignment") {
			this.logLine?.(
				`[AlignmentEditor] Add Straight failed: active object is not alignment: ${activeObjectId}`
			);
			return null;
		}

		const alignmentData = readAlignmentData(spotObject);

		if (!alignmentData) {
			this.logLine?.(
				`[AlignmentEditor] Add Straight failed: missing AlignmentData: ${activeObjectId}`
			);
			return null;
		}

		const nextAlignmentData = addStraightElement(alignmentData, { length });
		const nextSpotObject = makeUpdatedSpotObject(spotObject, nextAlignmentData);

		await this.messaging.sendCmdAwait("Spot.AddObjects", {
			objects: [nextSpotObject],
			source: "alignment-editor-add-straight",
		});

		this._setWorkspaceFocus(nextSpotObject.id);

		const count = nextAlignmentData.editModel?.elements?.length ?? 0;

		console.log("[AlignmentEditor] editModel after Add Straight", {
	objectId: nextSpotObject.id,
	elementCount: count,
	elements: nextAlignmentData.editModel?.elements ?? [],
});

		this.logLine?.(
			`[AlignmentEditor] Straight added: ${nextSpotObject.id}, elements=${count}`
		);

		return {
			alignmentData: nextAlignmentData,
			spotObject: nextSpotObject,
		};
	}

	_getActiveObjectId() {
		const state = this.store?.getState?.() ?? {};

		return (
			state?.workspace_selection?.primaryId ??
			state?.focus?.objectId ??
			state?.activeRouteProjectId ??
			null
		);
	}

	_setWorkspaceFocus(objectId) {
		const actions = this.store?.actions;

		actions?.setPreviewItem?.({
			item: null,
			source: { type: "alignment-editor-clear-preview" },
		});

		actions?.setActiveRouteProject?.(objectId);

		if (actions?.setWorkspacePrimary) {
			actions.setWorkspacePrimary({
				primaryId: objectId,
				source: "alignment-editor",
			});
			return true;
		}

		if (actions?.setFocusObject) {
			actions.setFocusObject(objectId);
			return true;
		}

		this.logLine?.(
			`[AlignmentEditor] Workspace focus helper missing for ${objectId}`
		);

		return false;
	}
}

function makeSpotObjectFromAlignmentData(alignmentData) {
	return {
		id: alignmentData.id,
		type: "alignment",

		payload: {
			alignmentData,
		},

		data: {
			alignmentData,
			sparseAlignment: null,
		},

		meta: {
			label: alignmentData.name,
			source: "editor",
			lifecycle: "draft",
			dirty: true,
		},
	};
}

function makeUpdatedSpotObject(spotObject, alignmentData) {
	return {
		...spotObject,

		payload: {
			...(spotObject.payload ?? {}),
			alignmentData,
		},

		data: {
			...(spotObject.data ?? {}),
			alignmentData,
			sparseAlignment: alignmentData.sparseAlignment ?? null,
		},

		meta: {
			...(spotObject.meta ?? {}),
			label: alignmentData.name ?? spotObject.meta?.label ?? spotObject.id,
			source: spotObject.meta?.source ?? "editor",
			lifecycle: alignmentData.meta?.lifecycle ?? spotObject.meta?.lifecycle ?? "draft",
			dirty: true,
			modifiedAt: alignmentData.meta?.modifiedAt ?? new Date().toISOString(),
		},
	};
}

function readAlignmentData(spotObject) {
	return (
		spotObject?.payload?.alignmentData ??
		spotObject?.data?.alignmentData ??
		null
	);
}

function getSpotObjectById(spotState, objectId) {
	const objects = spotState?.objects ?? {};

	if (Array.isArray(objects)) {
		return objects.find((obj) => obj?.id === objectId) ?? null;
	}

	return objects?.[objectId] ?? null;
}
