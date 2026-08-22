// src/services/alignment/SpotGateway.js
//
// SpotGateway
//
// Application-facing gateway for Alignment persistence and workspace focus.
//
// Responsibilities:
// - read SPOT state
// - read one SpotObject by id
// - persist SpotObjects through messaging
// - resolve the active workspace object
// - restore window-local workspace focus
//
// NOT:
// - no Alignment editing
// - no SparseAlignment derivation
// - no SpotObject mapping
// - no projection
// - no rendering
// - no import logic

import {
	getWorkspacePrimaryId,
	getWorkspaceContextIds,
} from "@src/shared/runtime/workspaceSelectionAccess.js";

export class SpotGateway {
	constructor({
		store,
		messaging,
	} = {}) {
		this.store = store ?? null;
		this.messaging = messaging ?? null;

		if (!this.store?.getState) {
			throw new Error(
				"SpotGateway: missing store.getState"
			);
		}

		if (!this.messaging?.sendCmdAwait) {
			throw new Error(
				"SpotGateway: missing messaging.sendCmdAwait"
			);
		}
	}

	/**
	 * Read the complete canonical SPOT state.
	 */
	async getState() {
		const response =
			await this.messaging.sendCmdAwait(
				"Spot.GetState",
				{}
			);

		return unwrapState(response);
	}

	/**
	 * Read one canonical SpotObject by id.
	 */
	async getObjectById(objectId) {
		const id = normalizeId(objectId);

		if (!id) {
			return null;
		}

		const spotState =
			await this.getState();

		return getSpotObjectById(
			spotState,
			id
		);
	}

	/**
	 * Resolve and load the current window-local workspace object.
	 */
	async getActiveObject() {
		const objectId =
			this.getActiveObjectId();

		if (!objectId) {
			return null;
		}

		return this.getObjectById(
			objectId
		);
	}

	/**
	 * Resolve and load the current active Alignment SpotObject.
	 */
	async getActiveAlignment() {
		const spotObject =
			await this.getActiveObject();

		if (
			!spotObject ||
			spotObject.type !== "alignment"
		) {
			return null;
		}

		return spotObject;
	}

	/**
	 * Persist one canonical SpotObject.
	 *
	 * Spot.AddObjects currently acts as canonical add/upsert.
	 */
	async saveObject(
		spotObject,
		{
			source = "spot-gateway",
			focus = false,
		} = {}
	) {
		assertSpotObject(
			spotObject,
			"SpotGateway.saveObject"
		);

		const result =
			await this.messaging.sendCmdAwait(
				"Spot.AddObjects",
				{
					objects: [spotObject],
					source,
				}
			);

		const storedObject =
			await this.getObjectById(
				spotObject.id
			);

		assertPersistedSpotObject(
			storedObject,
			spotObject
		);

		if (focus) {
			this.focusObject(
				storedObject.id,
				{ source }
			);
		}

		return {
			result,
			spotObject: storedObject,
		};
	}

	/**
	 * Persist multiple canonical SpotObjects.
	 */
	async saveObjects(
		spotObjects,
		{
			source = "spot-gateway",
		} = {}
	) {
		const objects =
			Array.isArray(spotObjects)
				? spotObjects.filter(
					isSpotObject
				)
				: [];

		if (!objects.length) {
			return {
				result: null,
				spotObjects: [],
			};
		}

		const result =
			await this.messaging.sendCmdAwait(
				"Spot.AddObjects",
				{
					objects,
					source,
				}
			);

		return {
			result,
			spotObjects: objects,
		};
	}

	/**
	 * Resolve the active window-local workspace object id.
	 *
	 * SPOT does not own this focus.
	 */
	getActiveObjectId() {
		const state =
			this.store.getState() ?? {};

		return normalizeId(
			getWorkspacePrimaryId(state)
		);
	}

	/**
	 * Restore window-local workspace focus.
	 */
	focusObject(
		objectId,
		{
			source = "spot-gateway",
		} = {}
	) {
		const id =
			normalizeId(objectId);

		if (!id) {
			return false;
		}

		const actions =
			this.store?.actions;

		actions?.clearPreviewItem?.();

		if (actions?.setWorkspacePrimary) {
			actions.setWorkspacePrimary({
				objectId: id,
				source,
			});
		} else if (actions?.setFocusObject) {
			actions.setFocusObject(id);
		} else {
			return false;
		}

		const state =
			this.store.getState() ?? {};

		const contextIds =
			getWorkspaceContextIds(state);

		const nextContextIds =
			contextIds
				.map(normalizeId)
				.filter(
					(contextId) =>
						contextId &&
						contextId !== id
				);

		if (actions?.setWorkspaceContextObjects) {
			actions.setWorkspaceContextObjects({
				objectIds: nextContextIds,
				source,
			});
		} else if (actions?.setWorkspaceContextIds) {
			actions.setWorkspaceContextIds({
				objectIds: nextContextIds,
				source,
			});
		}

		actions?.setCursorS?.(0);

		return true;
	}

	/**
	 * Clear the current window-local workspace focus.
	 */
	clearFocus({
		source = "spot-gateway",
	} = {}) {
		const actions =
			this.store?.actions;

		actions?.clearPreviewItem?.();

		if (actions?.clearWorkspacePrimary) {
			actions.clearWorkspacePrimary({
				source,
			});
		} else if (actions?.setWorkspacePrimary) {
			actions.setWorkspacePrimary({
				objectId: null,
				source,
			});
		} else if (actions?.setFocusObject) {
			actions.setFocusObject(null);
		} else {
			return false;
		}

		actions?.setCursorS?.(0);

		return true;
	}
}

function unwrapState(response) {
	return (
		response?.state ??
		response?.payload ??
		response ??
		{}
	);
}

function getSpotObjectById(
	spotState,
	objectId
) {
	const id =
		normalizeId(objectId);

	if (!id) {
		return null;
	}

	const objects =
		spotState?.objects ?? {};

	if (Array.isArray(objects)) {
		return (
			objects.find(
				(object) =>
					normalizeId(object?.id) === id
			) ??
			null
		);
	}

	return objects?.[id] ?? null;
}

function assertSpotObject(
	value,
	caller
) {
	if (!isSpotObject(value)) {
		throw new Error(
			`${caller}: missing SpotObject`
		);
	}
}

function assertPersistedSpotObject(
	storedObject,
	requestedObject
) {
	if (!storedObject) {
		throw new Error(
			"SpotGateway.saveObject: persisted object acknowledgement missing"
		);
	}
	if (
		storedObject.id !== requestedObject.id ||
		storedObject.type !== requestedObject.type
	) {
		throw new Error(
			"SpotGateway.saveObject: persisted object identity mismatch"
		);
	}
	if (
		requestedObject.type === "alignment" &&
		(
			!samePlainData(
				storedObject?.data?.alignmentData,
				requestedObject?.data?.alignmentData
			) ||
			!samePlainData(
				storedObject?.data?.kernel,
				requestedObject?.data?.kernel
			)
		)
	) {
		throw new Error(
			"SpotGateway.saveObject: persisted Alignment acknowledgement mismatch"
		);
	}
}

function samePlainData(left, right) {
	try {
		return JSON.stringify(left) === JSON.stringify(right);
	} catch {
		return false;
	}
}

function isSpotObject(value) {
	return (
		isObject(value) &&
		normalizeId(value.id) !== null
	);
}

function normalizeId(value) {
	const id =
		String(value ?? "").trim();

	return id || null;
}

function isObject(value) {
	return (
		!!value &&
		typeof value === "object" &&
		!Array.isArray(value)
	);
}

export default SpotGateway;
