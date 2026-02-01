// app/core/importController.js
//
// ImportController (IO glue):
// - owns file drop wiring
// - calls importer(s) and produces {baseId, slot, source, artifacts[]}
// - applies into store via applyImportToProject
//
// appCore stays UI/Render only.

import { installFileDrop } from "../io/fileDrop.js";
import { importFileAuto } from "../io/importTRA_GRA.js";
import { makeImportSession } from "../io/importSession.js";
import { applyIngestResult } from "../io/importApply.js";

export function makeImportController({ store, ui, logLine, prefs } = {}) {
	const safeLog = typeof logLine === "function"
	? logLine
	: (msg) => ui?.logLine?.(msg);

	if (!store?.getState || !store?.setState) {
		throw new Error("ImportController: missing store");
	}

	const importSession = makeImportSession();
	const emitProps = Boolean(prefs?.debug?.emitImportPropsEffects);

	function handleEffects(effects) {
		for (const e of (effects ?? [])) {
			if (!e) continue;
			if (e.type === "log") { safeLog(e.message); continue; }
			if (e.type === "props") {
				if (typeof ui?.showProps === "function") ui.showProps(e.object);
				else if (typeof ui?.emitProps === "function") ui.emitProps(e.object);
			}
		}
	}

	async function importFiles(files) {
		for (const file of (files ?? [])) {
			safeLog(`drop: ${file.name}`);

			try {
				const imported = await importFileAuto(file);
				safeLog(`kind=${imported.kind}`);

				const st = store.getState?.() ?? {};
				const slotHint = st.activeSlot ?? "right";

				const env = importSession.ingest(imported, {
					slotHint,
					originFile: file.name,
					sourceRef: { name: file.name },
				});

				// 1) apply ingests
				for (const ingest of (env.ingests ?? [])) {
					const effects = applyIngestResult({ store, ui, ingest, emitProps });
					handleEffects(effects);
				}

				// 2) 🔑 UI-Update NACH dieser Datei
				const inbox = importSession.getUIState?.({ slotHint });
				ui?.showImportInbox?.(inbox); // oder emitProps / showProps

			} catch (err) {
				safeLog(`❌ import failed: ${file.name}`);
				safeLog(String(err?.stack || err));
				ui?.setStatusError?.();
			}
		}
	}

	function installDrop({ element } = {}) {
		installFileDrop({
			element: element ?? document.documentElement,
			onFiles: importFiles,
		});
	}

	return {
		importFiles,
		installDrop,
		getSessionState: () => importSession.getState(),
	};
}
