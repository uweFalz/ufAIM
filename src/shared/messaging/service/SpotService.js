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
	let pendingMutation = Promise.resolve();

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
		return mutateAndPersist(() => {
			const current = spotStore.getObject?.(id);
			if (!current) throw new Error(`SpotService.renameObject: unknown object ${id}`);
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

	async function storeHorizontalReceipt({ objectId, entry } = {}) {
		await hydrate();
		if (!persistence) throw new Error("SpotService.storeHorizontalReceipt: durable storage unavailable");
		const savedEntry = structuredClone(entry);
		return mutateAndPersist(() => {
			const current = spotStore.getObject?.(objectId);
			const alignmentData = current?.data?.alignmentData;
			const receipt = savedEntry?.receipt;
			const revision = alignmentData?.meta?.modifiedAt ?? current?.meta?.modifiedAt;
			const diagnostics = receipt?.diagnostics;
			const evidence = diagnostics?.evidence;
			const diagnosticsValid = diagnostics?.status === "not-available" ? evidence == null
				: diagnostics?.status === "evidence-only" && evidence?.type === "axtran2-consequence-evidence" && evidence.status === "evidence-only" && evidence.admissible === false;
			const elements = alignmentData?.sparseAlignment?.elements ?? alignmentData?.sparseAlignment?.sparse;
			if (current?.type !== "alignment" || savedEntry?.version !== 1 || receipt?.status !== "verified"
				|| receipt.objectId !== objectId || alignmentData?.id !== objectId || revision == null || receipt.revision !== revision
				|| !receipt.elementId || !Array.isArray(elements) || !elements.some((element) => element.id === receipt.elementId)
				|| !savedEntry.beforeSparseAlignment || !sameReceiptData(savedEntry.afterSparseAlignment, alignmentData.sparseAlignment)
				|| !Array.isArray(receipt.changes) || !receipt.changes.some((change) => change.target === true && change.elementId === receipt.elementId && change.fields?.length)
				|| !diagnosticsValid) throw new Error("SpotService.storeHorizontalReceipt: stale or invalid evidence context");
			const extended = current.data.extended ?? {};
			const previous = extended.horizontalRealizationReceipts ?? [];
			if (!Array.isArray(previous)) throw new Error("SpotService.storeHorizontalReceipt: invalid existing archive");
			const matching = previous.find((item) => item?.receipt?.revision === revision && item?.receipt?.elementId === receipt.elementId);
			if (matching && !sameReceiptData(matching, savedEntry)) throw new Error("SpotService.storeHorizontalReceipt: conflicting evidence for revision");
			spotStore.updateObject(objectId, { data: { extended: {
				...extended,
				horizontalRealizationReceipts: matching ? previous : [...previous, savedEntry],
			} } });
			return { ok: true, spotObject: spotStore.getObject(objectId) };
		}, (result) => result);
	}

	function mutateAndPersist(mutate, finalize) {
		// Keep the evidence compare/write and rollback indivisible relative to
		// other object mutations, including edits or deletion from another tab.
		const operation = pendingMutation.then(async () => {
			const before = getState();
			let result;
			try {
				result = mutate();
				if (persistence) await persistence.save(getState());
			} catch (error) {
				spotStore.replaceState(before);
				throw error;
			}
			return finalize(result);
		});
		pendingMutation = operation.catch(() => {});
		return operation;
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
		storeHorizontalReceipt,
	};
}

function sameReceiptData(left, right) {
	if (Object.is(left, right)) return true;
	if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
	const keys = Object.keys(left);
	return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && sameReceiptData(left[key], right[key]));
}

function isSpotLikeObject(object) {
	return !!object &&
		typeof object === "object" &&
		!Array.isArray(object) &&
		typeof object.id === "string" &&
		object.id.trim().length > 0;
}
