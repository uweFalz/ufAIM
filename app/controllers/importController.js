// app/controllers/importController.js

import { installFileDrop } from "@io/input/fileDrop.js";
import {
	makeAlignmentProjectionInput,
	projectAlignmentPreview,
} from "@src/domain/projection/AlignmentProjectionService.js";

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

import { analyzeGndRelationCandidates } from "@src/import/analysis/gnd/GndRelationAnalyzer.js";
import { analyzeGndCrs } from "@src/import/analysis/gnd/GndCrsAnalyzer.js";

// ...
export function makeImportController({
	store,
	ui,
	logLine,
	prefs,
	messaging,
} = {}) {
	const safeLog = typeof logLine === "function"
		? logLine
		: (msg) => ui?.logLine?.(msg);

	if (!store?.getState || !store?.setState) {
		throw new Error("ImportController: missing store");
	}

	const sampleStep = Number.isFinite(prefs?.view?.sampleStep)
		? prefs.view.sampleStep
		: 5;

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

	function logGndRelationAnalysis(fileName, items, relationCandidates) {
		if (!String(fileName ?? "").toLowerCase().includes("gnd")) return;
		if (!relationCandidates?.length) return;

		try {
			const analysis = analyzeGndRelationCandidates({
				importItems: items,
				relationCandidates,
			});

			console.groupCollapsed(`[GND] relation analysis :: ${fileName}`);

			console.table([{
				totalRelations: analysis.totalRelations,
				uniqueSourceCount: analysis.uniqueSourceCount,
				uniqueTargetCount: analysis.uniqueTargetCount,
				duplicateGroupCount: analysis.duplicateGroups.length,
				ambiguousSourceCount: analysis.ambiguousSources.length,
				starTargetCount: analysis.starTargets.length,
			}]);

			console.log("byType", analysis.byType);
			console.log("byConfidence", analysis.byConfidence);
			console.log("duplicateGroups", analysis.duplicateGroups);
			console.log("ambiguousSources", analysis.ambiguousSources);
			console.log("starTargets", analysis.starTargets);

			if (analysis.duplicateSamples?.length) {
				console.log("duplicateSamples", analysis.duplicateSamples);
			}

			console.log("sampleRelations");
			console.table(analysis.sampleRelations);

			console.groupEnd();
		} catch (err) {
			console.warn("[GND] relation analysis failed (ignored)", err);
		}
	}

	function logGndCrsAnalysis(fileName, items, relationCandidates) {
		if (!String(fileName ?? "").toLowerCase().includes("gnd")) return;
		if (!items?.length) return;

		try {
			const analysis = analyzeGndCrs({
				importItems: items,
				relationCandidates,
			});

			console.groupCollapsed(`[GND] CRS analysis :: ${fileName}`);

			console.table([{
				totalItems: analysis.totalItems,
				totalRelations: analysis.totalRelations,
				missingCrsCount: analysis.missingCrsCount,
				relationSameCrs: analysis.relationCrsStats.sameCrs,
				relationDifferentCrs: analysis.relationCrsStats.differentCrs,
				relationMissingCrs: analysis.relationCrsStats.missingCrs,
			}]);

			console.log("byKind", analysis.byKind);
			console.log("byCrs", analysis.byCrs);
			console.log("alignmentsByCrs", analysis.alignmentsByCrs);
			console.log("profilesByCrs", analysis.profilesByCrs);
			console.log("cantsByCrs", analysis.cantsByCrs);
			console.log("missingCrsByKind", analysis.missingCrsByKind);

			console.log("crsSamples");
			console.table(analysis.crsSamples);

			const crsConflicts =
				analysis?.relationCrsStats?.differentCrsRelations ?? [];

			if (crsConflicts.length) {
				console.log(`[GND] CRS relation conflicts :: ${fileName}`);
				console.table(crsConflicts);
			}

			console.groupEnd();
		} catch (err) {
			console.warn("[GND] CRS analysis failed (ignored)", err);
		}
	}

	function makeVisibleTracksFromItems(items = [], fileName = "") {
		const tracks = [];

		for (const item of items) {
			if (item?.kind !== "alignment") continue;

			const input = makeAlignmentProjectionInput({
				objectId: item?.id ?? null,
				geometry: item?.derived?.sparseAlignment ?? null,
				source: "import-item",
				crsId: deriveItemCrsId(item),
			});
			if (!input) continue;

			const projected = projectAlignmentPreview({
				input,
				maxStep: sampleStep,
			});

			const points = projected?.polyline2d;
			if (!Array.isArray(points) || points.length < 2) continue;

			tracks.push({
				id: makeTrackId(fileName, item.id, tracks.length),
				importItemId: item.id ?? null,
				objectId: item.id ?? null,
				label: item?.payload?.name ?? item?.payload?.id ?? item.id ?? "import",
				points,
				source: "import-drop",
				crsId: deriveItemCrsId(item),
			});
		}

		return tracks;
	}

	function commitVisibleTracks(tracks = []) {
		if (!tracks.length) return false;

		if (store.actions?.setWorkspaceVisibleTracks) {
			store.actions.setWorkspaceVisibleTracks({
				items: tracks,
				source: { type: "import-drop" },
			});
			return true;
		}

		if (store.actions?.setImportPreviewCollection) {
			store.actions.setImportPreviewCollection({
				items: tracks,
				source: { type: "import-drop" },
			});
			return true;
		}

		console.warn("[ImportController] no visible-track store action available");
		return false;
	}

	function clearVisibleTracks() {
		store.actions?.clearWorkspaceVisibleTracks?.();
		store.actions?.clearImportPreviewCollection?.();
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

		store.actions?.setActiveRouteProject?.(null);
		store.actions?.clearWorkspacePrimary?.();
		store.actions?.setCursorS?.(0);

		console.log("[ImportController] preview committed to store =", firstPreviewCandidate);
		return true;
	}

	async function importFiles(files) {
		const batch = Array.from(files ?? []);

		messaging?.emitEvt?.("Import.DropObserved", {
			fileCount: batch.length,
			window: "local",
		});

		const stats = makeBatchStats(batch.length);
		const visibleTracks = [];

		clearVisibleTracks();

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
				logGndRelationAnalysis(file.name, items, relationCandidates);
				logGndCrsAnalysis(file.name, items, relationCandidates);

				const newTracks = makeVisibleTracksFromItems(items, file.name);
				if (newTracks.length) {
					visibleTracks.push(...newTracks);
					commitVisibleTracks(visibleTracks);
					safeLog(`Anzeige: ${file.name} :: ${newTracks.length} Spur(en)`);
				}

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
					visible: newTracks.length,
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
		commitVisibleTracks(visibleTracks);

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

function deriveItemCrsId(item) {
	const sr = item?.derived?.spatialRef ?? null;

	return (
		sr?.crsId ??
		sr?.horizontalCrsId ??
		sr?.horizontal ??
		sr?.horizontalCoordinateSystemName ??
		null
	);
}

function makeTrackId(fileName, itemId, index) {
	const f = safeIdStem(fileName || "drop");
	const i = safeIdStem(itemId || `item_${index}`);
	return `import_${f}_${i}_${index}`;
}

function safeIdStem(value) {
	return String(value ?? "x")
		.trim()
		.replace(/\.[^.]+$/g, "")
		.replace(/[^a-zA-Z0-9_\-]+/g, "_")
		.replace(/^_+|_+$/g, "")
		|| "x";
}
