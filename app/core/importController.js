// app/core/importController.js

import { installFileDrop } from "../io/fileDrop.js";
import { makeImportSession } from "../io/importSession.js";
import { applyIngestResult } from "../io/importApply.js";
import { runImportPipeline } from "@src/import/runImportPipeline.js";

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
			artifactCount: 0,
		};
	}

	function accountResult(stats, result) {
		const status = result?.status ?? "unknown";
		const artifactCount = Array.isArray(result?.artifacts) ? result.artifacts.length : 0;

		stats.artifactCount += artifactCount;

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
			`${stats.artifactCount} artifacts`
		);
	}

	async function importFiles(files) {
		const batch = Array.from(files ?? []);
		const st = store.getState?.() ?? {};
		const slotHint = st.activeSlot ?? "right";
		const stats = makeBatchStats(batch.length);

		for (const file of batch) {
			safeLog(`drop: ${file.name}`);

			try {
				const result = await importOneFile(file);
				const artifacts = Array.isArray(result?.artifacts) ? result.artifacts : [];

				accountResult(stats, result);

				if (!artifacts.length) {
					const label = result?.status ?? "no-artifacts";
					safeLog(`ℹ️ ${label}: ${file.name}`);
				}

				for (const artifact of artifacts) {
					ingestArtifact(artifact, { file, slotHint });
				}
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
