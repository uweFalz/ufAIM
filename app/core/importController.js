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
import { makeImportSession } from "../io/_legacy/importSession.js";
import { applyImportToProject } from "../io/importApply.js";

export function makeImportController({ store, ui, logLine, prefs } = {}) {
	const safeLog = typeof logLine === "function"
	? logLine
	: (msg) => ui?.logLine?.(msg);

	if (!store?.getState || !store?.setState) {
		throw new Error("ImportController: missing store");
	}

	const importSession = makeImportSession();

	// MS10.x: props-effects nur wenn DEV (oder explizit)
	const emitProps = Boolean(prefs?.debug?.emitImportPropsEffects);

	function handleEffects(effects) {
		for (const e of (effects ?? [])) {
			if (!e) continue;

			// Log bleibt ruhig: nur logs
			if (e.type === "log") {
				// optional: level auswerten
				safeLog(e.message);
				continue;
			}

			// Props NICHT ins Log, sondern nur ins Props-Panel (oder gar nicht)
			if (e.type === "props") {
				// bevorzugt: ui.showProps
				if (typeof ui?.showProps === "function") ui.showProps(e.object);
				else if (typeof ui?.emitProps === "function") ui.emitProps(e.object);
				// sonst: still ignore
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

				// ✅ HIER war bei dir sehr wahrscheinlich das Problem:
				// irgendein Refactor hat "store" aus dem Scope gekegelt.
				const effects = applyImportToProject({
					store,                      // <— muss im Closure existieren
					baseId: ingest.baseId,
					slot: ingest.slot,
					source: ingest.source,
					artifacts: ingest.artifacts,
					ui,
					emitProps,                  // ✅ MS10.x
				});

				handleEffects(effects);
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
