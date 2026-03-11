// app/core/importController.js
//
// ImportController (IO glue):
// - owns file drop wiring
// - calls importer(s) and produces {baseId, slot, source, artifacts[]}
// - applies into store via applyImportToProject
//
// appCore stays UI/Render only.

import { installFileDrop } from "../io/fileDrop.js";
import { importFileAuto } from "@src/import/parsers/importTRA_GRA.js";
import { parseLandXML } from "@src/import/parsers/parseLandXML.js";
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
			if (e.type === "log") {
				safeLog(e.message);
				continue;
			}
			if (e.type === "props") {
				if (typeof ui?.showProps === "function") ui.showProps(e.object);
				else if (typeof ui?.emitProps === "function") ui.emitProps(e.object);
			}
		}
	}

	async function importFileSmart(file) {
		const lower = String(file?.name ?? "").toLowerCase();

		if (lower.endsWith(".tra") || lower.endsWith(".gra")) {
			return await importFileAuto(file);
		}

		if (lower.endsWith(".xml") || lower.endsWith(".landxml")) {
			const text = await file.text();

			if (text.includes("<LandXML") || text.includes(":LandXML")) {
				return parseLandXML(text, file.name);
			}
		}

		throw new Error(`Unsupported import: ${file?.name ?? "(unknown file)"}`);
	}

	async function importFiles(files) {
		for (const file of (files ?? [])) {
			safeLog(`drop: ${file.name}`);

			try {
				const imported = await importFileSmart(file);

				const st = store.getState?.() ?? {};
				const slotHint = st.activeSlot ?? "right";

				// --------------------------------------------------------
				// A) single-object legacy import (TRA/GRA)
				// --------------------------------------------------------
				if (imported && imported.kind) {
					safeLog(`kind=${imported.kind}`);

					const env = importSession.ingest(imported, {
						slotHint,
						originFile: file.name,
						sourceRef: { name: file.name },
					});

					for (const ingest of (env.ingests ?? [])) {
						const effects = applyIngestResult({ store, ui, ingest, emitProps });
						handleEffects(effects);
					}
				}

				// --------------------------------------------------------
				// B) landFAT / landXML container import
				// --------------------------------------------------------
				else if (imported?.type === "landFAT") {
					const aligns = Array.isArray(imported.alignments) ? imported.alignments : [];
					safeLog(`kind=landFAT alignments=${aligns.length}`);

					for (const alignment of aligns) {
						const importObject = {
							kind: "ALIGNMENT",
							type: "alignment2D",
							name: alignment?.name ?? "alignment",

							landFATAlignment: alignment,

							meta: {
								sourceFormat: "landXML",
								alignmentName: alignment?.name ?? null,
								sourceFile: imported?.meta?.sourceFile ?? file.name ?? null,
							},
						};

						const env = importSession.ingest(importObject, {
							slotHint,
							originFile: file.name,
							sourceRef: {
								name: file.name,
								alignmentName: alignment?.name ?? null,
							},
						});

						for (const ingest of (env.ingests ?? [])) {
							const effects = applyIngestResult({ store, ui, ingest, emitProps });
							handleEffects(effects);
						}
					}
				}

				else {
					throw new Error(`Unsupported parsed import result: ${file.name}`);
				}

				if (typeof ui?.setSpotState === "function") {
					ui.setSpotState(importSession.getUIState({ slotHint }));
				}
			} catch (err) {
				console.error("import failed detail:", err);
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
		session: importSession,
	};
}
