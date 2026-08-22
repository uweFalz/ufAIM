// src/shared/messaging/service/SpotService.js

import { buildSpotUiState } from "../../../model/spot/ui/buildSpotUiState.js";
import { promoteImportItems } from "../../../model/spot/mutate/promoteImportItems.js";
import { inspectCoordContext } from "../../../domain/coord/CoordAgent.js";

export function createSpotService({ spotStore, router, persistence = null } = {}) {
	if (!spotStore) {
		throw new Error("SpotService: missing spotStore");
	}

	if (typeof spotStore.getState !== "function") {
		throw new Error("SpotService: invalid spotStore.getState");
	}

	if (typeof spotStore.addObjects !== "function") {
		throw new Error("SpotService: invalid spotStore.addObjects");
	}
	if (persistence && (
		typeof persistence.load !== "function" ||
		typeof persistence.save !== "function" ||
		typeof spotStore.replaceState !== "function"
	)) {
		throw new Error("SpotService: invalid persistence boundary");
	}

	let hydrationPromise = null;

	function hydrate() {
		if (!hydrationPromise) {
			hydrationPromise = (async () => {
				if (!persistence) return getState();
				const restored = await persistence.load();
				if (restored != null) spotStore.replaceState(restored);
				return getState();
			})();
		}
		return hydrationPromise;
	}

	function getState() {
		return spotStore.getState();
	}

	function getObjectsArray() {
		return Object.values(getState()?.objects ?? {});
	}

	function getCoordContext() {
		return inspectCoordContext(getObjectsArray());
	}

	function getUiState() {
		const spotState = getState();

		return {
			...buildSpotUiState(spotState),
			coordContext: inspectCoordContext(Object.values(spotState?.objects ?? {})),
		};
	}

	function emitUiStateChanged() {
		const uiState = getUiState();
		router?.emitEvt?.("Spot.UiStateChanged", uiState);
		return uiState;
	}

	async function addObjects({ objects = [] } = {}) {
		await hydrate();
		const list = Array.isArray(objects)
			? objects.filter(isSpotLikeObject)
			: [];

		return mutateAndPersist(() => {
			if (list.length > 0) spotStore.addObjects(list);
			return { ok: true, count: list.length };
		}, (result) => {
			const uiState = emitUiStateChanged();
			return { ...result, uiState, coordContext: getCoordContext() };
		});
	}

	async function promoteItems({ items = [] } = {}) {
		await hydrate();
		return mutateAndPersist(() => {
			const result = promoteImportItems({ items, spotStore });

			console.log("[SpotService] promoteItems result =", {
				addedObjects: result?.count?.addedObjects ?? 0,
				reviewItems: result?.count?.reviewItems ?? 0,
				rejectedItems: result?.count?.rejectedItems ?? 0,
				review: result?.reviewItems ?? [],
				rejected: result?.rejectedItems ?? [],
			});

			return result;
		}, (result) => {
			const uiState = emitUiStateChanged();
			return { ...result, uiState, coordContext: getCoordContext() };
		});
	}

	async function renameObject({ objectId, name } = {}) {
		await hydrate();
		const id = String(objectId ?? "").trim();
		const nextName = String(name ?? "").trim();
		if (!id || !nextName) throw new Error("SpotService.renameObject: objectId and name are required");
		const current = spotStore.getObject?.(id);
		if (!current) throw new Error(`SpotService.renameObject: unknown object ${id}`);
		return mutateAndPersist(() => {
			const alignmentData = current?.data?.alignmentData && typeof current.data.alignmentData === "object"
				? { ...current.data.alignmentData, name: nextName }
				: current?.data?.alignmentData;
			spotStore.updateObject(id, {
				data: { name: nextName, ...(alignmentData ? { alignmentData } : {}) },
				meta: { label: nextName, modifiedAt: new Date().toISOString() },
			});
			return { ok: true, objectId: id, name: nextName };
		}, (result) => {
			const uiState = emitUiStateChanged();
			return { ...result, uiState };
		});
	}

	async function removeObject({ objectId } = {}) {
		await hydrate();
		const id = String(objectId ?? "").trim();
		if (!id) throw new Error("SpotService.removeObject: objectId is required");
		return mutateAndPersist(() => {
			const removedObject = spotStore.removeObject?.(id) ?? null;
			return { ok: Boolean(removedObject), objectId: id, removedObject };
		}, (result) => {
			const uiState = emitUiStateChanged();
			return { ...result, uiState };
		});
	}

	async function mutateAndPersist(mutate, finalize) {
		const before = getState();
		try {
			const result = mutate();
			if (persistence) await persistence.save(getState());
			return finalize(result);
		} catch (error) {
			spotStore.replaceState(before);
			throw error;
		}
	}

	return {
		hydrate,
		getState,
		getUiState,
		getCoordContext,
		addObjects,
		promoteItems,
		renameObject,
		removeObject,
	};
}

function isSpotLikeObject(object) {
	return !!object &&
		typeof object === "object" &&
		!Array.isArray(object) &&
		typeof object.id === "string" &&
		object.id.trim().length > 0;
}
