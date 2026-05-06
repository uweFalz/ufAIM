// app/controllers/CockpitRuntime.js

export function createCockpitRuntime({ store, messaging } = {}) {
	let lastIntent = null;

	async function dispatchIntent(intent) {
		lastIntent = intent;

		switch (intent.type) {

			case "preview":
				store.actions?.setPreviewItem?.(intent.payload);
				store.actions?.setActiveRouteProject?.(null);
				return;

			case "accept":
				const res = await messaging.sendCmdAwait(
					"Spot.PromoteImportItemsById",
					{ itemIds: [intent.itemId] }
				);

				const id =
					res?.addedObjects?.[0]?.id ?? null;

				if (id) {
					store.actions?.clearPreviewItem?.();
					store.actions?.setActiveRouteProject?.(id);
				}

				return;

			case "activate":
				store.actions?.setActiveRouteProject?.(intent.objectId);
				store.actions?.clearPreviewItem?.();
				return;

			case "clear":
				store.actions?.clearPreviewItem?.();
				return;
		}
	}

	return {
		dispatchIntent,
		getLastIntent: () => lastIntent,
	};
}
