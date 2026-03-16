// app/core/controllers/importController.js

import { installFileDrop } from "@app/io/input/fileDrop.js";
import { makeImportSession } from "@app/io/import/importSession.js";
import { applyIngestResult } from "@app/io/apply/importApply.js";

import { runImportPipeline } from "@src/import/runImportPipeline.js";

//
// ...
//
export function makeImportController({ store, ui, logLine, prefs, messaging } = {}) {
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

	// ------------------------------------------------------------
	// Legacy ingest path
	// Bleibt vorerst für Working-Set / bisherige ImportSession bestehen
	// ------------------------------------------------------------
	function ingestArtifact(artifact, { file, slotHint }) {
		const importObject = artifact?.payload ?? artifact;
		if (!importObject?.kind) {
			throw new Error(`Artifact has no ingestable payload: ${file?.name ?? "(unknown file)"}`);
		}

		const env = importSession.ingest(importObject, {
			slotHint,
			originFile: file?.name ?? null,
			sourceRef: artifact?.sourceRef ?? { name: file?.name ?? null },
		});

		for (const ingest of (env.ingests ?? [])) {
			const effects = applyIngestResult({
				store,
				ui,
				ingest,
				emitProps,
			});
			handleEffects(effects);
		}
	}

	async function importOneFile(file) {
		return await runImportPipeline(file, { log: safeLog });
	}

	function makeBatchStats(totalFiles) {
		return {
			totalFiles,
			imported: 0,
			ignored: 0,
			recognizedUnsupported: 0,
			empty: 0,
			unknown: 0,
			failed: 0,

			spotCandidateCount: 0,
			workingItemCount: 0,
			referenceItemCount: 0,
		};
	}

	function accountResult(stats, result) {
		const status = result?.status ?? "unknown";

		const spotCount = Array.isArray(result?.spotCandidates) ? result.spotCandidates.length : 0;
		const workingCount = Array.isArray(result?.workingItems) ? result.workingItems.length : 0;
		const refCount = Array.isArray(result?.referenceItems) ? result.referenceItems.length : 0;

		stats.spotCandidateCount += spotCount;
		stats.workingItemCount += workingCount;
		stats.referenceItemCount += refCount;

		switch (status) {
			case "imported":
			stats.imported += 1;
			break;
			case "ignored":
			stats.ignored += 1;
			break;
			case "recognized-unsupported":
			stats.recognizedUnsupported += 1;
			break;
			case "empty":
			stats.empty += 1;
			break;
			case "unknown":
			stats.unknown += 1;
			break;
			default:
			stats.unknown += 1;
			break;
		}
	}

	function logBatchSummary(stats) {
		safeLog(
		`import batch: ${stats.totalFiles} files / ` +
		`${stats.imported} imported / ` +
		`${stats.ignored} ignored / ` +
		`${stats.recognizedUnsupported} recognized-unsupported / ` +
		`${stats.empty} empty / ` +
		`${stats.unknown} unknown / ` +
		`${stats.failed} failed / ` +
		`${stats.spotCandidateCount} spotCandidates / ` +
		`${stats.workingItemCount} workingItems / ` +
		`${stats.referenceItemCount} referenceItems`
		);
	}

	// ------------------------------------------------------------
	// Phase 1: nur Logging + provisorische Weitergabe
	// ------------------------------------------------------------
	async function handleSpotCandidates(candidates = [], { file }) {
		if (!candidates.length) return;

		for (const spot of candidates) {
			safeLog(`spotCandidate: ${spot?.kind ?? "unknown"} :: ${spot?.name ?? file?.name ?? "unnamed"}`);
		}

		if (!messaging?.sendCmdAwait) {
			safeLog("⚠️ no messaging available for Spot.AddCandidates");
			return;
		}

		await messaging.sendCmdAwait("Spot.AddCandidates", {
			spots: candidates
		});
	}
	
	async function handleWorkingItemsMaster(items = [], { file }) {
		if (!items.length) return;

		if (!messaging?.sendCmdAwait) {
			safeLog("⚠️ no messaging available for Import.AddItems");
			return;
		}

		await messaging.sendCmdAwait("Import.AddItems", {
			items: items.map((item) => ({
				id: item.id ?? null,
				name: item.name ?? file?.name ?? "unknown",
				size: Number(file?.size ?? 0),
				kind: item.kind ?? "unknown",

				status: item.status ?? null,
				meta: item.meta ?? null,
				source: item.source ?? null,

				payload:
				item.kind === "landFATAlignment"
				? {
					kind: "landFATAlignment",
					name: item.name ?? file?.name ?? "unknown",
					landFATAlignment: item.payload ?? null,
					meta: item.meta ?? null,
				}
				: item.payload ?? null,
			}))
		});
	}

	function handleWorkingItems(items = [], { file, slotHint }) {
		for (const item of items) {
			safeLog(`workingItem: ${item?.kind ?? "unknown"} :: ${item?.name ?? file?.name ?? "unnamed"}`);

			// Vorläufig weiter über den bestehenden Legacy-Weg,
			// aber nur wenn der payload ingest-fähig ist.
			const payload = item?.payload;
			if (payload?.kind) {
				ingestArtifact(
				{
					payload,
					sourceRef: { name: file?.name ?? null },
				},
				{ file, slotHint }
				);
			}
		}
	}

	function handleReferenceItems(items = [], { file }) {
		for (const ref of items) {
			safeLog(`referenceItem: ${ref?.kind ?? "unknown"} :: ${ref?.name ?? file?.name ?? "unnamed"}`);

			// TODO nächster Schritt:
			// referenceStore / visibility / context-layer
		}
	}

	async function importFiles(files) {
		const batch = Array.from(files ?? []);

		messaging?.emitEvt?.("Import.DropObserved", {
			fileCount: batch.length,
			window: "local"
		});

		const st = store.getState?.() ?? {};
		const slotHint = st.activeSlot ?? "right";
		const stats = makeBatchStats(batch.length);
		
		await messaging?.sendCmdAwait?.("Import.BeginSession", {
			source: "drop"
		});

		for (const file of batch) {
			safeLog(`drop: ${file.name}`);

			try {
				const result = await importOneFile(file);
				
				safeLog(
				`import result: spots=${result?.spotCandidates?.length ?? 0} ` +
				`working=${result?.workingItems?.length ?? 0} ` +
				`refs=${result?.referenceItems?.length ?? 0}`
				);

				const spotCandidates = Array.isArray(result?.spotCandidates) ? result.spotCandidates : [];
				const workingItems = Array.isArray(result?.workingItems) ? result.workingItems : [];
				const referenceItems = Array.isArray(result?.referenceItems) ? result.referenceItems : [];

				accountResult(stats, result);

				if (!spotCandidates.length && !workingItems.length && !referenceItems.length) {
					const label = result?.status ?? "no-items";
					safeLog(`ℹ️ ${label}: ${file.name}`);
				}

				await handleSpotCandidates(spotCandidates, { file, slotHint });
				await handleWorkingItemsMaster(workingItems, { file, slotHint });
				
				handleWorkingItems(workingItems, { file, slotHint });
				handleReferenceItems(referenceItems, { file, slotHint });

			} catch (err) {
				stats.failed += 1;
				console.error("import failed detail:", err);
				safeLog(`❌ import failed: ${file.name}`);
				safeLog(String(err?.stack || err));
				ui?.setStatusError?.();
			}
		}

		if (typeof ui?.setSpotState === "function") {
			ui.setSpotState(importSession.getUIState({ slotHint }));
		}

		logBatchSummary(stats);
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
