// app/core/controllers/focusManager.js
//
// FocusManager
//
// Window-local selection state.
//
// Responsibilities:
// - manages this window's focus (objectId, slot)
// - triggers local sync based on focus changes
//
// NOT:
// - no global state
// - no SPOT mutation
//
// Rule:
// Each window has its own focus.
// Focus is never shared across windows.
//

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
		// TEMP bridge:
		// mirror old preview/import quickhooks from active focus
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
		
		// console.log("[FocusManager] setFocus", { objectId, slot });
		
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
			slot: opts.slot,
			clearImportMeta: Boolean(opts.clearImportMeta),
			hydrate: Boolean(opts.hydrate),
			syncQuickHooks: opts.syncQuickHooks !== false,
		});
	}

	async function setFocusSlot(slot, opts = {}) {
	const current = getFocus();

	await setFocus({
		objectId: opts.objectId ?? current.objectId ?? null,
		slot,
		clearImportMeta: Boolean(opts.clearImportMeta),
		hydrate: Boolean(opts.hydrate),
		syncQuickHooks: opts.syncQuickHooks !== false,
	});
}

	function getFocus() {
		const session = windowSession?.getSessionState?.();
		if (session?.focus) {
			return {
				objectId: session.focus.objectId ?? null,
				slot: session.focus.slot ?? "right",
			};
		}

		// legacy fallback while windowStore still carries old focus fields
		const st = store?.getState?.() ?? {};
		return {
			objectId: st.activeRouteProjectId ?? null,
			slot: st.activeSlot ?? "right",
		};
	}

	function getFocusSnapshot() {
		const focus = getFocus();

		// compatibility shape for still-legacy consumers
		return {
			activeRouteProjectId: focus.objectId,
			activeSlot: focus.slot,
		};
	}

	return {
		setFocus,
		setFocusObjectId,
		setFocusSlot,

		// new shape
		getFocus,

		// legacy compatibility shape
		getFocusSnapshot,

		syncDerivedFocusState,
	};
}
