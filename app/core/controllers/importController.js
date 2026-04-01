// app/core/controllers/importController.js
//
// ImportController
//
// Rolle:
// - ruft die Import-Pipeline auf
// - schickt geprüfte Ergebnisse an den Master
// - aktualisiert nur noch lokale UI-Zustände
//
// NICHT mehr:
// - keine Legacy-Preview-Brücke
// - kein TRA/GRA/CANT-Fake-Ingest
// - keine lokale Vorschau-Erzeugung
//
// Grundidee:
// Alles, was die importPipeline geprüft verlässt, landet markiert im Store / SPOT.
// Der Client ist nur noch Intent-/Dispatch-Schicht.

import { installFileDrop } from "@app/io/input/fileDrop.js";
import { makeImportSession } from "@app/io/import/importSession.js";

import { runImportPipeline } from "@src/import/runImportPipeline.js";

export function makeImportController({ store, ui, logLine, prefs, messaging } = {}) {
	const safeLog = typeof logLine === "function"
		? logLine
		: (msg) => ui?.logLine?.(msg);

	if (!store?.getState || !store?.setState) {
		throw new Error("ImportController: missing store");
	}

	// @baustelle [IMPORT_SESSION_REDUCE]
	// importSession bleibt vorerst als temporärer Client-Puffer bestehen.
	// Sie darf aber keine fachliche Schattenwelt mehr bilden.
	const importSession = makeImportSession();

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
			processed: 0,
			unknown: 0,
			failed: 0,

			spotCandidateCount: 0,
			workingItemCount: 0,
			referenceItemCount: 0,
		};
	}

	function accountResult(stats, result) {
		const spotCount = Array.isArray(result?.spotCandidates) ? result.spotCandidates.length : 0;
		const workingCount = Array.isArray(result?.workingItems) ? result.workingItems.length : 0;
		const refCount = Array.isArray(result?.referenceItems) ? result.referenceItems.length : 0;

		stats.spotCandidateCount += spotCount;
		stats.workingItemCount += workingCount;
		stats.referenceItemCount += refCount;

		const explicitStatus = result?.status ?? null;
		const isEmpty = result?.isEmpty === true;
		const hasAnyItems = spotCount > 0 || workingCount > 0 || refCount > 0;

		let status = explicitStatus;

		if (!status) {
			if (isEmpty) status = "empty";
			else if (hasAnyItems) status = "processed";
			else status = "unknown";
		}

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
			case "processed":
				stats.processed += 1;
				break;
			case "unknown":
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
			`${stats.processed} processed / ` +
			`${stats.unknown} unknown / ` +
			`${stats.failed} failed / ` +
			`${stats.spotCandidateCount} spotCandidates / ` +
			`${stats.workingItemCount} workingItems / ` +
			`${stats.referenceItemCount} referenceItems`
		);
	}

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
			spots: candidates,
		});
	}

	async function handleWorkingItemsMaster(items = [], { file }) {
		if (!items.length) return;

		for (const item of items) {
			safeLog(`workingItem: ${item?.kind ?? "unknown"} :: ${item?.name ?? file?.name ?? "unnamed"}`);
		}

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
				payload: item.payload ?? null,
			})),
		});
	}

	async function handleReferenceItems(items = [], { file }) {
		if (!items.length) return;

		for (const ref of items) {
			safeLog(`referenceItem: ${ref?.kind ?? "unknown"} :: ${ref?.name ?? file?.name ?? "unnamed"}`);
		}

		// @baustelle [REFERENCE_STORE]
		// Sobald Reference.Add... o. ä. existiert, hier an den Master schicken.
	}

	async function importFiles(files) {
		const batch = Array.from(files ?? []);

		messaging?.emitEvt?.("Import.DropObserved", {
			fileCount: batch.length,
			window: "local",
		});

		const stats = makeBatchStats(batch.length);

		await messaging?.sendCmdAwait?.("Import.BeginSession", {
			source: "drop",
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

				await handleSpotCandidates(spotCandidates, { file });
				await handleWorkingItemsMaster(workingItems, { file });
				await handleReferenceItems(referenceItems, { file });

				// @baustelle [IMPORT_SESSION_REDUCE]
				// Temporärer Client-Puffer bleibt vorerst erhalten, aber nur noch roh.
				importSession.ingest(
					{
						kind: "IMPORT_RESULT",
						name: file.name,
						meta: {
							fileName: file.name,
							spots: spotCandidates.length,
							working: workingItems.length,
							refs: referenceItems.length,
						},
					},
					{
						originFile: file?.name ?? null,
						slotHint: store?.getState?.()?.activeSlot ?? "right",
					}
				);

			} catch (err) {
				stats.failed += 1;
				console.error("import failed detail:", err);
				safeLog(`❌ import failed: ${file.name}`);
				safeLog(String(err?.stack || err));
				ui?.setStatusError?.();
			}
		}

		if (typeof ui?.setSpotState === "function") {
			ui.setSpotState(importSession.getUIState?.({
				slotHint: store?.getState?.()?.activeSlot ?? "right",
			}) ?? importSession.getState?.() ?? []);
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
