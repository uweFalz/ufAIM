const result = {
	passed: false,
	phase: "waiting",
	failures: [],
	sourceCount: 0,
	itemCount: 0,
	evidenceCount: 0,
	maxQueueDepth: 0,
	maxRoundTripMs: 0,
	timeouts: 0,
	duplicateItems: 0,
	duplicateEvidence: 0,
	unhandledRejections: 0,
	cockpitRefreshCount: 0,
	orderPassed: false,
	evidencePassed: false,
	backpressurePassed: false,
	refreshBoundPassed: false,
	restorationPassed: false,
	restorationDiagnostics: [],
	metrics: null,
	completedAt: null,
};
window.__importLoadStabilityE2E = result;

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const unwrap = (value) => value?.state ?? value?.payload ?? value ?? {};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeoutMs = 30000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (await predicate()) return;
		await sleep(40);
	}
	throw new Error(`timeout waiting for ${label}`);
}
function makeItem(sourceIndex, itemIndex, truthfulnessStatus) {
	const safe = truthfulnessStatus === "safe-construction-available";
	return {
		id: `load_${sourceIndex}_${itemIndex}`,
		kind: "alignment",
		source: { fileName: `load-${sourceIndex}.xlsx`, parserId: "gnd-edit-xlsx" },
		status: {
			valid: true,
			accepted: false,
			promotable: safe,
			stage: safe ? "derived" : "validated",
			reason: safe ? null : truthfulnessStatus,
			eligibility: { eligible: safe, reason: safe ? null : truthfulnessStatus },
		},
		payload: { id: `load_${sourceIndex}_${itemIndex}`, name: `Load ${sourceIndex}/${itemIndex}` },
		derived: safe ? { sparseAlignment: { elements: [] }, spatialRef: { status: "resolved", crsId: "EPSG:25832" } } : {},
	};
}
function makePublication(sourceIndex, itemsPerSource) {
	const statuses = [
		"safe-construction-available",
		"rejected-source",
		"incomplete-source",
		"conflicting-evidence",
	];
	const truthfulnessStatus = statuses[sourceIndex % statuses.length];
	const evidenceId = `load_evidence_${String(sourceIndex).padStart(3, "0")}`;
	const items = Array.from({ length: itemsPerSource }, (_, itemIndex) =>
		({ ...makeItem(sourceIndex, itemIndex, truthfulnessStatus), evidenceId })
	);
	return {
		evidence: {
			schema: "ufAIM.import-result-evidence",
			version: 1,
			evidenceId,
			source: {
				fileName: `load-${sourceIndex}.xlsx`,
				format: "XLSX",
				parserId: "gnd-edit-xlsx",
				container: "synthetic",
				extractor: { id: "synthetic-load", version: "1" },
				sha256: String(sourceIndex).padStart(64, "0"),
			},
			inventory: [{ name: "X_ASC11_PP", rowCount: itemsPerSource, interpreted: true }],
			diagnostics: truthfulnessStatus === "safe-construction-available" ? [] : [{ code: truthfulnessStatus }],
			relationCandidates: [],
			acceptedItemIds: items.map((item) => item.id),
			rejectedItemIds: [],
			unresolvedEvidence: Array.from({ length: 20 }, (_, index) => ({ kind: "source-row", index })),
			truthfulnessStatus,
			sourceEnvelope: { type: "SyntheticLoadEnvelope", sourceIndex },
			completedAt: new Date().toISOString(),
			provenance: { sourceEnvelope: "synthetic-load-e2e" },
		},
		items,
	};
}

window.__importLoadStabilityE2EPromise = (async () => {
	const sourceCount = 16;
	const itemsPerSource = 24;
	let originalState = null;
	let originalEvidence = null;
	const onUnhandled = () => { result.unhandledRejections += 1; };
	window.addEventListener("unhandledrejection", onUnhandled);
	try {
		await waitFor(() =>
			window.__uiRecoveryE2E?.completedAt &&
			window.__ufAIM_importController &&
			window.messaging,
		"import load runtime");
		result.phase = "load";
		originalState = unwrap(await window.messaging.sendCmdAwait("Import.GetState", {}, { timeoutMs: 12000 }));
		originalEvidence = unwrap(await window.messaging.sendCmdAwait("Import.GetResultEvidence", {}, { timeoutMs: 12000 }));
		const publications = Array.from({ length: sourceCount }, (_, index) => makePublication(index, itemsPerSource));
		const beforeMetrics = window.__ufAIM_importController.getRuntimeMetrics();
		await window.__ufAIM_importController.publishSyntheticBatch(publications);
		const state = unwrap(await window.messaging.sendCmdAwait("Import.GetState", {}, { timeoutMs: 12000 }));
		const evidence = unwrap(await window.messaging.sendCmdAwait("Import.GetResultEvidence", {}, { timeoutMs: 12000 }));
		const records = evidence.records ?? [];
		result.sourceCount = records.length;
		result.itemCount = state.items?.length ?? 0;
		result.evidenceCount = records.length;
		result.duplicateItems = result.itemCount - new Set((state.items ?? []).map((item) => item.id)).size;
		result.duplicateEvidence = result.evidenceCount - new Set(records.map((record) => record.evidenceId)).size;
		assert(result.sourceCount === sourceCount, `source loss: expected ${sourceCount}, got ${result.sourceCount}`);
		assert(result.itemCount === sourceCount * itemsPerSource, `item loss: expected ${sourceCount * itemsPerSource}, got ${result.itemCount}`);
		assert(records.every((record, index) => record.evidenceId === publications[index].evidence.evidenceId), "publication order changed");
		result.orderPassed = true;
		assert(records.every((record) => record.sourceEnvelope && record.unresolvedEvidence?.length === 20), "evidence was truncated");
		result.evidencePassed = true;
		const metrics = window.__ufAIM_importController.getRuntimeMetrics();
		result.metrics = metrics;
		result.maxQueueDepth = metrics.maxQueueDepth;
		result.maxRoundTripMs = metrics.maxRoundTripMs;
		result.timeouts = metrics.timeouts;
		result.cockpitRefreshCount = window.__ufAIM_cockpit?._importRefreshCount ?? 0;
		assert(metrics.maxActiveBatches === 1 && metrics.maxActiveCommands === 1, "bounded scheduler contract violated");
		assert(result.timeouts === 0 && result.duplicateItems === 0 && result.duplicateEvidence === 0, "timeout or duplicate publication detected");
		result.backpressurePassed = true;
		assert(metrics.stateRefreshes - beforeMetrics.stateRefreshes === 1, "refreshes were not coalesced to one batch refresh");
		result.refreshBoundPassed = true;
		result.passed = true;
	} catch (error) {
		result.failures.push(String(error?.message ?? error));
	} finally {
		result.phase = "cleanup";
		try {
			await window.messaging.sendCmdAwait("Import.BeginSession", { source: null }, { timeoutMs: 12000 });
			for (const evidence of originalEvidence?.records ?? []) {
				const items = (originalState?.items ?? []).filter((item) => item?.evidenceId === evidence.evidenceId);
				await window.messaging.sendCmdAwait("Import.PublishResultEvidence", { evidence, items }, { timeoutMs: 30000 });
			}
			const state = unwrap(await window.messaging.sendCmdAwait("Import.GetState", {}, { timeoutMs: 12000 }));
			assert((state.items ?? []).every((item) => !String(item?.id ?? "").startsWith("load_")), "synthetic load items remain");
			result.restorationPassed = true;
		} catch (error) {
			result.passed = false;
			const diagnostic = { phase: "cleanup", message: error?.message ?? String(error) };
			result.restorationDiagnostics.push(diagnostic);
			result.failures.push(`cleanup: ${diagnostic.message}`);
		}
		window.removeEventListener("unhandledrejection", onUnhandled);
		if (result.unhandledRejections > 0) result.passed = false;
		result.completedAt = new Date().toISOString();
		console[result.passed ? "log" : "error"](`ImportLoadStability E2E ${result.passed ? "PASSED" : "FAILED"}`, result);
	}
	return result;
})();
