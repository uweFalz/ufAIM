import { getLanguage } from "@app/i18n/strings.js";

const result = {
	passed: false,
	phase: "waiting",
	failures: [],
	evidenceReadPassed: false,
	candidateDisplayPassed: false,
	truthfulnessPassed: false,
	eligibilityPassed: false,
	previewPassed: false,
	transferPassed: false,
	provenancePassed: false,
	languagePassed: false,
	onePlanePassed: false,
	restorationPassed: false,
	restorationDiagnostics: [],
	completedAt: null,
};
window.__gndImportWorkbenchE2E = result;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeout = 20000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		if (await predicate()) return;
		await wait(30);
	}
	throw new Error(`timeout: ${label}`);
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function objects(state) { return Array.isArray(state?.objects) ? state.objects : Object.values(state?.objects ?? {}); }

function item(id, promotable) {
	return {
		id,
		kind: "alignment",
		source: { fileName: "synthetic-workbench.xlsx", parserId: "gnd-edit-xlsx", objectName: id },
		payload: {
			kind: "alignment",
			name: promotable ? "Safe horizontal candidate" : "Ambiguous retained item",
			coordGeom: { elements: [{ id: "E1", type: "straight", length: 10 }] },
			extended: { unresolvedAttachments: [{ kind: "cant", evidenceClass: "ambiguous-unattached-source-evidence", padStart: "P1", padEnd: "P2", ambiguityReason: "multiple-coordinate-reference-candidates", sourceElements: [{ family: "EU", rowRef: "X_ASC23_EU:2", typeCode: 999, parameters: { EUPAR1: 10.125 } }] }] },
		},
		status: { valid: promotable, promotable, stage: promotable ? "derived" : "rejected", reason: promotable ? null : "ambiguous-evidence" },
		meta: {},
		derived: promotable ? {
			sparseAlignment: { type: "sparseAlignment", startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }, sparse: [{ id: "E1", type: "fixed", poseA: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }, arcLength: 10, curvature: 0 }] },
			spatialRef: { mode: "local-cartesian", resolutionState: "local-cartesian" },
			importAssessment: { sourceTrustClass: "authoritative_context" },
		} : {},
		annotations: [],
	};
}

function publication(suffix) {
	const evidenceId = `evidence_v1_${"b".repeat(16)}_${suffix}`;
	return {
		evidence: {
			schema: "ufAIM.import-result-evidence",
			version: 1,
			evidenceId,
			source: { fileName: "synthetic-workbench.xlsx", format: "XLSX", parserId: "gnd-edit-xlsx", container: "ZIP/OOXML", extractor: { id: "synthetic-e2e", version: "1" }, sha256: "b".repeat(64) },
			inventory: [{ name: "X_ASC11_PP", rowCount: 2, columnCount: 3, interpreted: true }, { name: "X_ASC23_EU", rowCount: 1, columnCount: 8, interpreted: false }],
			diagnostics: [{ severity: "warning", code: "cant-context-ambiguous-unattached", family: "EU", rowRef: "X_ASC23_EU:2", message: "Cant evidence retained" }],
			relationCandidates: [{ id: "REL1", status: "unresolved", from: "P1", to: "P2" }],
			acceptedItemIds: [`gnd_wb_safe_${suffix}`],
			rejectedItemIds: [`gnd_wb_ambiguous_${suffix}`],
			unresolvedEvidence: [{ itemId: `gnd_wb_safe_${suffix}`, kind: "cant", evidenceClass: "ambiguous-unattached-source-evidence", padStart: "P1", padEnd: "P2", reason: "multiple-coordinate-reference-candidates" }],
			truthfulnessStatus: "construction-available-with-unresolved-evidence",
			sourceEnvelope: { type: "GndTypedSourceEnvelope", version: 1, tables: [{ name: "X_ASC11_PP", rows: [{ ordinal: 0, cells: [{ columnName: "PAD", value: "SYNTHETIC" }] }] }] },
			completedAt: new Date().toISOString(),
			provenance: { sourceEnvelope: "synthetic-e2e" },
		},
		items: [item(`gnd_wb_safe_${suffix}`, true), item(`gnd_wb_ambiguous_${suffix}`, false)],
	};
}

window.__gndImportWorkbenchE2EPromise = (async () => {
	const suffix = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
	const pub = publication(suffix);
	const originalLanguage = getLanguage();
	let promotedId = null;
	try {
		await waitFor(() =>
			window.messaging &&
			window.__ufAIM_gndImportWorkbench &&
			window.__ufAIM_cockpit &&
			window.__gndMdbDropE2E?.completedAt &&
			window.__spotWorkspaceE2E?.completedAt &&
			window.__alignmentCreationE2E?.completedAt &&
			window.__transEdDepthE2E?.completedAt,
		"Workbench runtime and preceding harnesses", 40000);
		result.phase = "prepare";
		await window.messaging.sendCmdAwait("Import.BeginSession", { source: "synthetic-workbench-e2e" });
		await window.messaging.sendCmdAwait("Import.PublishResultEvidence", pub);
		const before = await window.messaging.sendCmdAwait("Import.GetResultEvidence", {});
		assert(before.records?.length === 1 && before.records[0].source.sha256 === "b".repeat(64), "retained evidence read failed");
		result.evidenceReadPassed = true;

		result.phase = "display";
		await window.__ufAIM_gndImportWorkbench.open();
		await waitFor(() => document.querySelector(`[data-evidence-id="${pub.evidence.evidenceId}"]`), "evidence surface");
		const text = document.getElementById("gndImportWorkbenchBody")?.textContent ?? "";
		assert(text.includes("synthetic-workbench.xlsx") && text.includes("X_ASC11_PP") && text.includes("cant-context-ambiguous-unattached"), "source, inventory, or diagnostics missing");
		assert(document.querySelectorAll(".gnd-wb-card").length === 2, "candidate and rejected item were not both displayed");
		result.candidateDisplayPassed = true;
		assert(text.includes("construction") || text.includes("Konstruktion"), "truthfulness explanation missing");
		result.truthfulnessPassed = true;
		const safeButton = document.querySelector(`[data-gnd-promote="gnd_wb_safe_${suffix}"]`);
		const rejectedButton = document.querySelector(`[data-gnd-promote="gnd_wb_ambiguous_${suffix}"]`);
		assert(!safeButton?.disabled && rejectedButton?.disabled, "eligibility was inferred incorrectly");
		result.eligibilityPassed = true;
		assert(!document.getElementById("spotOverlay")?.classList.contains("hidden") === false, "Objects competed with Workbench");
		assert(document.getElementById("ufShell")?.classList.contains("is-cockpit-collapsed"), "Cockpit competed with Workbench");
		result.onePlanePassed = true;

		result.phase = "preview";
		document.querySelector(`[data-gnd-preview="gnd_wb_safe_${suffix}"]`)?.click();
		await waitFor(() => window.__ufAIM_store.getState()?.preview_item?.id === `gnd_wb_safe_${suffix}`, "candidate preview");
		assert(!(await window.messaging.sendCmdAwait("Spot.GetState", {}))?.objects?.[`gnd_wb_safe_${suffix}`], "preview created a SPOT object");
		result.previewPassed = true;

		result.phase = "transfer";
		document.querySelector(`[data-gnd-promote="gnd_wb_safe_${suffix}"]`)?.click();
		await waitFor(async () => {
			const spot = await window.messaging.sendCmdAwait("Spot.GetState", {});
			const found = objects(spot).find((entry) => entry?.meta?.importItemId === `gnd_wb_safe_${suffix}` || entry?.id === `gnd_wb_safe_${suffix}`);
			promotedId = found?.id ?? null;
			return Boolean(found);
		}, "single SPOT transfer");
		const spot = await window.messaging.sendCmdAwait("Spot.GetState", {});
		const promoted = objects(spot).find((entry) => entry.id === promotedId);
		assert(promoted?.meta?.sourceEvidence?.evidenceId === pub.evidence.evidenceId, "compact evidence snapshot missing");
		assert(promoted?.meta?.sourceEvidence?.source?.sha256 === "b".repeat(64), "SPOT fingerprint missing");
		assert(objects(spot).filter((entry) => entry.id === promotedId).length === 1, "candidate transferred more than once");
		result.transferPassed = true;

		result.phase = "language";
		for (const language of ["de", "en"]) {
			if (getLanguage() !== language) {
				document.getElementById("btnLang")?.click();
				document.querySelector(`[data-lang-code="${language}"]`)?.click();
				await waitFor(() => getLanguage() === language, `${language} activation`);
			}
			const live = document.getElementById("gndImportWorkbenchBody")?.textContent ?? "";
			assert(language === "de" ? live.includes("Quelle") : live.includes("Source"), `${language} Workbench did not refresh`);
		}
		result.languagePassed = true;
		await window.messaging.sendCmdAwait("Import.BeginSession", { source: "e2e-clear-proof" });
		assert(promoted.meta.sourceEvidence.unresolvedAttachments.length === 1, "SPOT evidence did not survive session clear");
		result.provenancePassed = true;
	} catch (error) {
		result.failures.push(String(error?.stack ?? error));
	} finally {
		result.phase = "restore";
		try {
			window.__ufAIM_gndImportWorkbench?.close();
			if (promotedId) await window.messaging.sendCmdAwait("Spot.RemoveObject", { objectId: promotedId });
			await window.messaging.sendCmdAwait("Import.BeginSession", { source: null });
			window.__ufAIM_store?.actions?.clearPreviewItem?.();
			if (getLanguage() !== originalLanguage) {
				document.getElementById("btnLang")?.click();
				document.querySelector(`[data-lang-code="${originalLanguage}"]`)?.click();
			}
			const remaining = objects(await window.messaging.sendCmdAwait("Spot.GetState", {})).filter((entry) => String(entry.id).includes(suffix));
			if (remaining.length) result.restorationDiagnostics.push(`remaining SPOT fixtures: ${remaining.map((entry) => entry.id).join(",")}`);
			if (window.__ufAIM_store?.getState()?.preview_item) result.restorationDiagnostics.push("preview remains");
			if (!document.getElementById("gndImportWorkbenchOverlay")?.classList.contains("hidden")) result.restorationDiagnostics.push("Workbench remains open");
		} catch (error) {
			result.restorationDiagnostics.push(String(error?.message ?? error));
		}
		result.restorationPassed = result.restorationDiagnostics.length === 0;
		result.passed = result.failures.length === 0 && result.evidenceReadPassed && result.candidateDisplayPassed && result.truthfulnessPassed && result.eligibilityPassed && result.previewPassed && result.transferPassed && result.provenancePassed && result.languagePassed && result.onePlanePassed && result.restorationPassed;
		result.phase = result.passed ? "complete" : "failed";
		result.completedAt = new Date().toISOString();
		const surface = document.getElementById("gndImportWorkbenchOverlay");
		if (surface) {
			surface.dataset.e2ePassed = String(result.passed);
			surface.dataset.e2ePhase = result.phase;
			surface.dataset.e2eFailures = result.failures.join(" | ");
			surface.dataset.e2eRestoration = result.restorationDiagnostics.join(" | ");
			surface.dataset.e2eResult = JSON.stringify(result);
		}
	}
	return result;
})();
