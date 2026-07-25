import { renderGndImportWorkbench } from "./gndImportWorkbenchView.js";

export function makeGndImportWorkbenchController({ store, messaging, cockpit } = {}) {
	const state = { phase: "idle", records: [], items: [], rejectedItems: [], feedback: null, busyItemId: null };
	let root;
	let overlay;
	let prior = null;
	let unsub = null;

	async function refresh() {
		state.phase = "loading";
		render();
		try {
			const [session, evidence] = await Promise.all([
				messaging.sendCmdAwait("Import.GetState", {}),
				messaging.sendCmdAwait("Import.GetResultEvidence", {}),
			]);
			state.items = session?.items ?? [];
			state.rejectedItems = session?.rejectedItems ?? [];
			state.records = evidence?.records ?? [];
			state.phase = "ready";
		} catch {
			state.phase = "error";
		}
		render();
		return state;
	}

	async function open() {
		prior = captureSurfaceState();
		for (const panel of document.querySelectorAll("#overlay-root > .uf-panel")) panel.classList.add("hidden");
		document.getElementById("ufShell")?.classList.add("is-cockpit-collapsed");
		overlay?.classList.remove("hidden");
		document.getElementById("btnGndImportWorkbench")?.classList.add("btn--primary");
		await refresh();
		root?.querySelector("button, summary, [tabindex]")?.focus();
	}

	function close({ restore = true } = {}) {
		overlay?.classList.add("hidden");
		document.getElementById("btnGndImportWorkbench")?.classList.remove("btn--primary");
		store.actions?.clearPreviewItem?.();
		if (restore) restoreSurfaceState(prior);
		prior = null;
	}

	async function preview(itemId) {
		state.feedback = null;
		await cockpit.refreshImportState();
		await cockpit.previewImportItem(itemId);
		render();
	}

	async function promote(itemId) {
		const item = state.items.find((entry) => String(entry.id) === String(itemId));
		if (!item || item?.status?.promotable !== true || item?.status?.rejected === true || item?.status?.accepted === true) return false;
		state.busyItemId = itemId;
		render();
		await cockpit.refreshImportState();
		const ok = await cockpit.acceptImportItem(itemId, { show: false });
		state.busyItemId = null;
		state.feedback = ok ? "gnd_workbench.transfer_ok" : "gnd_workbench.transfer_failed";
		await refresh();
		return ok;
	}

	function render() { renderGndImportWorkbench(root, state); }

	function start() {
		root = document.getElementById("gndImportWorkbenchBody");
		overlay = document.getElementById("gndImportWorkbenchOverlay");
		document.getElementById("btnGndImportWorkbench")?.addEventListener("click", open);
		document.getElementById("btnGndImportWorkbenchClose")?.addEventListener("click", close);
		for (const id of ["btnSpot", "btnTrans", "btnAlignmentEditor", "btnToggleBands", "btnToggleSection", "btnToggleDebug", "btnCockpit"]) {
			document.getElementById(id)?.addEventListener("click", () => {
				if (!overlay?.classList.contains("hidden")) close({ restore: false });
			}, { capture: true });
		}
		root?.addEventListener("click", async (event) => {
			const previewButton = event.target.closest("[data-gnd-preview]");
			if (previewButton) return preview(previewButton.dataset.gndPreview);
			const promoteButton = event.target.closest("[data-gnd-promote]");
			if (promoteButton) return promote(promoteButton.dataset.gndPromote);
			const rawButton = event.target.closest("[data-gnd-raw-table]");
			if (rawButton) {
				const evidenceId = rawButton.closest("[data-evidence-id]")?.dataset.evidenceId;
				const record = state.records.find((entry) => entry.evidenceId === evidenceId);
				const table = record?.sourceEnvelope?.tables?.[Number(rawButton.dataset.gndRawTable)];
				const pre = rawButton.parentElement?.querySelector("[data-raw-evidence]");
				if (pre) pre.textContent = JSON.stringify({ ...table, rows: table?.rows?.slice?.(0, 100) ?? [] }, null, 2);
			}
		});
		window.addEventListener("ufaim:language-changed", render);
		unsub = messaging.onEvt?.("Import.StateChanged", () => {
			if (!overlay?.classList.contains("hidden")) void refresh();
		});
	}

	function destroy() { unsub?.(); close(); }
	return { start, destroy, open, close, refresh, preview, promote, getState: () => structuredClone(state) };
}

function captureSurfaceState() {
	return {
		panels: [...document.querySelectorAll("#overlay-root > .uf-panel")].filter((panel) => !panel.classList.contains("hidden")).map((panel) => panel.id),
		cockpitCollapsed: document.getElementById("ufShell")?.classList.contains("is-cockpit-collapsed") ?? false,
	};
}
function restoreSurfaceState(snapshot) {
	if (!snapshot) return;
	for (const id of snapshot.panels) document.getElementById(id)?.classList.remove("hidden");
	document.getElementById("ufShell")?.classList.toggle("is-cockpit-collapsed", snapshot.cockpitCollapsed);
}
