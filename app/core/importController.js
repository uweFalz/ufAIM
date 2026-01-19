// app/core/importController.js
import { installFileDrop } from "../io/fileDrop.js";
import { importFileAuto } from "../io/importTRA_GRA.js";
import { makeImportSession } from "../io/importSession.js";
import { applyImportToProject } from "../io/importApply.js";

export function makeImportController({ store, ui, logLine, prefs } = {}) {
	const safeLog = typeof logLine === "function"
		? logLine
		: (msg) => ui?.logLine?.(msg);

	if (!prefs) throw new Error("ImportController: missing prefs");
	if (!store?.getState || !store?.setState) throw new Error("ImportController: missing store");

	const importSession = makeImportSession();

	function handleEffects(effects) {
		for (const e of (effects ?? [])) {
			if (!e) continue;

			if (e.type === "log") {
				safeLog(e.message);
				continue;
			}

			if (e.type === "props") {
				// MS11: zentral gesteuert
				if (prefs.debug?.emitImportPropsEffects) {
					// NICHT in Log – nur Props/Debug-Ausgabe
					ui?.setImportDebugProps?.(e.object); // optional, wenn du’s hast
					ui?.logInfo?.(JSON.stringify(e.object)); // falls du das als “Props-only” nutzt
				}
				continue;
			}
		}
	}

	async function importFiles(files) {
		for (const file of (files ?? [])) {
			safeLog(`drop: ${file.name}`);

			try {
				const imported = await importFileAuto(file);
				safeLog(`kind=${imported.kind}`);

				const ingest = importSession.ingest(imported);

				const effects = applyImportToProject({
					store,
					baseId: ingest.baseId,
					slot: ingest.slot,
					source: ingest.source,
					artifacts: ingest.artifacts,
					ui,
				});

				handleEffects(effects);
			} catch (err) {
				safeLog(`❌ import failed: ${file.name}`);
				safeLog(String(err));
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

	return { importFiles, installDrop, getSessionState: () => importSession.getState() };
}
