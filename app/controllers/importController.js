// app/controllers/importController.js
//
// ImportController
//
// Window-local import entry point.
//
// Flow:
//   FileDrop -> ImportPipelineClient -> ImportSession -> local preview
//
// Responsibilities:
// - receives dropped files
// - runs import pipeline through app-side facade
// - sends canonical ImportSessionItems to master
// - stores one local preview candidate for rendering
//
// NOT:
// - no direct src/import/runImportPipeline.js import
// - no implicit SPOT promotion
// - no local SPOT duplication
// - no parser-specific hacks
// - no SPOT overlay updates here
//
// Rule:
// Imported data is stored canonically in master import-session state.
// Preview is local-only until explicit acceptance/promotion happens later.

import { installFileDrop } from "@io/input/fileDrop.js";

import {
	importOneFile,
	makeBatchStats,
	accountResult,
	makeBatchSummaryLine,
	getResultItems,
	getRejectedItems,
	getRelationCandidates,
	getPromotableAlignmentItems,
	makePreviewCandidate,
	summarizeImportResultForLog,
	summarizeRelationCandidatesForLog,
	summarizeItemsForMasterLog,
} from "@app/io/import/importPipelineClient.js";

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

	async function handleImportItemsMaster(items = []) {
		if (!items.length) return;

		if (!messaging?.sendCmdAwait) {
			console.warn("no messaging available for Import.AddItems");
			return;
		}

		safeLog(`master import add: items=${items.length}`);
		console.log("[ImportController] Import.AddItems ->", summarizeItemsForMasterLog(items));

		await messaging.sendCmdAwait("Import.AddItems", { items });
	}

	async function refreshImportStateFromMaster() {
		if (!messaging?.sendCmdAwait) return null;

		const state = await messaging.sendCmdAwait("Import.GetState", {});
		const count = Array.isArray(state?.items) ? state.items.length : 0;

		safeLog(`master import state: items=${count}`);
		console.log("[ImportController] Import.GetState <-", state);

		return state;
	}

	function logRelationCandidates(fileName, relationCandidates) {
		const summary = summarizeRelationCandidatesForLog(fileName, relationCandidates);

		safeLog(`relation candidates: ${fileName} :: ${summary.count}`);
		console.log("[ImportController] relationCandidates", summary);
	}

	function commitPreviewCandidate(firstPreviewCandidate) {
		if (!firstPreviewCandidate) {
			console.warn("[ImportController] no preview candidate found in batch");
			return false;
		}

		store.actions?.setPreviewItem?.({
			item: firstPreviewCandidate,
			source: { type: "import-preview" },
		});

		console.log("[ImportController] preview committed to store =", firstPreviewCandidate);

		// Preview must win until user explicitly activates a canonical object.
		store.actions?.setActiveRouteProject?.(null);
		store.actions?.setCursorS?.(0);

		return true;
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

		let firstPreviewCandidate = null;

		for (const file of batch) {
			safeLog(`import: ${file.name}`);

			try {
				const result = await importOneFile(file, { log: safeLog });

				const items = getResultItems(result);
				const rejected = getRejectedItems(result);
				const relationCandidates = getRelationCandidates(result);
				const promotableAlignmentItems = getPromotableAlignmentItems(items);

				accountResult(stats, result);

				safeLog(`import status: ${file.name} :: ${result?.status ?? "unknown"}`);

				console.log(
					"[ImportController] result",
					summarizeImportResultForLog(file.name, result)
				);

				logRelationCandidates(file.name, relationCandidates);

				await handleImportItemsMaster([...items, ...rejected]);

				if (!firstPreviewCandidate && promotableAlignmentItems.length > 0) {
					firstPreviewCandidate = makePreviewCandidate(promotableAlignmentItems[0]);
					console.log("[ImportController] firstPreviewCandidate =", firstPreviewCandidate);
				}

				ui?.setImportSummary?.({
					fileName: file.name,
					items: items.length,
					rejected: rejected.length,
					promotable: promotableAlignmentItems.length,
					error: false,
				});

				await refreshImportStateFromMaster();
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

		commitPreviewCandidate(firstPreviewCandidate);
		safeLog(makeBatchSummaryLine(stats));
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
