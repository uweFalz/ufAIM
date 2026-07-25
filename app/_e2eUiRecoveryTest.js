import { getLanguage, setLanguage } from "@app/i18n/strings.js";

const result = {
	passed: false,
	phase: "waiting",
	failures: [],
	visualizationPassed: false,
	transEdPlotPassed: false,
	curvatureBandPassed: false,
	alignmentEditorPassed: false,
	cockpitPassed: false,
	actionAuditPassed: false,
	onePlanePassed: false,
	languagePassed: false,
	restorationPassed: false,
	restorationDiagnostics: [],
	completedAt: null,
};
window.__uiRecoveryE2E = result;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function waitFor(predicate, label, timeoutMs = 30000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (await Promise.resolve(predicate())) return;
		await sleep(40);
	}
	throw new Error(`readiness timeout: ${JSON.stringify({
		dependency: label,
		elapsedMs: Date.now() - started,
		dependencyPhase: window.__gndImportWorkbenchE2E?.phase ?? null,
		dependencyPromiseExists: Boolean(window.__gndImportWorkbenchE2EPromise),
		prerequisiteFailed: window.__gndImportWorkbenchE2E?.passed === false && Boolean(window.__gndImportWorkbenchE2E?.completedAt),
		runtimeSurfaces: {
			messaging: Boolean(window.messaging),
			store: Boolean(window.__ufAIM_store),
			transEd: Boolean(window.__ufAIM_teBridge),
			alignmentEditor: Boolean(window.__ufAIM_aeBridge),
			curvatureBand: Boolean(window.__ufAIM_curvatureBand),
			cockpit: Boolean(window.__ufAIM_cockpit),
		},
	})}`);
}
function snapshot() {
	const store = window.__ufAIM_store?.getState?.() ?? {};
	const band = window.__ufAIM_curvatureBand?.getDebugState?.() ?? {};
	return {
		language: getLanguage(),
		teOpen: Boolean(store.te_open),
		aeOpen: Boolean(store.ae_open),
		cockpitCollapsed: document.getElementById("ufShell")?.classList.contains("is-cockpit-collapsed"),
		band: band.presentation ?? null,
	};
}
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

window.__uiRecoveryE2EPromise = (async () => {
	let initial = null;
	try {
		result.phase = "readiness";
		await waitFor(() =>
			window.__gndImportWorkbenchE2E?.completedAt
			&& window.__ufAIM_teBridge
			&& window.__ufAIM_aeBridge
			&& window.__ufAIM_curvatureBand
			&& window.__ufAIM_cockpit,
		"UI recovery runtime");
		initial = snapshot();

		result.phase = "visualization";
		const canvas = document.getElementById("view3d");
		assert(canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0, "main Viewer has no visible drawing surface");
		assert(document.getElementById("geoStage")?.contains(canvas), "main Viewer left the dominant working plane");
		result.visualizationPassed = true;

		result.phase = "transed";
		await window.__ufAIM_teBridge.open();
		await waitFor(() => {
			const host = document.getElementById("transBoard");
			return host && host.clientWidth > 200 && host.clientHeight > 180 && host.querySelector("svg");
		}, "live TransEd plot");
		const transState = window.__ufAIM_teBridge.getDebugState();
		const presetId = transState.recordId || transState.catalogue?.records?.transition?.[0]?.id;
		const sampled = await window.__ufAIM_teBridge.selectRecord(presetId);
		assert(sampled !== false, "real transition could not be selected");
		for (const id of ["teW1", "teW2"]) assert(document.getElementById(id)?.offsetParent, `${id} is not visible in the plot`);
		assert(document.getElementById("teLegend")?.textContent.includes("κ′") && document.getElementById("teLegend")?.textContent.includes("κ″"), "TransEd derivative evidence is not visible");
		result.transEdPlotPassed = true;

		result.phase = "curvature-band";
		const band = window.__ufAIM_curvatureBand;
		assert(band.setPresentation("compact"), "compact CurvatureBand state rejected");
		assert(document.getElementById("curvatureBand")?.dataset.presentation === "compact", "compact CurvatureBand state not rendered");
		assert(band.setPresentation("collapsed"), "collapsed CurvatureBand state rejected");
		assert(document.getElementById("btnCurvatureBandCollapse")?.offsetParent, "collapsed CurvatureBand has no restore action");
		assert(band.setDock(initial.band?.dock === "top" ? "bottom" : "top"), "CurvatureBand docking rejected");
		assert(band.setPresentation("working"), "working CurvatureBand state rejected");
		result.curvatureBandPassed = true;

		result.phase = "editor-cockpit";
		const editor = document.getElementById("alignmentEditorOverlay");
		assert(editor?.querySelector("#aeApply") && editor.querySelector("#aeUndo") && editor.querySelector(".uf-align-edit__technical"), "simplified Alignment Editor contract is incomplete");
		assert(editor.querySelectorAll(".uf-align-edit__grid input, .uf-align-edit__grid select").length <= 8, "Alignment Editor default surface remains technically overloaded");
		result.alignmentEditorPassed = true;
		const cockpit = document.getElementById("cockpitPanelBody");
		assert(cockpit && cockpit.querySelectorAll(".cockpit-sofa__section").length <= 5, "Cockpit remains a permanent dashboard");
		result.cockpitPassed = true;

		result.phase = "actions-layout";
		for (const id of ["btnImport", "btnSpot", "btnTrans", "btnAlignmentEditor", "btnCockpit", "btnFit"]) {
			const button = document.getElementById(id);
			assert(button && !button.disabled, `primary action unavailable: ${id}`);
		}
		for (const id of ["btnToggleBands", "btnToggleSection", "btnToggleDebug"]) assert(document.getElementById(id)?.classList.contains("hidden"), `legacy action remains visible: ${id}`);
		result.actionAuditPassed = true;
		const stage = document.getElementById("geoStage")?.getBoundingClientRect();
		const trans = document.getElementById("transOverlay")?.getBoundingClientRect();
		assert(stage?.width > 0 && stage?.height > 0, "dominant Viewer plane collapsed");
		assert(!trans || trans.width < stage.width || document.getElementById("btnTransClose")?.offsetParent, "TransEd obscures Viewer without a close action");
		result.onePlanePassed = true;

		result.phase = "language";
		for (const language of ["de", "en"]) {
			assert(setLanguage(language), `language unavailable: ${language}`);
			window.dispatchEvent(new CustomEvent("ufaim:language-changed", { detail: { language } }));
			await window.__ufAIM_aeBridge.refresh({ preserveSelection: true });
			await waitFor(() => document.documentElement.lang === language, `${language} UI`);
			assert(document.getElementById("aeReset")?.textContent.trim(), `${language} Alignment Editor label missing`);
			assert(document.getElementById("btnCurvatureBandCollapse")?.getAttribute("aria-label"), `${language} CurvatureBand accessible label missing`);
		}
		result.languagePassed = true;
		result.passed = true;
	} catch (error) {
		result.failures.push(String(error?.message ?? error));
	} finally {
		result.phase = "restore";
		try {
			if (initial) {
				setLanguage(initial.language);
				window.dispatchEvent(new CustomEvent("ufaim:language-changed", { detail: { language: initial.language } }));
				await window.__ufAIM_aeBridge.refresh({ preserveSelection: true });
				await waitFor(() => document.documentElement.lang === initial.language, "original language");
				initial.teOpen ? await window.__ufAIM_teBridge.open() : window.__ufAIM_teBridge.close();
				initial.aeOpen ? await window.__ufAIM_aeBridge.open() : window.__ufAIM_aeBridge.close();
				document.getElementById("ufShell")?.classList.toggle("is-cockpit-collapsed", initial.cockpitCollapsed);
				if (initial.band) {
					window.__ufAIM_curvatureBand.setDock(initial.band.dock);
					window.__ufAIM_curvatureBand.setPresentation(initial.band.mode);
				}
				const actual = snapshot();
				if (!same(actual, initial)) {
					result.restorationDiagnostics.push({ path: "uiState", expected: initial, actual, responsibleHarness: "uiRecovery", timing: "after harness cleanup" });
					throw new Error("UI recovery restore mismatch");
				}
			}
			result.restorationPassed = true;
		} catch (error) {
			result.passed = false;
			result.failures.push(String(error?.message ?? error));
		}
		result.passed = result.passed
			&& result.restorationPassed
			&& result.failures.length === 0
			&& ["visualizationPassed", "transEdPlotPassed", "curvatureBandPassed", "alignmentEditorPassed", "cockpitPassed", "actionAuditPassed", "onePlanePassed", "languagePassed"].every((field) => result[field]);
		result.phase = result.passed ? "passed" : "failed";
		result.completedAt = new Date().toISOString();
		console[result.passed ? "log" : "error"](`UiRecovery E2E ${result.passed ? "PASSED" : "FAILED"} ${JSON.stringify(result)}`);
	}
	return result;
})();
