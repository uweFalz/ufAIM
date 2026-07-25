// app/controllers/importController.js

import { installFileDrop } from "@io/input/fileDrop.js";
import { buildVisibleTracksFromImportItems } from "@app/io/import/importVisibleTracksAdapter.js";

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
	makeImportResultEvidencePublication,
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
	const trace = () => globalThis.__ufAIM_importTrace === true;

	if (!store?.getState || !store?.setState) {
		throw new Error("ImportController: missing store");
	}

	const sampleStep = Number.isFinite(prefs?.view?.sampleStep)
		? prefs.view.sampleStep
		: 5;
	let batchTail = Promise.resolve();
	let commandTail = Promise.resolve();
	const runtimeMetrics = {
		queuedBatches: 0,
		completedBatches: 0,
		activeBatches: 0,
		maxActiveBatches: 0,
		activeCommands: 0,
		maxActiveCommands: 0,
		queuedCommands: 0,
		maxQueueDepth: 0,
		maxRoundTripMs: 0,
		timeouts: 0,
		payloadBytes: 0,
		responseBytes: 0,
		publishedSources: 0,
		publishedItems: 0,
		stateRefreshes: 0,
	};

	function sendImportCommand(name, payload, timeoutMs = 20000) {
		runtimeMetrics.queuedCommands += 1;
		runtimeMetrics.maxQueueDepth = Math.max(runtimeMetrics.maxQueueDepth, runtimeMetrics.queuedCommands);
		runtimeMetrics.payloadBytes += estimateBytes(payload);
		const execute = async () => {
			runtimeMetrics.queuedCommands -= 1;
			runtimeMetrics.activeCommands += 1;
			runtimeMetrics.maxActiveCommands = Math.max(runtimeMetrics.maxActiveCommands, runtimeMetrics.activeCommands);
			const started = performance.now();
			try {
				const response = await messaging.sendCmdAwait(name, payload, { timeoutMs });
				runtimeMetrics.responseBytes += estimateBytes(response);
				return response;
			} catch (error) {
				if (/timeout/i.test(String(error?.message ?? error))) runtimeMetrics.timeouts += 1;
				throw error;
			} finally {
				runtimeMetrics.maxRoundTripMs = Math.max(runtimeMetrics.maxRoundTripMs, performance.now() - started);
				runtimeMetrics.activeCommands -= 1;
			}
		};
		const pending = commandTail.then(execute, execute);
		commandTail = pending.catch(() => {});
		return pending;
	}

	async function handleImportItemsMaster(items = []) {
		if (!items.length) return;

		if (!messaging?.sendCmdAwait) {
			console.warn("no messaging available for Import.AddItems");
			return;
		}

		safeLog(`master import add: items=${items.length}`);
		if (trace()) console.debug("[ImportController] Import.AddItems ->", summarizeItemsForMasterLog(items));

		await sendImportCommand("Import.AddItems", { items });
	}

	async function handleImportResultEvidenceMaster(publication) {
		if (!publication?.evidence) return false;
		if (!messaging?.sendCmdAwait) return false;
		safeLog(`master import evidence: items=${publication.items.length}`);
		await sendImportCommand("Import.PublishResultEvidence", publication, 30000);
		runtimeMetrics.publishedSources += 1;
		runtimeMetrics.publishedItems += publication.items.length;
		return true;
	}

	async function refreshImportStateFromMaster() {
		if (!messaging?.sendCmdAwait) return null;

		const state = await sendImportCommand("Import.GetState", {}, 12000);
		runtimeMetrics.stateRefreshes += 1;
		const count = Array.isArray(state?.items) ? state.items.length : 0;

		safeLog(`master import state: items=${count}`);
		if (trace()) console.debug("[ImportController] Import.GetState <-", {
			itemCount: count,
			sessionId: state?.sessionId ?? null,
		});

		return state;
	}

	function logRelationCandidates(fileName, relationCandidates) {
		const summary = summarizeRelationCandidatesForLog(fileName, relationCandidates);
		if (trace()) safeLog(`relation candidates: ${fileName} :: ${summary.count}`);
		if (trace()) console.debug("[ImportController] relationCandidates", summary);
	}

	function logGndRelationAnalysis(fileName, items, relationCandidates) {
		if (!trace()) return;
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
		if (!trace()) return;
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

	function commitVisibleTracks(tracks = []) {
		if (!tracks.length) return false;

		if (store.actions?.setWorkspaceVisibleTracks) {
			store.actions.setWorkspaceVisibleTracks({
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

		if (trace()) console.debug("[ImportController] preview committed", {
			id: firstPreviewCandidate.id,
			hasKernel: Boolean(firstPreviewCandidate.kernel),
		});
		return true;
	}

	async function runImportBatch(files) {
		const batch = Array.from(files ?? []);

		messaging?.emitEvt?.("Import.DropObserved", {
			fileCount: batch.length,
			window: "local",
		});

		const stats = makeBatchStats(batch.length);
		const visibleTracks = [];

		clearVisibleTracks();

		await sendImportCommand("Import.BeginSession", {
			source: "drop",
		});

		let firstPreviewCandidate = null;

		for (const [sourceIndex, file] of batch.entries()) {
			const scenarioId = `source-${String(sourceIndex + 1).padStart(3, "0")}`;
			safeLog(`import: ${scenarioId}`);

			try {
				const result = await importOneFile(file, {
					log: safeLog,
					onImportPhase: ({ code, status }) => safeLog(`MDB: ${code}${status ? ` :: ${status}` : ""}`),
				});

				const items = getResultItems(result);
				const rejected = getRejectedItems(result);
				const relationCandidates = getRelationCandidates(result);
				const promotableAlignmentItems = getPromotableAlignmentItems(items);
				const publication = makeImportResultEvidencePublication(result, {
					fileName: file.name,
					parserId: result?.meta?.sourceFormat ?? null,
					completedAt: new Date().toISOString(),
				});

				accountResult(stats, result);

				safeLog(`import status: ${scenarioId} :: ${result?.status ?? "unknown"}`);
				if (result?.meta?.gndSource) {
					const source = result.meta.gndSource;
					safeLog(`GND ${scenarioId}: retained=${source.retainedEvidenceCount} :: status=${source.status}`);
					if (trace()) safeLog(`GND ${scenarioId}: extractor=${source.extractor.id} ${source.extractor.version} :: core=${source.coreTables.join(", ")} :: additional=${source.additionalTables.join(", ") || "none"}`);
				}

				if (trace()) console.debug(
					"[ImportController] result",
					summarizeImportResultForLog(file.name, result)
				);

				logRelationCandidates(file.name, relationCandidates);
				logGndRelationAnalysis(file.name, items, relationCandidates);
				logGndCrsAnalysis(file.name, items, relationCandidates);

				const newTracks = buildVisibleTracksFromImportItems({
					items,
					fileName: file.name,
					sampleStep,
				});
				if (newTracks.length) {
					visibleTracks.push(...newTracks);
					commitVisibleTracks(visibleTracks);
					safeLog(`Anzeige: ${file.name} :: ${newTracks.length} Spur(en)`);
				}

				if (!(await handleImportResultEvidenceMaster(publication))) {
					await handleImportItemsMaster([...items, ...rejected]);
				}

				if (!firstPreviewCandidate && promotableAlignmentItems.length > 0) {
					const linkedCandidate = publication?.items?.find((item) => item?.id === promotableAlignmentItems[0]?.id) ?? promotableAlignmentItems[0];
					firstPreviewCandidate = makePreviewCandidate(linkedCandidate, {
						source: publication?.evidence?.source ?? null,
					});
					if (trace()) console.debug("[ImportController] firstPreviewCandidate", {
						id: firstPreviewCandidate.id,
					});
				}

				ui?.setImportSummary?.({
					fileName: file.name,
					items: items.length,
					rejected: rejected.length,
					promotable: promotableAlignmentItems.length,
					visible: newTracks.length,
					error: false,
				});

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
		await refreshImportStateFromMaster();

		safeLog(makeBatchSummaryLine(stats));
		return { stats, metrics: getRuntimeMetrics() };
	}

	function importFiles(files) {
		const batch = Array.from(files ?? []);
		runtimeMetrics.queuedBatches += 1;
		const execute = async () => {
			runtimeMetrics.activeBatches += 1;
			runtimeMetrics.maxActiveBatches = Math.max(runtimeMetrics.maxActiveBatches, runtimeMetrics.activeBatches);
			try {
				return await runImportBatch(batch);
			} finally {
				runtimeMetrics.activeBatches -= 1;
				runtimeMetrics.completedBatches += 1;
			}
		};
		const pending = batchTail.then(execute, execute);
		batchTail = pending.catch(() => {});
		return pending;
	}

	function getRuntimeMetrics() {
		return Object.freeze({ ...runtimeMetrics });
	}

	function publishSyntheticBatch(publications = [], { source = "synthetic-load-e2e" } = {}) {
		const execute = async () => {
			runtimeMetrics.activeBatches += 1;
			runtimeMetrics.maxActiveBatches = Math.max(runtimeMetrics.maxActiveBatches, runtimeMetrics.activeBatches);
			try {
				await sendImportCommand("Import.BeginSession", { source });
				for (const publication of publications) {
					await handleImportResultEvidenceMaster(publication);
				}
				await refreshImportStateFromMaster();
				return { metrics: getRuntimeMetrics() };
			} finally {
				runtimeMetrics.activeBatches -= 1;
				runtimeMetrics.completedBatches += 1;
			}
		};
		runtimeMetrics.queuedBatches += 1;
		const pending = batchTail.then(execute, execute);
		batchTail = pending.catch(() => {});
		return pending;
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
		getRuntimeMetrics,
		publishSyntheticBatch,
	};
}

function estimateBytes(value) {
	try {
		return new TextEncoder().encode(JSON.stringify(value ?? null)).byteLength;
	} catch {
		return 0;
	}
}
