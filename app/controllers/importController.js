// app/controllers/importController.js
//
// ImportController
//
// Window-local import entry point.
//
// Flow:
//   FileDrop -> importPipeline -> ImportSession -> local preview
//
// Responsibilities:
// - runs importPipeline for dropped files
// - sends canonical ImportSessionItems to master
// - stores one local preview candidate for rendering
//
// NOT:
// - no implicit SPOT promotion
// - no local SPOT duplication
// - no parser-specific hacks
// - no SPOT overlay updates here
//
// Rule:
// Imported data is stored canonically in master import-session state.
// Preview is local-only until explicit acceptance/promotion happens later.

import { installFileDrop } from "@io/input/fileDrop.js";
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
			empty: 0,
			processed: 0,
			unknown: 0,
			failed: 0,

			itemCount: 0,
			rejectedCount: 0,
			relationCandidateCount: 0,

			promotableCount: 0,
			acceptedCount: 0,
			alignmentCount: 0,
			profileCount: 0,
			cantCount: 0,
			staEqCount: 0,
			relationCount: 0,
		};
	}

	function accountResult(stats, result) {
		const items = Array.isArray(result?.items) ? result.items : [];
		const rejected = Array.isArray(result?.rejected) ? result.rejected : [];
		const relationCandidates = Array.isArray(result?.relationCandidates)
			? result.relationCandidates
			: [];

		stats.itemCount += items.length;
		stats.rejectedCount += rejected.length;
		stats.relationCandidateCount += relationCandidates.length;

		for (const item of items) {
			switch (item?.kind) {
				case "alignment":
					stats.alignmentCount += 1;
					break;
				case "profile":
					stats.profileCount += 1;
					break;
				case "cant":
					stats.cantCount += 1;
					break;
				case "staEq":
					stats.staEqCount += 1;
					break;
				case "relation":
					stats.relationCount += 1;
					break;
				default:
					break;
			}

			if (item?.status?.promotable === true) {
				stats.promotableCount += 1;
			}
			if (item?.status?.accepted === true) {
				stats.acceptedCount += 1;
			}
		}

		const status = result?.status ?? null;

		switch (status) {
			case "ignored":
				stats.ignored += 1;
				break;
			case "no-items":
			case "empty":
			case "rejected":
			case "invalid":
				stats.empty += 1;
				break;
			case "ok":
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
			`${stats.empty} empty / ` +
			`${stats.processed} processed / ` +
			`${stats.unknown} unknown / ` +
			`${stats.failed} failed / ` +
			`${stats.itemCount} items / ` +
			`${stats.rejectedCount} rejected / ` +
			`${stats.relationCandidateCount} relationCandidates / ` +
			`${stats.promotableCount} promotable / ` +
			`${stats.acceptedCount} accepted / ` +
			`${stats.alignmentCount} alignments / ` +
			`${stats.profileCount} profiles / ` +
			`${stats.cantCount} cants / ` +
			`${stats.staEqCount} staEq / ` +
			`${stats.relationCount} relations`
		);
	}

	function getResultItems(result) {
		return Array.isArray(result?.items) ? result.items : [];
	}

	function getRejectedItems(result) {
		return Array.isArray(result?.rejected) ? result.rejected : [];
	}

	function getRelationCandidates(result) {
		return Array.isArray(result?.relationCandidates) ? result.relationCandidates : [];
	}

	function getPromotableAlignmentItems(items = []) {
		return items.filter((item) =>
			item?.kind === "alignment" &&
			item?.status?.valid === true &&
			item?.status?.promotable === true &&
			item?.derived?.sparseAlignment
		);
	}

	function makePreviewCandidate(item) {
		if (!item?.derived?.sparseAlignment) return null;

		return {
			id: item.id ?? item?.payload?.id ?? item?.payload?.name ?? "preview_alignment",
			kind: item.kind ?? "alignment",
			name:
				item?.payload?.name ??
				item?.payload?.id ??
				item?.source?.objectName ??
				item?.id ??
				"preview",
			sparseAlignment: item.derived.sparseAlignment,
			spatialRef:
				item?.payload?.spatialRef ??
				item?.payload?.coordinateSystem ??
				item?.payload?.crs ??
				null,
			source: {
				fileName: item?.source?.fileName ?? null,
				parserId: item?.source?.parserId ?? null,
				objectName: item?.source?.objectName ?? null,
			},
		};
	}

	async function handleImportItemsMaster(items = []) {
		if (!items.length) return;
		if (!messaging?.sendCmdAwait) {
			console.warn("no messaging available for Import.AddItems");
			return;
		}

		safeLog(`master import add: items=${items.length}`);
		console.log("[ImportController] Import.AddItems ->", items.map((item) => ({
			id: item?.id,
			kind: item?.kind,
			promotable: item?.status?.promotable,
			stage: item?.status?.stage,
			reason: item?.status?.reason ?? null,
			hasSparse: Boolean(item?.derived?.sparseAlignment),
			interpretation: item?.derived?.interpretation ?? null,
			meta: item?.meta ?? null,
			name: item?.payload?.name ?? item?.payload?.id ?? null,
		})));

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
		const list = Array.isArray(relationCandidates) ? relationCandidates : [];
		safeLog(`relation candidates: ${fileName} :: ${list.length}`);

		console.log("[ImportController] relationCandidates", {
			fileName,
			count: list.length,
			relationCandidates: list.map((rel) => ({
				type: rel?.type ?? null,
				from: rel?.from ?? null,
				to: rel?.to ?? null,
				confidence: rel?.confidence ?? null,
				reasons: Array.isArray(rel?.reasons) ? rel.reasons : [],
			})),
		});
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
				const result = await importOneFile(file);

				const items = getResultItems(result);
				const rejected = getRejectedItems(result);
				const relationCandidates = getRelationCandidates(result);
				const promotableAlignmentItems = getPromotableAlignmentItems(items);

				accountResult(stats, result);

				safeLog(
					`import status: ${file.name} :: ${result?.status ?? "unknown"}`
				);

				console.log("[ImportController] result", {
					fileName: file.name,
					status: result?.status ?? "unknown",
					items: items.map((item) => ({
						id: item?.id,
						kind: item?.kind,
						name: item?.payload?.name ?? item?.payload?.id ?? null,
						promotable: item?.status?.promotable,
						stage: item?.status?.stage,
						reason: item?.status?.reason ?? null,
						hasSparse: Boolean(item?.derived?.sparseAlignment),
						interpretation: item?.derived?.interpretation ?? null,
						meta: item?.meta ?? null,
					})),
					rejected: rejected.map((item) => ({
						id: item?.id,
						kind: item?.kind,
						reason: item?.status?.reason ?? item?.reason ?? null,
						meta: item?.meta ?? null,
					})),
				});

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

		if (firstPreviewCandidate) {
			store.actions?.setPreviewItem?.({
				item: firstPreviewCandidate,
				source: { type: "import-preview" },
			});

			console.log("[ImportController] preview committed to store =", firstPreviewCandidate);

			// preview must win until user explicitly activates a canonical object
			store.actions?.setActiveRouteProject?.(null);
			store.actions?.setCursorS?.(0);
		} else {
			console.warn("[ImportController] no preview candidate found in batch");
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
