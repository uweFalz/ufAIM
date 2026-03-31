// app/core/controllers/importController.js

/**
 * @baustelle [PREVIEW-BRIDGE]
 * SpotCandidates are currently bridged into legacy importSession ingest
 * so they participate in artifact/preview generation.
 * SOLL: preview artifacts should be built directly from normalized candidates,
 * without TRA-legacy wrapping.
 *
 * CURRENT STATUS:
 * - intentional temporary bridge
 * - required for sparse-based preview reactivation
 */

import { installFileDrop } from "@app/io/input/fileDrop.js";
import { makeImportSession } from "@app/io/import/importSession.js";
import { applyIngestResult } from "@app/io/apply/importApply.js";

import { runImportPipeline } from "@src/import/runImportPipeline.js";

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

	function handleSpotCandidatesPreview(candidates = [], { file, slotHint }) {
		for (const spot of candidates) {
			const payload = makeLegacyIngestPayloadFromSpotCandidate(spot, file);
			if (!payload?.kind) continue;

			ingestArtifact(
				{
					payload,
					sourceRef: { name: file?.name ?? null },
				},
				{ file, slotHint }
			);
		}
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

	function previewPolylineFromLandFATAlignment(a) {
		const coordGeom =
			Array.isArray(a?.coordGeom)
				? a.coordGeom
				: Array.isArray(a?.coordGeom?.elements)
					? a.coordGeom.elements
					: [];

		const pts = [];

		for (const seg of coordGeom) {
			const s = seg?.start;
			if (
				s &&
				Number.isFinite(s.easting) &&
				Number.isFinite(s.northing)
			) {
				pts.push({ x: s.easting, y: s.northing });
			}
		}

		const last = coordGeom[coordGeom.length - 1];
		const e = last?.end;
		if (
			e &&
			Number.isFinite(e.easting) &&
			Number.isFinite(e.northing)
		) {
			const prev = pts[pts.length - 1];
			if (!prev || prev.x !== e.easting || prev.y !== e.northing) {
				pts.push({ x: e.easting, y: e.northing });
			}
		}

		return pts.length >= 2 ? pts : null;
	}

	/**
	 * @baustelle [PROFILE-BRIDGE]
	 * landFAT-Profile bleibt source-nah.
	 * Für Legacy-Ingest wird nur eine flache profile1d-Sicht gebildet.
	 *
	 * Unterstützt:
	 * - source-near profile.points[]
	 * - ProfAlign.pvis[] / PVI
	 * - fallback auf leeres Ergebnis
	 */
	function toLegacyProfile1d(profile) {
		if (!profile) return null;

		if (Array.isArray(profile?.points)) {
			const mapped = profile.points.map((x) => ({
				s: x?.station ?? null,
				z: x?.elevation ?? null,
				R: x?.radius ?? null,
				T: x?.tangentLength ?? null,
				pointNumber: x?.pointNumber ?? null,
				pointKey: x?.pointKey ?? null,
			}));

			return mapped.length ? mapped : null;
		}

		const pvis = Array.isArray(profile?.profAlign?.pvis) ? profile.profAlign.pvis : null;
		if (pvis?.length) {
			const mapped = pvis.map((x) => ({
				s: x?.station ?? null,
				z: x?.elevation ?? null,
				R: x?.radius ?? null,
				T: x?.length ?? null,
				pointNumber: null,
				pointKey: null,
			}));

			return mapped.length ? mapped : null;
		}

		return null;
	}

	/**
	 * @baustelle [CANT-BRIDGE]
	 * landFAT-Cant kann source-nah als cantStations/speedStations vorliegen.
	 * Legacy-Ingest erwartet vorerst cant1d-Punkte.
	 *
	 * Aktuell:
	 * - nutzt c.points direkt, falls vorhanden
	 * - bildet sonst einfache cant1d aus cantStations
	 * - speedStations bleiben nur in landFATCant erhalten
	 */
	function toLegacyCant1d(cant) {
		if (!cant) return null;

		if (Array.isArray(cant?.points)) {
			return cant.points.length ? cant.points : null;
		}

		if (Array.isArray(cant?.cantStations)) {
			const mapped = cant.cantStations.map((x) => ({
				s: x?.station?.value ?? x?.station ?? null,
				u:
					x?.appliedCant?.value ??
					x?.appliedCant ??
					null,
				speed:
					x?.speed?.value ??
					x?.speed ??
					null,
				curvature: x?.curvature ?? null,
				transitionType: x?.transitionType ?? null,
			}));

			return mapped.length ? mapped : null;
		}

		return null;
	}

	function makeLegacyIngestPayloadFromWorkingItem(item, file) {
		if (!item) return null;

		// already legacy-ingestable
		if (item?.payload?.kind) return item.payload;

		if (item.kind === "landFATAlignment") {
			const a = item.payload ?? null;
			const polyline2d = previewPolylineFromLandFATAlignment(a);

			return {
				kind: "TRA", // nur Brücke für den Legacy-Ingest
				name: item.name ?? file?.name ?? "alignment",
				geometry: polyline2d ? { pts: polyline2d } : null,
				cant1d: a?.extras?.legacy?.cant1d ?? null,
				landFATAlignment: a,
				meta: item.meta ?? null,
			};
		}

		if (item.kind === "landFATProfile") {
			const p = item.payload ?? null;
			const profile1d = toLegacyProfile1d(p);

			return {
				kind: "GRA", // nur als Legacy-Brücke
				name: item.name ?? file?.name ?? "profile",
				profile1d,
				landFATProfile: p,
				meta: item.meta ?? null,
			};
		}

		if (item.kind === "landFATCant") {
			const c = item.payload ?? null;
			const cant1d = toLegacyCant1d(c);

			return {
				kind: "CANT",
				name: item.name ?? file?.name ?? "cant",
				cant1d,
				landFATCant: c,
				meta: item.meta ?? null,
			};
		}

		return null;
	}

	/**
	 * @baustelle [PREVIEW-BRIDGE]
	 * SpotCandidates are currently bridged into legacy importSession ingest
	 * so they participate in artifact/preview generation.
	 * SOLL: preview artifacts should be built directly from normalized candidates,
	 * without TRA-legacy wrapping.
	 */
	function makeLegacyIngestPayloadFromSpotCandidate(spot, file) {
		if (!spot) return null;

		if (spot.kind === "alignmentSpotCandidate") {
			return {
				kind: "TRA", // nur Brücke für Legacy-Ingest / Artifact-Build
				name: spot.name ?? file?.name ?? "alignment",

				// neuer sauberer Pfad
				sparseAlignment: spot.payload ?? null,

				meta: {
					...(spot.meta ?? {}),
					alignmentName: spot?.meta?.alignmentName ?? spot?.name ?? null,
					sourceFile: file?.name ?? null,
					sourceFormat: spot?.source?.format ?? null,
				},

				source: spot?.source ?? null,
			};
		}

		return null;
	}

	function handleWorkingItems(items = [], { file, slotHint }) {
		for (const item of items) {
			safeLog(`workingItem: ${item?.kind ?? "unknown"} :: ${item?.name ?? file?.name ?? "unnamed"}`);

			const payload = makeLegacyIngestPayloadFromWorkingItem(item, file);
			if (!payload?.kind) continue;

			ingestArtifact(
				{
					payload,
					sourceRef: { name: file?.name ?? null },
				},
				{ file, slotHint }
			);
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
				handleSpotCandidatesPreview(spotCandidates, { file, slotHint });

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
