// app/controllers/importController.js

import { installFileDrop } from "@io/input/fileDrop.js";
import { buildVisibleTracksFromImportItems } from "@app/io/import/importVisibleTracksAdapter.js";
import {
	createImportJob,
	throwIfImportJobAborted,
} from "@app/io/import/ImportJob.js";

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
	let disposeDrop = null;
	let activeImportJob = null;
	let visibleTracksSnapshot = [];
	const terminalOutcomeObservers = new Set();
	const importActivityObservers = new Set();
	let fileDropLifecycle = Object.freeze({
		state: "idle",
		code: null,
		fileCount: 0,
		message: null,
	});
	const fileDropLifecycleHistory = [fileDropLifecycle];
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

		// The terminal import path only needs status and counts. Requesting every
		// imported item here makes a large, already-committed GND session cross
		// the Worker boundary a second time and can turn success into a timeout.
		const state = await sendImportCommand("Import.GetState", { projection: "summary" }, 12000);
		runtimeMetrics.stateRefreshes += 1;
		const count = Number(state?.stats?.accepted ?? 0);

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
		visibleTracksSnapshot = tracks.map((track) => ({ ...track, polyline2d: [...(track?.polyline2d ?? [])] }));

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
		visibleTracksSnapshot = [];
		store.actions?.clearWorkspaceVisibleTracks?.();
	}

	function getVisibleTracks() {
		return structuredClone(visibleTracksSnapshot);
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
		const fileNames = Object.freeze(batch.map((file) => String(file?.name ?? "")));
		const fileStates = batch.map((file, sourceIndex) => ({
			sourceIndex,
			fileName: String(file?.name ?? ""),
			state: "queued",
			phase: null,
		}));
		const snapshotFileStates = () => Object.freeze(fileStates.map((entry) => Object.freeze({ ...entry })));
		const batchId = globalThis.crypto?.randomUUID?.()
			?? `import-batch-${Date.now()}-${Math.random()}`;
		const stagedFiles = [];
		const failedFiles = [];

		messaging?.emitEvt?.("Import.DropObserved", {
			fileCount: batch.length,
			batchId,
			window: "local",
		});

		const stats = makeBatchStats(batch.length);

		for (const [sourceIndex, file] of batch.entries()) {
			const job = createImportJob({ file });
			activeImportJob = job;
			fileStates[sourceIndex] = { ...fileStates[sourceIndex], state: "processing", phase: job.snapshot().phase };
			publishImportActivity(Object.freeze({
				state: "processing",
				fileCount: batch.length,
				fileNames,
				fileStates: snapshotFileStates(),
				activeFileIndex: sourceIndex,
				activeFileName: String(file?.name ?? ""),
				job: job.snapshot(),
			}));
			const scenarioId = `source-${String(sourceIndex + 1).padStart(3, "0")}`;
			safeLog(`import: ${scenarioId}`);

			try {
				const result = await importOneFile(file, {
					log: safeLog,
						onImportPhase: ({ code, status }) => {
						fileStates[sourceIndex] = { ...fileStates[sourceIndex], phase: String(code ?? "unknown") };
						safeLog(`MDB: ${code}${status ? ` :: ${status}` : ""}`);
						publishImportActivity(Object.freeze({
							state: "processing",
							fileCount: batch.length,
							fileNames,
							activeFileName: String(file?.name ?? ""),
							activeFileIndex: sourceIndex,
							fileStates: snapshotFileStates(),
							importPhase: Object.freeze({
								code: String(code ?? "unknown"),
								status: status == null ? null : String(status),
							}),
							job: job.snapshot(),
						}));
					},
					onJobPhase: (phase) => {
						job.update({ phase });
						fileStates[sourceIndex] = { ...fileStates[sourceIndex], phase: String(phase ?? "unknown") };
						publishImportActivity(Object.freeze({
							state: "processing",
							fileCount: batch.length,
							fileNames,
							activeFileName: String(file?.name ?? ""),
							activeFileIndex: sourceIndex,
							fileStates: snapshotFileStates(),
							job: job.snapshot(),
						}));
					},
					signal: job.signal,
				});
				throwIfImportJobAborted(job.signal);

				const items = applyExistingSourceTrustAssessment(
					getResultItems(result),
					result
				);
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
				job.update({ phase: "staged" });
				const outcome = Object.freeze({
					fileName: String(file?.name ?? ""),
					extension: fileExtension(file?.name),
					status: String(result?.status ?? "unknown"),
					reason: result?.reason == null ? null : String(result.reason),
					parserId: result?.meta?.sourceFormat == null
						? null
						: String(result.meta.sourceFormat),
					itemCount: items.length,
					rejectedCount: rejected.length,
					evidencePublished: Boolean(publication?.evidence),
					failed: false,
				});
				stagedFiles.push({
					sourceIndex,
					job,
					file,
					result,
					items,
					rejectedItems: rejected,
					publication,
					promotableAlignmentItems,
					newTracks,
					outcome,
				});
				fileStates[sourceIndex] = { ...fileStates[sourceIndex], state: "staged", phase: "staged" };
				publishImportActivity(Object.freeze({
					state: "processing",
					fileCount: batch.length,
					fileNames,
					fileStates: snapshotFileStates(),
					activeFileIndex: sourceIndex,
					activeFileName: String(file?.name ?? ""),
					job: job.snapshot(),
				}));

			} catch (err) {
				if (err?.name === "AbortError" || job.signal.aborted) {
					for (const staged of stagedFiles) {
						staged.job.abort("batch-cancelled");
					}
					return {
						status: "cancelled",
						batchId,
						fileOutcomes: Object.freeze([]),
						jobs: Object.freeze([
							...stagedFiles.map((staged) => staged.job.snapshot()),
							job.snapshot(),
						]),
						stats,
						metrics: getRuntimeMetrics(),
					};
				}
				stats.failed += 1;
				job.fail(err);
				const outcome = Object.freeze({
					fileName: String(file?.name ?? ""),
					extension: fileExtension(file?.name),
					status: "failed",
					reason: String(err?.code ?? err?.message ?? "IMPORT_FILE_FAILED"),
					parserId: null,
					itemCount: 0,
					rejectedCount: 0,
					evidencePublished: false,
					failed: true,
				});
				failedFiles.push({ sourceIndex, job, file, outcome });
				fileStates[sourceIndex] = { ...fileStates[sourceIndex], state: "failed", phase: "failed" };
				publishImportActivity(Object.freeze({
					state: "processing",
					fileCount: batch.length,
					fileNames,
					fileStates: snapshotFileStates(),
					activeFileIndex: sourceIndex,
					activeFileName: String(file?.name ?? ""),
					job: job.snapshot(),
				}));
			}
		}

		const commitCandidates = [...stagedFiles];
		stagedFiles.length = 0;
		for (const staged of commitCandidates) {
			staged.job.update({ phase: "committing" });
			try {
				if (staged.publication?.evidence) {
					await sendImportCommand("Import.CommitJob", {
						batchId,
						source: { fileName: staged.file.name },
						files: [{
							jobId: staged.job.jobId,
							fileName: staged.file.name,
							publication: staged.publication,
							items: staged.items,
							rejectedItems: staged.rejectedItems,
						}],
					}, 30000);
					runtimeMetrics.publishedSources += 1;
					runtimeMetrics.publishedItems += staged.items.length + staged.rejectedItems.length;
				}
				stagedFiles.push(staged);
			} catch (error) {
				staged.job.fail(error);
				failedFiles.push({
					sourceIndex: staged.sourceIndex,
					job: staged.job,
					file: staged.file,
					outcome: Object.freeze({
						...staged.outcome,
						status: "failed",
						reason: String(error?.code ?? error?.message ?? "IMPORT_COMMIT_FAILED"),
						itemCount: 0,
						rejectedCount: 0,
						evidencePublished: false,
						failed: true,
					}),
				});
				fileStates[staged.sourceIndex] = { ...fileStates[staged.sourceIndex], state: "failed", phase: "failed" };
			}
		}

		const visibleTracks = stagedFiles.flatMap((staged) => staged.newTracks);
		const firstPreviewCandidate = stagedFiles
			.flatMap((staged) => staged.promotableAlignmentItems.map((item) => ({
				item,
				source: staged.publication?.evidence?.source ?? null,
			})))
			.map(({ item, source }) => makePreviewCandidate(item, { source }))
			.find(Boolean) ?? null;
		clearVisibleTracks();
		commitVisibleTracks(visibleTracks);
		commitPreviewCandidate(firstPreviewCandidate);
		const fileOutcomes = [...stagedFiles, ...failedFiles]
			.sort((a, b) => a.sourceIndex - b.sourceIndex)
			.map((entry) => entry.outcome);
		for (const staged of stagedFiles) {
			staged.job.complete(staged.outcome);
			const outcomeStatus = String(staged.outcome?.status ?? "").toLowerCase();
			if (["unsupported", "unknown"].includes(outcomeStatus)) {
				fileStates[staged.sourceIndex] = { ...fileStates[staged.sourceIndex], state: "unsupported", phase: "unsupported" };
			} else {
				fileStates[staged.sourceIndex] = { ...fileStates[staged.sourceIndex], state: "completed", phase: "completed" };
			}
			safeLog(`file outcome: ${JSON.stringify(staged.outcome)}`);
		}
		const itemCount = stagedFiles.reduce((total, staged) => total + staged.items.length, 0);
		const rejectedCount = stagedFiles.reduce((total, staged) => total + staged.rejectedItems.length, 0);
		ui?.setImportSummary?.({
			fileName: batch.length === 1 ? batch[0].name : `${batch.length} files`,
			items: itemCount,
			rejected: rejectedCount,
			promotable: stagedFiles.reduce((total, staged) => total + staged.promotableAlignmentItems.length, 0),
			visible: visibleTracks.length,
			error: false,
		});
		await refreshImportStateFromMaster();

		safeLog(makeBatchSummaryLine(stats));
		return {
			status: failedFiles.length ? (stagedFiles.length ? "partial" : "failed") : "succeeded",
			batchId,
			stats,
			metrics: getRuntimeMetrics(),
			fileOutcomes: Object.freeze(fileOutcomes),
			fileStates: snapshotFileStates(),
			jobs: Object.freeze([...stagedFiles, ...failedFiles]
				.sort((a, b) => a.sourceIndex - b.sourceIndex)
				.map((entry) => entry.job.snapshot())),
		};
	}

	function importFiles(files) {
		const batch = Array.from(files ?? []);
		const fileNames = Object.freeze(batch.map((file) => String(file?.name ?? "")));
		publishImportActivity(Object.freeze({
			state: "accepted",
			fileCount: batch.length,
			fileNames,
			job: null,
		}));
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
		const pending = batchTail.then(execute, execute).then((outcome) => {
			const terminal = Object.freeze({
				state: outcome?.status === "cancelled" ? "cancelled" : outcome?.status === "failed" ? "failed" : "completed",
				code: null,
				fileCount: batch.length,
				fileNames,
				fileStates: outcome?.fileStates ?? null,
				message: null,
				outcome,
			});
			publishImportActivity(terminal);
			publishTerminalOutcome(terminal);
			return outcome;
		}, (error) => {
			const terminal = Object.freeze({
				state: "failed",
				code: String(error?.code ?? "IMPORT_BATCH_FAILED"),
				fileCount: batch.length,
				fileNames,
				fileStates: null,
				message: String(error?.message ?? error),
				outcome: null,
			});
			publishImportActivity(terminal);
			publishTerminalOutcome(terminal);
			throw error;
		});
		batchTail = pending.catch(() => {});
		return pending;
	}

	function getActiveImportJob() {
		return activeImportJob?.snapshot() ?? null;
	}

	function cancelActiveImportJob(reason = "user-request") {
		return activeImportJob?.abort(reason) ?? false;
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

	function installDrop({ element, onLifecycle } = {}) {
		disposeDrop?.();
		const installedDisposer = installFileDrop({
			element: element ?? document.documentElement,
			onFiles: importFiles,
			onLifecycle: (detail) => {
				fileDropLifecycle = detail;
				fileDropLifecycleHistory.push(detail);
				onLifecycle?.(detail);
				publishImportActivity(detail);
				if (detail?.state === "rejected" || (detail?.state === "failed" && detail?.code === "FILE_DROP_COLLECTION_FAILED")) publishTerminalOutcome(detail);
			},
		});
		disposeDrop = installedDisposer;
		return function disposeInstalledDrop() {
			installedDisposer();
			if (disposeDrop === installedDisposer) disposeDrop = null;
		};
	}

	function getFileDropLifecycle() {
		return fileDropLifecycle;
	}

	function getFileDropLifecycleHistory() {
		return Object.freeze([...fileDropLifecycleHistory]);
	}

	function subscribeTerminalOutcomes(observer) {
		if (typeof observer !== "function") {
			throw new TypeError("ImportController: terminal outcome observer must be a function");
		}
		terminalOutcomeObservers.add(observer);
		return () => terminalOutcomeObservers.delete(observer);
	}

	function subscribeImportActivity(observer) {
		if (typeof observer !== "function") {
			throw new TypeError("ImportController: import activity observer must be a function");
		}
		importActivityObservers.add(observer);
		return () => importActivityObservers.delete(observer);
	}

	function publishImportActivity(detail) {
		for (const observer of importActivityObservers) {
			Promise.resolve(observer(detail)).catch((error) => {
				console.error("[ImportController] import activity observer failed", error);
			});
		}
	}

	function publishTerminalOutcome(detail) {
		for (const observer of terminalOutcomeObservers) {
			Promise.resolve(observer(detail)).catch((error) => {
				console.error("[ImportController] terminal outcome observer failed", error);
			});
		}
	}

	return {
		importFiles,
		installDrop,
		getFileDropLifecycle,
		getFileDropLifecycleHistory,
		subscribeTerminalOutcomes,
		subscribeImportActivity,
		getActiveImportJob,
		cancelActiveImportJob,
		getRuntimeMetrics,
		getVisibleTracks,
		publishSyntheticBatch,
	};
}

export function applyExistingSourceTrustAssessment(items, result) {
	const list = Array.isArray(items) ? items : [];
	if (!result?.meta?.gndSource) return list;
	return list.map((item) => {
		if (item?.kind !== "alignment") return item;
		return {
			...item,
			derived: {
				...(item?.derived ?? {}),
				importAssessment: {
					sourceTrustClass: "authoritative_context",
					sourceFormat: result?.meta?.sourceFormat ?? null,
				},
			},
		};
	});
}

function estimateBytes(value) {
	try {
		return new TextEncoder().encode(JSON.stringify(value ?? null)).byteLength;
	} catch {
		return 0;
	}
}

function fileExtension(fileName) {
	const name = String(fileName ?? "");
	const dot = name.lastIndexOf(".");
	return dot > 0 && dot < name.length - 1
		? name.slice(dot).toLowerCase()
		: "";
}
