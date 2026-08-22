import { buildCanonicalObjectQuickSwitcherModel } from "../../domain/workspace/buildCanonicalObjectQuickSwitcherModel.js";

const PEER_OPENERS = new Set([
	"btnGndImportWorkbench",
	"btnSpot",
	"btnCommandPalette",
	"btnAlignmentEditor",
	"btnVerticalProfileAuthoring",
	"btnCantAuthoring",
	"btnChainageAuthoring",
]);

export function createCanonicalObjectQuickSwitcherController({ view, refreshCanonicalUiState, activateCanonicalAlignment, getActiveObjectId, openSurface, closeSurface, documentRef = globalThis.document } = {}) {
	let uiState = null;
	let phase = "ready";
	let error = null;
	let query = "";
	let busy = false;
	let opened = false;
	const render = () => view.render(buildCanonicalObjectQuickSwitcherModel({ uiState, activeObjectId: getActiveObjectId?.(), query, phase, error }));
	async function refresh() {
		if (busy) return false;
		busy = true; phase = "loading"; error = null; render();
		try {
			const result = await refreshCanonicalUiState?.();
			if (!result || !Array.isArray(result.rows)) throw new Error("Kanonische Objektliste nicht verfügbar");
			uiState = result; phase = "ready"; return true;
		} catch (cause) {
			phase = "error"; error = String(cause?.message ?? cause); return false;
		} finally { busy = false; render(); }
	}
	async function open() { opened = true; openSurface?.(); return refresh(); }
	async function activate(objectId) {
		if (busy) return false;
		busy = true;
		try {
			const result = await activateCanonicalAlignment?.(objectId);
			if (result?.ok !== true) return false;
			close(); return true;
		} catch (cause) {
			phase = "error"; error = String(cause?.message ?? cause); render(); return false;
		} finally { busy = false; }
	}
	const close = () => {
		if (!opened) return false;
		opened = false;
		closeSurface?.();
		return true;
	};
	const onPeerOpen = (event) => {
		const opener = event?.target?.closest?.("[id]") ?? event?.target;
		if (opened && PEER_OPENERS.has(String(opener?.id ?? ""))) close();
	};
	documentRef?.addEventListener?.("click", onPeerOpen, true);
	const stop = () => {
		close();
		documentRef?.removeEventListener?.("click", onPeerOpen, true);
	};
	view.setHandlers({ search: (value) => { query = value; render(); }, retry: refresh, activate, close });
	return Object.freeze({ open, close, stop, refresh, activate, getModel: () => buildCanonicalObjectQuickSwitcherModel({ uiState, activeObjectId: getActiveObjectId?.(), query, phase, error }) });
}
