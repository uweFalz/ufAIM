// app/core/controllers/importController.js
//
// ImportController
//
// Window-local import entry point.
//
// Flow:
//   FileDrop → importPipeline → SPOT → local focus → view
//
// Responsibilities:
// - runs importPipeline for dropped files
// - sends validated results to master (SPOT / Import services)
// - updates local UI state (summary, status)
// - sets local focus on newly created SPOT objects
//
// NOT:
// - no preview/shadow data
// - no direct visualization artifacts
// - no local SPOT duplication
//
// Rule:
// Imported data becomes visible only after it exists in SPOT.
// This window may then focus and display it locally.
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
// - keine lokale SPOT-Schattenwelt
//
// Grundidee:
// Alles, was die importPipeline geprüft verlässt, landet markiert im Master / SPOT.
// Der Client ist nur noch Intent-/Dispatch-Schicht.

import { installFileDrop } from "@app/io/input/fileDrop.js";
import { runImportPipeline } from "@src/import/runImportPipeline.js";

export function makeImportController({
	store,
	ui,
	logLine,
	prefs,
	messaging,
	focusManager,
} = {}) {
	const safeLog = typeof logLine === "function"
	? logLine
	: (msg) => ui?.logLine?.(msg);

	if (!store?.getState || !store?.setState) {
		throw new Error("ImportController: missing store");
	}

	async function importOneFile(file) {
		return await runImportPipeline(file, { log: safeLog });
	}

	function makeBatchStats(totalFiles) {
		return {
			totalFiles,
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

	async function handleSpotCandidates(candidates = []) {
		if (!candidates.length) return;

		if (!messaging?.sendCmdAwait) {
			console.warn("no messaging available for Spot.AddCandidates");
			return;
		}

		await messaging.sendCmdAwait("Spot.AddCandidates", {
			spots: candidates,
		});
	}

	async function handleWorkingItemsMaster(items = [], { file }) {
		if (!items.length) return;

		if (!messaging?.sendCmdAwait) {
			console.warn("no messaging available for Import.AddItems");
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

		console.debug(
		"reference items ignored for now:",
		items.map((ref) => ({
			kind: ref?.kind ?? "unknown",
			name: ref?.name ?? file?.name ?? "unnamed",
		}))
		);

		// @baustelle [REFERENCE_STORE]
		// Sobald Reference.Add... o. ä. existiert, hier an den Master schicken.
	}

	async function refreshSpotUiFromMaster() {
		if (!messaging?.sendCmdAwait) return;

		const spotUiState = await messaging.sendCmdAwait("Spot.GetUiState", {});
		if (spotUiState && typeof ui?.setSpotState === "function") {
			ui.setSpotState(spotUiState);
		}

		/*
		if (typeof ui?.refreshSpot === "function") {
		ui.refreshSpot(store?.getState?.());
		}
		*/
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
			safeLog(`import: ${file.name}`);

			try {
				const result = await importOneFile(file);

				const spotCandidates = Array.isArray(result?.spotCandidates) ? result.spotCandidates : [];
				const workingItems = Array.isArray(result?.workingItems) ? result.workingItems : [];
				const referenceItems = Array.isArray(result?.referenceItems) ? result.referenceItems : [];

				accountResult(stats, result);
				
				safeLog(
				`import status: ${file.name} :: ` +
				`${result?.status ?? (result?.isEmpty ? "empty" : "processed")}`
				);

				await handleSpotCandidates(spotCandidates);
				await handleWorkingItemsMaster(workingItems, { file });
				await handleReferenceItems(referenceItems, { file });

				ui?.setImportSummary?.({
					fileName: file.name,
					spot: spotCandidates.length,
					working: workingItems.length,
					error: false,
				});

				await refreshSpotUiFromMaster();

				if (spotCandidates.length > 0) {
					ui?.openSpot?.();

					const first = spotCandidates[0];
					const objectId =
					first?.meta?.objectId ??
					first?.meta?.alignmentName ??
					first?.name ??
					null;

					if (objectId) {
						await focusManager?.setFocus?.({
							objectId,
							slot: "right",
						});
					}
				}

				if (!spotCandidates.length && !workingItems.length && !referenceItems.length) {
					console.debug("import produced no items:", {
						file: file.name,
						status: result?.status ?? "no-items",
						result,
					});
				}

			} catch (err) {
				stats.failed += 1;
				console.error("import failed detail:", err);
				ui?.setImportSummary?.({
					fileName: file.name,
					error: true,
				});
				ui?.setStatusError?.();
			}
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
	};
}
