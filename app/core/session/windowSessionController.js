// app/core/session/windowSessionController.js
//
// Orchestrates window-level session behaviour.
// The current store still combines session, workspace and some workflow state.

export function createWindowSessionController({ store, sessionState } = {}) {
	if (!store?.actions || !store?.getState || !store?.setState) {
		throw new Error("WindowSessionController: missing store api");
	}

	const session = sessionState ?? null;

	function setFocus({ objectId, slot } = {}) {
		if (objectId !== undefined) {
			store.actions.setFocusObjectId?.(objectId ?? null);

			if (session?.focus) {
				session.focus.objectId = objectId ?? null;
			}
		}

		if (slot !== undefined) {
			const safeSlot = slot ?? "right";
			store.actions.setFocusSlot?.(safeSlot);

			if (session?.focus) {
				session.focus.slot = safeSlot;
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

	return {
		setFocus,
		setFocusObjectId,
		setFocusSlot,
		setCursorS,
		getSessionState,
	};
}
