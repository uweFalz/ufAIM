// app/core/controllers/focusManager.js
// 
// FocusManager
//
// Centralises focus changes on the window/client side.
//
// Current responsibilities:
// - update session focus via WindowSessionController
// - optionally clear transient import UI state
// - optionally hydrate the active import item from master state
//
// This is intentionally small and focused.
// More focus-related side effects can move here later.

import { mirrorQuickHooksFromActive } from "@app/io/apply/importApply.js";

export function createFocusManager({
	windowSession,
	store,
	hydrateActiveImportFromMaster,
} = {}) {
	if (!windowSession?.setFocus) {
		throw new Error("FocusManager: missing windowSession.setFocus");
	}

	function syncDerivedFocusState() {
		mirrorQuickHooksFromActive({
			getState: store?.getState,
			setState: store?.setState,
		});
	}

	async function setFocus({
		objectId,
		slot,
		clearImportMeta = false,
		hydrate = false,
		syncQuickHooks = true,
	} = {}) {
		windowSession.setFocus({ objectId, slot });

		if (syncQuickHooks) {
			syncDerivedFocusState();
		}

		if (clearImportMeta) {
			store?.actions?.clearImportMeta?.();
		}

		if (hydrate) {
			await hydrateActiveImportFromMaster?.();
		}
	}

	async function setFocusObjectId(objectId, opts = {}) {
		await setFocus({
			objectId,
			clearImportMeta: Boolean(opts.clearImportMeta),
			hydrate: Boolean(opts.hydrate),
			syncQuickHooks: opts.syncQuickHooks !== false,
		});
	}

	async function setFocusSlot(slot, opts = {}) {
		await setFocus({
			slot,
			clearImportMeta: Boolean(opts.clearImportMeta),
			hydrate: Boolean(opts.hydrate),
			syncQuickHooks: opts.syncQuickHooks !== false,
		});
	}

	function getFocusSnapshot() {
		const session = windowSession?.getSessionState?.();
		if (session?.focus) {
			return {
				activeRouteProjectId: session.focus.objectId ?? null,
				activeSlot: session.focus.slot ?? "right",
			};
		}

		const st = store?.getState?.() ?? {};
		return {
			activeRouteProjectId: st.activeRouteProjectId ?? null,
			activeSlot: st.activeSlot ?? "right",
		};
	}

	return {
		setFocus,
		setFocusObjectId,
		setFocusSlot,
		getFocusSnapshot,
		syncDerivedFocusState,
	};
}
