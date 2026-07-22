import { getLanguage, setLanguage } from "@app/i18n/strings.js";
import { getWorkspaceSelection } from "@src/shared/runtime/workspaceSelectionAccess.js";

const SURFACES = [
	["objects", "spotOverlay", "btnSpot"],
	["transition", "transOverlay", "btnTrans"],
	["alignmentEditor", "alignmentEditorOverlay", "btnAlignmentEditor"],
	["bands", "overlayBands", "btnToggleBands"],
	["section", "overlaySection", "btnToggleSection"],
	["debug", "debugOverlay", "btnToggleDebug"],
];
const REQUIRED = ["parserValidation", "alignmentNativeUi", "geoRuntimeAcceptance", "curvatureBand", "spotWorkspace"];
const result = { passed: false, results: {}, deterministicPassed: false, restorationPassed: false, remainingFixtureIds: [], failures: [], restorationDiagnostics: [], completedAt: null };
const evidence = new Map();
const completionPromises = new Map();
window.__appE2ELifecycle = result;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeoutMs = 15000) { const start = Date.now(); while (Date.now() - start < timeoutMs) { if (await Promise.resolve(predicate())) return; await sleep(35); } throw new Error(`timeout waiting for ${label}`); }
function unwrap(raw) { return raw?.state ?? raw?.payload ?? raw ?? null; }
function objects(value) { return Array.isArray(value?.objects) ? value.objects : Object.values(value?.objects ?? {}); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); }
function deepFreeze(value) {
	if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
	Object.freeze(value);
	for (const entry of Object.values(value)) deepFreeze(entry);
	return value;
}
function snapshot(value) { return deepFreeze(structuredClone(value)); }
function same(a, b) { return JSON.stringify(stable(a)) === JSON.stringify(stable(b)); }
function surfaceState() { return Object.fromEntries(SURFACES.map(([name, panel]) => [name, !document.getElementById(panel)?.classList.contains("hidden")])); }
function surfaceClasses() { return Object.fromEntries(SURFACES.map(([name, panel]) => [name, document.getElementById(panel)?.className ?? ""])); }
async function spotObjects() { return objects(unwrap(await window.messaging.sendCmdAwait("Spot.GetState", {}))); }

let initial = null;
const ownedFixtures = new Map();

async function chooseLanguage(language) {
	if (getLanguage() === language) return;
	if (!setLanguage(language)) throw new Error(`language option ${language} unavailable during lifecycle restore`);
	await waitFor(() => getLanguage() === language && document.documentElement.lang === language, "language restore");
}

function setSurfaceState(expectedClasses, expectedVisibility = null) {
	for (const [name, panelId, buttonId] of SURFACES) {
		const panel = document.getElementById(panelId);
		const button = document.getElementById(buttonId);
		if (!panel) continue;
		if (expectedClasses?.[name] != null) panel.className = expectedClasses[name];
		else panel.classList.toggle("hidden", !Boolean(expectedVisibility?.[name]));
		const visible = !panel.classList.contains("hidden");
		button?.classList.toggle("btn--primary", visible);
	}
}

function closeTestSurfaces() {
	setSurfaceState(null, Object.fromEntries(SURFACES.map(([name]) => [name, false])));
	document.getElementById("ufShell")?.classList.add("is-cockpit-collapsed");
	window.__ufAIM_store?.actions?.setTeOpen?.(false);
	window.__ufAIM_store?.actions?.setAeOpen?.(false);
}

async function readComparableAppState() {
	return {
		objects: structuredClone(await spotObjects()),
		selection: structuredClone(getWorkspaceSelection(window.__ufAIM_store.getState())),
		query: document.querySelector("[data-spot-search]")?.value ?? "",
		language: getLanguage(),
		surfaces: surfaceState(),
		surfaceClasses: surfaceClasses(),
		cockpitOpen: !document.getElementById("ufShell")?.classList.contains("is-cockpit-collapsed"),
		shellClassName: document.getElementById("ufShell")?.className ?? "",
		transitionOpen: Boolean(window.__ufAIM_store.getState()?.te_open),
		alignmentEditorOpen: Boolean(window.__ufAIM_store.getState()?.ae_open),
		previewItem: window.__ufAIM_store.getState()?.preview_item ?? null,
	};
}

function differences(expected, actual, path = "appState") {
	if (same(expected, actual)) return [];
	if (Array.isArray(expected) || Array.isArray(actual)) {
		if (!Array.isArray(expected) || !Array.isArray(actual)) return [{ path, expected, actual }];
		const entries = [];
		for (let index = 0; index < Math.max(expected.length, actual.length); index += 1) entries.push(...differences(expected[index], actual[index], `${path}[${index}]`));
		return entries;
	}
	if (expected && actual && typeof expected === "object" && typeof actual === "object") {
		return [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort().flatMap((key) => differences(expected[key], actual[key], `${path}.${key}`));
	}
	return [{ path, expected, actual }];
}

function recordRestoreFailure(owner, timing, expected, actual) {
	const diagnostics = differences(expected, actual).map((difference) => ({ ...difference, responsibleHarness: owner, timing }));
	result.restorationDiagnostics.push(...snapshot(diagnostics));
	const error = new Error(`app-state restore mismatch: ${JSON.stringify(diagnostics)}`);
	error.diagnostics = diagnostics;
	throw error;
}

export async function beginAppE2ELifecycle() {
	await waitFor(() => window.messaging && window.__ufAIM_store && document.querySelector("[data-spot-search]"), "lifecycle runtime readiness", 30000);
	const comparable = await readComparableAppState();
	initial = { ...comparable, activeElementId: document.activeElement?.id ?? null };
	return window.__appE2ELifecycleApi;
}

export function registerE2EFixture(owner, fixtureId) {
	const id = String(fixtureId ?? "").trim(); const name = String(owner ?? "").trim();
	if (!id || !name) throw new Error("E2E fixture ownership requires owner and fixtureId");
	for (const [existingOwner, ids] of ownedFixtures) if (existingOwner !== name && ids.has(id)) throw new Error(`fixture ${id} already belongs to ${existingOwner}`);
	if (!ownedFixtures.has(name)) ownedFixtures.set(name, new Set());
	ownedFixtures.get(name).add(id);
}

export async function restoreInitialAppState(owner = "lifecycle", timing = "after final restore") {
	if (!initial) throw new Error("lifecycle snapshot is unavailable");
	// Close event-producing editor surfaces before changing objects or selection.
	// Direct class/state restoration deliberately avoids click handlers.
	closeTestSurfaces();
	for (const object of await spotObjects()) await window.messaging.sendCmdAwait("Spot.RemoveObject", { objectId: object.id });
	if (initial.objects.length) await window.messaging.sendCmdAwait("Spot.AddObjects", { objects: initial.objects });
	window.__ufAIM_store.actions?.clearPreviewItem?.();
	window.__ufAIM_store.actions?.setWorkspaceSelection?.(initial.selection);
	await window.__ufAIM_cockpit?.refreshSpotState?.();
	window.__ufAIM_cockpit?.render?.();
	await window.__ufAIM_curvatureBand?.refresh?.();
	await waitFor(() => {
		const viewer = window.__ufAIM_viewController?.getDebugState?.() ?? {};
		return String(viewer.objectId ?? "") === String(initial.selection.primaryId ?? "")
			&& String(viewer.selectedElementId ?? "") === String(initial.selection.elementId ?? "");
	}, `${owner} dependent view selection restore`);
	await waitFor(() => same(getWorkspaceSelection(window.__ufAIM_store.getState()), initial.selection), `${owner} immutable workspace selection restore`);
	const search = document.querySelector("[data-spot-search]");
	if (search) { search.value = initial.query; search.dispatchEvent(new Event("input", { bubbles: true })); }
	await chooseLanguage(initial.language);
	setSurfaceState(initial.surfaceClasses, initial.surfaces);
	window.__ufAIM_store.actions?.setTeOpen?.(initial.transitionOpen);
	window.__ufAIM_store.actions?.setAeOpen?.(initial.alignmentEditorOpen);
	const shell = document.getElementById("ufShell");
	if (shell) shell.className = initial.shellClassName;
	document.getElementById(initial.activeElementId)?.focus?.();
	await waitFor(async () => same(await spotObjects(), initial.objects), "original SPOT objects");
	const actual = await readComparableAppState();
	const expected = { objects: initial.objects, selection: initial.selection, query: initial.query, language: initial.language, surfaces: initial.surfaces, surfaceClasses: initial.surfaceClasses, cockpitOpen: initial.cockpitOpen, shellClassName: initial.shellClassName, transitionOpen: initial.transitionOpen, alignmentEditorOpen: initial.alignmentEditorOpen, previewItem: null };
	if (!same(actual, expected)) recordRestoreFailure(owner, timing, expected, actual);
	return true;
}

export async function cleanupHarness(owner) {
	await restoreInitialAppState(owner, "after harness cleanup");
	const ids = [...(ownedFixtures.get(owner) ?? [])];
	const currentIds = new Set((await spotObjects()).map((object) => String(object?.id ?? "")));
	const leaked = ids.filter((id) => currentIds.has(id) && !initial.objects.some((object) => String(object?.id ?? "") === id));
	if (leaked.length) throw new Error(`${owner} fixtures remain: ${leaked.join(", ")}`);
}

export async function completeHarness(owner, completionPromise, mutableResult) {
	completionPromises.set(owner, completionPromise);
	await completionPromise;
	const beforeCleanup = snapshot(mutableResult ?? { passed: false, error: `${owner} result unavailable` });
	try {
		await cleanupHarness(owner);
		const completed = snapshot({ ...beforeCleanup, harnessCompletedAt: beforeCleanup.completedAt ?? null, completedAt: new Date().toISOString(), passed: beforeCleanup.passed === true, restorePassed: true });
		evidence.set(owner, completed);
		return completed;
	} catch (error) {
		const failed = snapshot({ ...beforeCleanup, harnessCompletedAt: beforeCleanup.completedAt ?? null, completedAt: new Date().toISOString(), passed: false, restorePassed: false, cleanupError: String(error?.message ?? error) });
		evidence.set(owner, failed);
		return failed;
	}
}

export function getHarnessEvidence(owner) { return evidence.get(owner) ?? null; }

export async function finalizeAppE2ELifecycle(parserResult = null) {
	if (parserResult) evidence.set("parserValidation", snapshot(parserResult));
	result.results = snapshot(Object.fromEntries(REQUIRED.map((key) => [key, evidence.get(key) ?? null])));
	try { await restoreInitialAppState("lifecycle", "after final restore"); result.restorationPassed = true; }
	catch (error) { result.failures.push(String(error?.message ?? error)); }
	const currentIds = new Set((await spotObjects()).map((object) => String(object?.id ?? "")));
	const initialIds = new Set((initial?.objects ?? []).map((object) => String(object?.id ?? "")));
	result.remainingFixtureIds = [...new Set([...ownedFixtures.values()].flatMap((ids) => [...ids]))].filter((id) => currentIds.has(id) && !initialIds.has(id));
	result.deterministicPassed = REQUIRED.every((key) => result.results[key]?.passed === true && (key === "parserValidation" || Boolean(result.results[key]?.completedAt)));
	result.passed = result.deterministicPassed && result.restorationPassed && result.restorationDiagnostics.length === 0 && result.remainingFixtureIds.length === 0 && result.failures.length === 0;
	result.completedAt = new Date().toISOString();
	console.log(`AppE2ELifecycle E2E RESULT ${JSON.stringify(result)}`);
	console[result.passed ? "log" : "error"](`AppE2ELifecycle E2E ${result.passed ? "PASSED" : "FAILED"}`);
	return result;
}

window.__appE2ELifecycleApi = { registerFixture: registerE2EFixture, cleanupHarness, restoreInitialAppState, completeHarness, getHarnessEvidence };
