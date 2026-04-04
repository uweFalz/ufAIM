// app/core/controllers/focusManager.js
//
// FocusManager
//
// Window-local focus coordinator.
//
// One window = one local focus.
// Windows do not share focus.
// Windows share canonical data only.
//
// Responsibilities:
// - set/get this window's focus
// - bridge legacy focus fields during migration
// - trigger temporary local sync derived from focus
//
// NOT:
// - no canonical object ownership
// - no global "active" object
// - no cross-window selection sync
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
		await setFocus({
			objectId: opts.objectId,
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
