// app/runtime/session/windowSessionController.js
//
// WindowSessionController
//
// Orchestrates window-level session behaviour.
//
// Important:
// - focus is the new internal language
// - legacy store fields are still updated for compatibility
// - sessionState is the preferred source for current focus context
//
// Current status:
// - store is still a transitional combined store
// - this controller acts as the bridge toward session-first focus handling
import { getWorkspacePrimaryId } from "@src/shared/runtime/workspaceSelectionAccess.js";

function normalizeSlot(slot) {
	const v = String(slot ?? "right");
	return v === "left" || v === "km" || v === "right" ? v : "right";
}

export function createWindowSessionController({ store, sessionState } = {}) {
	if (!store?.actions || !store?.getState || !store?.setState) {
		throw new Error("WindowSessionController: missing store api");
	}

	const session = sessionState ?? null;

	function ensureSessionFocus() {
		if (!session) return null;
		if (!session.focus || typeof session.focus !== "object") {
			session.focus = {
				objectId: null,
				slot: "right",
			};
		}
		return session.focus;
	}

	function getFocus() {
		const focus = ensureSessionFocus();
		if (focus) {
			return {
				objectId: focus.objectId ?? null,
				slot: normalizeSlot(focus.slot),
			};
		}

		// Fallback to canonical workspace selection.
		const st = store.getState?.() ?? {};
		return {
			objectId: getWorkspacePrimaryId(st),
			slot: normalizeSlot(st.activeSlot),
		};
	}

	function setFocus({ objectId, slot } = {}) {
		
		// console.log("[WindowSession] setFocus", { objectId, slot });
		// console.log("[WindowSession] after", sessionState?.focus);

		const focus = ensureSessionFocus();

		if (objectId !== undefined) {
			const safeObjectId = objectId ?? null;

			// legacy compatibility path into transitional store
			store.actions.setFocusObjectId?.(safeObjectId);

			if (focus) {
				focus.objectId = safeObjectId;
			}
		}

		if (slot !== undefined) {
			const safeSlot = normalizeSlot(slot);

			// legacy compatibility path into transitional store
			store.actions.setFocusSlot?.(safeSlot);

			if (focus) {
				focus.slot = safeSlot;
			}
		}
	}

	function setFocusObjectId(objectId) {
		setFocus({ objectId });
	}

	function setFocusSlot(slot) {
		setFocus({ slot });
	}

	function setCursorS(value) {
		store.actions.setCursorS?.(value);

		if (session?.navigation) {
			const n = Number(value);
			session.navigation.cursorS = Number.isFinite(n) ? Math.max(0, n) : 0;
		}
	}

	function getSessionState() {
		return session;
	}

	function getFocusSnapshot() {
		const focus = getFocus();
		return {
			objectId: focus.objectId,
			activeSlot: focus.slot,
		};
	}

	return {
		setFocus,
		setFocusObjectId,
		setFocusSlot,
		setCursorS,

		// new preferred api
		getFocus,

		// legacy compatibility api
		getFocusSnapshot,

		getSessionState,
	};
}
