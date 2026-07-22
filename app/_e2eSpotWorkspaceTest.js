import { createAlignmentSpotObject } from "@src/model/spot/model/createAlignmentSpotObject.js";
import { buildSparseFromEditModel } from "@src/domain/alignment/editor/buildSparseAlignment.js";
import { getWorkspacePrimaryId, getWorkspaceSelection } from "@src/shared/runtime/workspaceSelectionAccess.js";
import { getLanguage } from "@app/i18n/strings.js";
import { renderSpotHtml } from "@app/view/overlays/spotView.js";
import { registerE2EFixture } from "@app/_e2eLifecycle.js";

const result = { passed: false, phase: "waiting", scenarios: [], failures: [], fixtureIds: [], restorationPassed: false, languagePassed: false, onePlanePassed: false, completedAt: null };
window.__spotWorkspaceE2E = result;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeoutMs = 15000) { const started = Date.now(); while (Date.now() - started < timeoutMs) { if (await Promise.resolve(predicate())) return; await sleep(35); } throw new Error(`timeout waiting for ${label}`); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function unwrap(raw) { return raw?.state ?? raw?.payload ?? raw ?? null; }
async function state() { return unwrap(await window.messaging.sendCmdAwait("Spot.GetState", {})); }
function objects(value) { return Array.isArray(value?.objects) ? value.objects : Object.values(value?.objects ?? {}); }
async function scenario(name, run) { result.phase = name; try { await run(); result.scenarios.push({ name, passed: true }); } catch (error) { const message = String(error?.message ?? error); result.scenarios.push({ name, passed: false, error: message }); result.failures.push({ scenario: name, assertion: message }); } }
function click(selector) { const target = document.querySelector(selector); assert(target, `missing control ${selector}`); target.click(); return target; }
function stable(value) {
	if (Array.isArray(value)) return value.map(stable);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
const SURFACES = [
	{ name: "objects", panel: "spotOverlay", button: "btnSpot" },
	{ name: "transition", panel: "transOverlay", button: "btnTrans" },
	{ name: "alignmentEditor", panel: "alignmentEditorOverlay", button: "btnAlignmentEditor" },
	{ name: "bands", panel: "overlayBands", button: "btnToggleBands" },
	{ name: "section", panel: "overlaySection", button: "btnToggleSection" },
	{ name: "debug", panel: "debugOverlay", button: "btnToggleDebug" },
];
function readSurfaceState() {
	return Object.fromEntries(SURFACES.map(({ name, panel }) => [name, !document.getElementById(panel)?.classList.contains("hidden")]));
}
function restoreSurfaceState(expected) {
	for (const { name, panel, button } of SURFACES.filter((entry) => entry.name !== "objects")) {
		const visible = !document.getElementById(panel)?.classList.contains("hidden");
		if (visible !== Boolean(expected[name])) document.getElementById(button)?.click();
	}
}
async function chooseLanguage(language) {
	if (getLanguage() === language) return;
	document.getElementById("btnLang")?.click();
	const option = document.querySelector(`[data-lang-code="${CSS.escape(language)}"]`);
	assert(option, `language option ${language} is missing`); option.click();
	await waitFor(() => getLanguage() === language && document.documentElement.lang === language, `${language} language activation`);
}
function assertLiveLanguage(language) {
	const shell = document.getElementById("btnSpot")?.textContent.trim();
	const workspace = document.querySelector(".spotWorkspace")?.textContent ?? "";
	if (language === "de") assert(shell === "Objekte" && !workspace.includes("No objects yet"), "restored German shell and workspace disagree");
	if (language === "en") assert(shell === "Objects" && !workspace.includes("Noch keine Objekte"), "restored English shell and workspace disagree");
}
function fixture(id, name, { geographic = false, evidence = false } = {}) {
	const alignmentData = { type: "AlignmentData", id, name, source: { kind: "synthetic-e2e" }, editModel: { startPose: { p: { x: geographic ? 3532112.488 : 0, y: geographic ? 5940746.141 : 0 }, t: { x: 1, y: 0 } }, elements: [{ id: "S1", type: "straight", parameters: { length: 120 }, length: 120 }] } };
	const kernel = buildSparseFromEditModel(alignmentData); alignmentData.sparseAlignment = kernel;
	return createAlignmentSpotObject({ id, name, kernel, sparseAlignment: kernel, alignmentData, crsId: geographic ? "EPSG:25833" : null, crsStatus: geographic ? "geographic-supported" : "local", georeference: geographic ? { mode: "geographic", resolutionState: "geographic-supported", resolvedEpsg: "EPSG:25833" } : { mode: "local-cartesian" }, extended: evidence ? { unresolvedAttachments: [{ kind: "profile", status: "ambiguous", evidenceClass: "ambiguous-unattached-source-evidence", message: "Profile context ambiguous", ambiguityReason: "multiple-coordinate-reference-candidates" }, { kind: "cant", status: "unresolved", evidenceClass: "unresolved-uniquely-attachable-evidence", message: "Cant evidence retained, not yet interpreted" }] } : {}, meta: { source: { kind: "import", fileName: evidence ? "synthetic-gnd.xlsx" : "synthetic-geographic.xml" } } });
}

window.__spotWorkspaceE2EPromise = (async function runSpotWorkspaceE2E() {
	let originalObjects = []; let originalSelection = null;
	const originalUi = { query: "", cockpitOpen: false, language: getLanguage(), surfaces: {}, activeElementId: null };
	const runtimeErrors = [];
	const onError = (event) => runtimeErrors.push(String(event?.error?.stack ?? event?.message ?? event?.reason ?? "runtime error"));
	window.addEventListener("error", onError); window.addEventListener("unhandledrejection", onError);
	try {
		await waitFor(() => window.__curvatureBandE2E?.completedAt && window.messaging && window.__ufAIM_store && window.__ufAIM_viewController, "normal runtime readiness", 30000);
		originalObjects = structuredClone(objects(await state())); originalSelection = structuredClone(getWorkspaceSelection(window.__ufAIM_store.getState()));
		originalUi.query = document.querySelector("[data-spot-search]")?.value ?? "";
		originalUi.cockpitOpen = !document.getElementById("ufShell")?.classList.contains("is-cockpit-collapsed");
		originalUi.surfaces = readSurfaceState(); originalUi.activeElementId = document.activeElement?.id ?? null;
		for (const object of originalObjects) await window.messaging.sendCmdAwait("Spot.RemoveObject", { objectId: object.id });
		await window.__ufAIM_cockpit?.refreshSpotState?.(); await window.__ufAIM_store.actions?.clearWorkspacePrimary?.();

		await scenario("one language", async () => {
			if (document.getElementById("spotOverlay")?.classList.contains("hidden")) click("#btnSpot");
			await chooseLanguage("de");
			assert(document.getElementById("btnSpot")?.textContent.trim() === "Objekte", "German shell label is not German");
			assert(document.querySelector(".spotWorkspace")?.textContent.includes("Noch keine Objekte") && !document.querySelector(".spotWorkspace")?.textContent.includes("No objects yet"), "opened workspace did not rerender completely in German");
			await chooseLanguage("en");
			assert(document.getElementById("btnSpot")?.textContent.trim() === "Objects", "English shell label is not English");
			assert(document.querySelector(".spotWorkspace")?.textContent.includes("No objects yet") && !document.querySelector(".spotWorkspace")?.textContent.includes("Noch keine Objekte"), "opened workspace did not rerender completely in English");
			await chooseLanguage(originalUi.language);
		});

		await scenario("empty workspace and one plane", async () => {
			if (document.getElementById("spotOverlay")?.classList.contains("hidden")) click("#btnSpot");
			await waitFor(() => document.querySelector(".spotWorkspace__empty"), "intentional empty state");
			assert(document.querySelector("[data-spot-create]") && document.querySelector("[data-spot-import]"), "empty-state creation/import actions are missing");
			assert(document.getElementById("ufShell")?.classList.contains("is-cockpit-collapsed"), "Objects did not subordinate Cockpit");
			assert(!document.getElementById("view3d")?.classList.contains("hidden"), "Map/Viewer background was hidden by Objects");
			assert(!document.getElementById("curvatureBand")?.classList.contains("hidden"), "CurvatureBand was hidden by Objects");
			result.onePlanePassed = true;
		});

		let localId = null;
		await scenario("create local alignment", async () => {
			click("[data-spot-create]"); await waitFor(async () => objects(await state()).length === 1, "new local Alignment");
			localId = objects(await state())[0].id; result.fixtureIds.push(localId);
			registerE2EFixture("spotWorkspace", localId);
			await waitFor(() => document.querySelector(`[data-spot-card="${CSS.escape(localId)}"][data-spot-spatial="local"]`), "local object card");
		});

		const suffix = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
		const geo = fixture(`spot_ws_geo_${suffix}`, "Imported geographic Alignment", { geographic: true });
		const gnd = fixture(`spot_ws_gnd_${suffix}`, "GND retained evidence", { evidence: true });
		result.fixtureIds.push(geo.id, gnd.id); await window.messaging.sendCmdAwait("Spot.AddObjects", { objects: [geo, gnd] });
		registerE2EFixture("spotWorkspace", geo.id); registerE2EFixture("spotWorkspace", gnd.id);

		await scenario("geographic and GND truthfulness", async () => {
			await waitFor(() => document.querySelector(`[data-spot-card="${CSS.escape(geo.id)}"][data-spot-spatial="geographic"]`), "geographic object card");
			const gndCard = document.querySelector(`[data-spot-card="${CSS.escape(gnd.id)}"]`);
			assert(gndCard?.querySelector(".spotWorkspace__notice"), "GND truthfulness notice is missing");
			assert(!gndCard.textContent.includes("missingCrs") && !gndCard.textContent.includes("typeCode"), "internal evidence keys dominate the primary card");
		});

		await scenario("live object language rerender", async () => {
			await chooseLanguage("de");
			let text = document.querySelector(".spotWorkspace")?.textContent ?? "";
			assert(text.includes("Importiert") && text.includes("Geografisch verortet") && !text.includes("Geographically placed"), "object status content did not rerender completely in German");
			await chooseLanguage("en"); text = document.querySelector(".spotWorkspace")?.textContent ?? "";
			assert(text.includes("Imported") && text.includes("Geographically placed") && !text.includes("Geografisch verortet"), "object status content did not rerender completely in English");
			await chooseLanguage(originalUi.language); result.languagePassed = true;
		});

		await scenario("whole-card activation and continuity", async () => {
			const search = document.querySelector("[data-spot-search]"); search.value = "geographic"; search.dispatchEvent(new Event("input", { bubbles: true }));
			assert(document.querySelectorAll("[data-spot-card]").length === 1, "search did not narrow the object list");
			click(`[data-spot-activate="${CSS.escape(geo.id)}"]`);
			await waitFor(() => getWorkspacePrimaryId(window.__ufAIM_store.getState()) === geo.id, "SPOT primary selection");
			await waitFor(() => window.__ufAIM_viewController.getDebugState().objectId === geo.id, "Viewer selection");
			await waitFor(() => window.__ufAIM_curvatureBand.getDebugState().activeObjectId === geo.id, "CurvatureBand selection");
			assert(document.getElementById("cockpitPanelBody")?.textContent.includes("Imported geographic Alignment"), "Cockpit selection did not synchronize");
		});

		await scenario("inline rename preserves identity", async () => {
			click(`[data-spot-menu="${CSS.escape(geo.id)}"]`); click(`[data-spot-start-rename="${CSS.escape(geo.id)}"]`);
			const input = document.querySelector("[data-spot-rename-input]"); assert(input, "inline rename input is missing"); input.value = "Renamed geographic Alignment";
			document.querySelector("[data-spot-rename-form]")?.requestSubmit();
			await waitFor(async () => objects(await state()).find((object) => object.id === geo.id)?.data?.name === "Renamed geographic Alignment", "persisted rename");
			const renamed = objects(await state()).find((object) => object.id === geo.id);
			assert(renamed.id === geo.id && renamed.meta.source.fileName === "synthetic-geographic.xml", "rename changed identity or provenance");
		});

		await scenario("in-app removal fallback and undo", async () => {
			click(`[data-spot-menu="${CSS.escape(geo.id)}"]`); click(`[data-spot-start-remove="${CSS.escape(geo.id)}"]`);
			const confirmation = document.querySelector(".spotWorkspace__confirm"); assert(confirmation?.textContent.includes("Renamed geographic Alignment"), "removal confirmation does not name the object");
			click(`[data-spot-confirm-remove="${CSS.escape(geo.id)}"]`); await waitFor(async () => !objects(await state()).some((object) => object.id === geo.id), "active removal");
			const expectedFallback = objects(await state()).map((object) => object.id).sort()[0] ?? null;
			await waitFor(() => getWorkspacePrimaryId(window.__ufAIM_store.getState()) === expectedFallback, "deterministic fallback selection");
			assert(window.__ufAIM_viewController.getDebugState().objectId !== geo.id && window.__ufAIM_curvatureBand.getDebugState().activeObjectId !== geo.id, "removed identity remains in a dependent view");
			click("[data-spot-undo] button"); await waitFor(async () => objects(await state()).some((object) => object.id === geo.id), "undo restoration");
			await waitFor(() => getWorkspacePrimaryId(window.__ufAIM_store.getState()) === geo.id, "undo selection restoration");
		});

		await scenario("details Escape and capability gate", async () => {
			click(`[data-spot-menu="${CSS.escape(geo.id)}"]`); click(`[data-spot-show-details="${CSS.escape(geo.id)}"]`);
			assert(document.querySelector(".spotWorkspace__details")?.textContent.includes(geo.id), "technical details do not expose identity");
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			assert(!document.querySelector(".spotWorkspace__details"), "Escape did not close the contextual detail view");
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			await waitFor(() => document.getElementById("spotOverlay")?.classList.contains("hidden"), "Escape overlay dismissal");
			const detached = document.createElement("div"); detached.innerHTML = renderSpotHtml({ spotState: { rows: [{ spotId: "x", label: "X", type: "alignment" }] }, storeState: {}, capabilities: {}, interaction: { menuId: "x" } });
			assert(!detached.querySelector("[data-spot-start-rename], [data-spot-start-remove]"), "unsupported controls are not hidden");
		});

		assert(runtimeErrors.length === 0, `unexpected browser errors: ${runtimeErrors.join(" | ")}`);
		await scenario("bootstrap completion chain", async () => {
			assert(window.__parserValidationE2E?.passed === true, "ParserValidation did not complete successfully");
			assert(window.__alignmentNativeEditorUiE2E?.passed === true && window.__alignmentNativeEditorUiE2E?.completedAt, "AlignmentNativeUi did not complete successfully");
			assert(window.__geoRuntimeAcceptanceE2E?.passed === true && window.__geoRuntimeAcceptanceE2E?.completedAt, "GeoRuntimeAcceptance did not complete successfully");
			assert(window.__curvatureBandE2E?.passed === true && window.__curvatureBandE2E?.completedAt, "CurvatureBand did not complete successfully");
		});
	} catch (error) { result.failures.push({ scenario: result.phase, assertion: String(error?.message ?? error) }); }
	finally {
		try {
			result.phase = "restoration";
			for (const object of objects(await state())) await window.messaging.sendCmdAwait("Spot.RemoveObject", { objectId: object.id });
			if (originalObjects.length) await window.messaging.sendCmdAwait("Spot.AddObjects", { objects: originalObjects });
			window.__ufAIM_store.actions?.setWorkspaceSelection?.(originalSelection ?? {});
			await window.__ufAIM_cockpit?.refreshSpotState?.();
			if (document.getElementById("spotOverlay")?.classList.contains("hidden")) document.getElementById("btnSpot")?.click();
			const search = document.querySelector("[data-spot-search]"); if (search) { search.value = originalUi.query; search.dispatchEvent(new Event("input", { bubbles: true })); }
			await chooseLanguage(originalUi.language);
			assertLiveLanguage(originalUi.language);
			if (originalUi.cockpitOpen) { if (document.getElementById("ufShell")?.classList.contains("is-cockpit-collapsed")) document.getElementById("btnCockpit")?.click(); }
			else if (!document.getElementById("ufShell")?.classList.contains("is-cockpit-collapsed")) document.getElementById("btnCockpitClose")?.click();
			restoreSurfaceState(originalUi.surfaces);
			const objectsVisible = !document.getElementById("spotOverlay")?.classList.contains("hidden");
			if (objectsVisible !== Boolean(originalUi.surfaces.objects)) document.getElementById("btnSpot")?.click();
			document.getElementById(originalUi.activeElementId)?.focus?.();
			await waitFor(async () => same(objects(await state()), originalObjects), "lossless object restoration");
			assert(same(getWorkspaceSelection(window.__ufAIM_store.getState()), originalSelection), "workspace primary or element selection was not restored");
			assert((document.querySelector("[data-spot-search]")?.value ?? "") === originalUi.query, "search query was not restored");
			assert(getLanguage() === originalUi.language && document.documentElement.lang === originalUi.language, "language was not restored");
			assert(same(readSurfaceState(), originalUi.surfaces), "active workspace surfaces were not restored");
			assert(!document.getElementById("ufShell")?.classList.contains("is-cockpit-collapsed") === originalUi.cockpitOpen, "Cockpit visibility was not restored");
			result.restorationPassed = true;
		} catch (cleanupError) { result.failures.push({ scenario: "cleanup", assertion: String(cleanupError?.message ?? cleanupError) }); }
		window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onError);
		result.passed = result.failures.length === 0 && result.restorationPassed && result.languagePassed && result.onePlanePassed;
		result.phase = result.passed ? "complete" : result.restorationPassed ? result.phase : "restoration-failed";
		result.completedAt = new Date().toISOString();
		const contractKeys = ["passed", "phase", "failures", "restorationPassed", "languagePassed", "onePlanePassed", "completedAt"];
		if (!contractKeys.every((key) => Object.prototype.hasOwnProperty.call(result, key)) || !result.completedAt) {
			result.failures.push({ scenario: "result contract", assertion: "SpotWorkspace result contract is incomplete" });
			result.passed = false; result.phase = "result-contract-failed";
		}
		console[result.passed ? "log" : "error"](`SpotWorkspace E2E ${result.passed ? "PASSED" : "FAILED"}`);
	}
})();
