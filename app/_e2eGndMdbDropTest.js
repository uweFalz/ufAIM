import { getLanguage } from "@app/i18n/strings.js";
import { getWorkspaceSelection } from "@src/shared/runtime/workspaceSelectionAccess.js";

const result = {
	passed: false,
	phase: "waiting",
	failures: [],
	validPassed: false,
	missingCorePassed: false,
	conflictPassed: false,
	corruptPagePassed: false,
	installedDropPathPassed: false,
	workerPassed: false,
	restorationPassed: false,
	restorationDiagnostics: [],
	remainingFixtureIds: [],
	completedAt: null,
};
window.__gndMdbDropE2E = result;

const FIXTURE_ROOT = "/test/fixtures/gnd-mdb/";
const EXPECTED_PHASES = ["file-recognized", "fingerprinted", "access-format-checked", "tables-extracted", "gnd-evidence-interpreted", "truthfulness-gate"];
const EXPECTED_HASH = "46b70faa1b220d6765a541ec458c396bf4897fcde72bf5f4aaf72d7c444e2d7a";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const unwrap = (raw) => raw?.state ?? raw?.payload ?? raw ?? null;
const spotObjects = async () => Object.values(unwrap(await window.messaging.sendCmdAwait("Spot.GetState", {}))?.objects ?? {});
const importState = async () => unwrap(await window.messaging.sendCmdAwait("Import.GetState", {}));
const clone = (value) => structuredClone(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

async function waitFor(predicate, label, timeoutMs = 20000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (await Promise.resolve(predicate())) return;
		await sleep(35);
	}
	throw new Error(`timeout waiting for ${label}`);
}

async function sha256(bytes) {
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadFixture(name) {
	const response = await fetch(`${FIXTURE_ROOT}${name}`, { cache: "no-store" });
	assert(response.ok, `fixture unavailable: ${name}`);
	return response.arrayBuffer();
}

function cell(envelope, tableName, field, predicate = () => true) {
	return envelope?.tables?.find((table) => table.name === tableName)?.rows
		.flatMap((row) => row.cells)
		.find((candidate) => candidate.columnName === field && predicate(candidate));
}

function installWorkerObservation() {
	const NativeWorker = window.Worker;
	const observation = { starts: [], terminations: 0, messages: [] };
	window.Worker = class ObservedProductionWorker extends NativeWorker {
		constructor(url, options) {
			super(url, options);
			observation.starts.push(String(url));
			this.addEventListener("message", (event) => observation.messages.push(clone(event.data)));
		}
		terminate() {
			observation.terminations += 1;
			return super.terminate();
		}
	};
	return { observation, restore: () => { window.Worker = NativeWorker; } };
}

async function dispatchInstalledDrop(file, observation) {
	const log = document.getElementById("log");
	assert(log, "application log unavailable");
	const beforeBatches = (log.textContent.match(/import batch:/g) ?? []).length;
	const transfer = new DataTransfer();
	transfer.items.add(file);
	const accepted = !document.documentElement.dispatchEvent(new DragEvent("drop", {
		bubbles: true,
		cancelable: true,
		dataTransfer: transfer,
	}));
	assert(accepted, "installed drop listener did not cancel the document drop event");
	await waitFor(() => (log.textContent.match(/import batch:/g) ?? []).length > beforeBatches, `${file.name} ImportController completion`);
	await waitFor(() => observation.terminations === observation.starts.length, `${file.name} worker termination`);
	return log.textContent;
}

async function cleanScenario(initial) {
	await window.__appE2ELifecycleApi.restoreInitialAppState("gndMdbDrop", "after MDB drop scenario");
	await window.messaging.sendCmdAwait("Import.BeginSession", { source: "gnd-mdb-drop-e2e-cleanup" });
	window.__ufAIM_store.actions?.clearPreviewItem?.();
	window.__ufAIM_store.actions?.clearWorkspaceVisibleTracks?.();
	const currentSpots = await spotObjects();
	const currentSelection = getWorkspaceSelection(window.__ufAIM_store.getState());
	const currentView = window.__ufAIM_viewController?.getDebugState?.() ?? {};
	const inbox = await importState();
	assert(same(currentSpots, initial.spots), "SPOT objects were not restored");
	assert(same(currentSelection, initial.selection), "workspace selection was not restored");
	assert(String(currentView.crsId ?? "") === String(initial.view.crsId ?? ""), "active CRS was not restored");
	assert(String(currentView.placement ?? "") === String(initial.view.placement ?? ""), "placement mode was not restored");
	assert(getLanguage() === initial.language, "language was not restored");
	assert(window.__ufAIM_store.getState()?.preview_item == null, "import preview remains after cleanup");
	assert((inbox?.items?.length ?? 0) === 0 && (inbox?.rejectedItems?.length ?? 0) === 0, "import inbox retains fixture items");
}

async function runScenario(name, makeFile, verify, initial) {
	result.phase = name;
	const worker = installWorkerObservation();
	try {
		const file = await makeFile();
		const log = await dispatchInstalledDrop(file, worker.observation);
		assert(worker.observation.starts.length === 1, `${name} did not create exactly one Worker`);
		assert(worker.observation.starts[0].includes("mdb-reader-worker-3.2.0.js"), `${name} bypassed the production MDB Worker bundle`);
		assert(worker.observation.terminations === 1, `${name} Worker was not terminated`);
		await verify({ file, log, worker: worker.observation, inbox: await importState(), preview: window.__ufAIM_store.getState()?.preview_item ?? null });
		result.workerPassed = true;
		result.installedDropPathPassed = true;
	} finally {
		worker.restore();
		await cleanScenario(initial);
	}
}

window.__gndMdbDropE2EPromise = (async function runGndMdbDropE2E() {
	const initial = {
		spots: clone(await spotObjects()),
		selection: clone(getWorkspaceSelection(window.__ufAIM_store.getState())),
		view: clone(window.__ufAIM_viewController?.getDebugState?.() ?? {}),
		language: getLanguage(),
	};
	try {
		const initialInbox = await importState();
		assert((initialInbox?.items?.length ?? 0) === 0 && (initialInbox?.rejectedItems?.length ?? 0) === 0, "fresh acceptance requires an empty import inbox");

		await runScenario("valid", async () => {
			const bytes = await loadFixture("valid-minimal-jet4.mdb");
			assert(await sha256(bytes) === EXPECTED_HASH, "valid fixture fingerprint mismatch before drop");
			return new File([bytes], "valid-minimal-jet4.mdb", { type: "application/x-msaccess" });
		}, async ({ file, log, worker, inbox, preview }) => {
			const envelope = worker.messages.find((message) => message?.type === "result")?.envelope;
			assert(envelope?.source?.fileName === file.name && envelope?.source?.format === "Jet 4 MDB", "MDB filename or source format was not retained");
			assert(envelope?.source?.sha256 === EXPECTED_HASH, "dropped-byte fingerprint was not retained");
			assert(envelope?.inventory?.filter((table) => table.interpreted).length === 7, "seven GND tables were not inventoried");
			for (const state of ["null", "empty", "zero", "false"]) assert(envelope.tables.flatMap((table) => table.rows.flatMap((row) => row.cells)).some((entry) => entry.state === state), `typed ${state} state was lost`);
			assert(cell(envelope, "X_ASC22_EH", "EHPAR1", (entry) => entry.value === 100.12345678901234), "binary64 EH value was changed");
			assert(cell(envelope, "X_ASC22_EH", "EHTYP", (entry) => entry.value === 999), "unknown EH type 999 was not retained");
			for (const phase of EXPECTED_PHASES) assert(log.includes(`MDB: ${phase}`), `missing production phase ${phase}`);
			assert((inbox?.items?.length ?? 0) === 1 && inbox.items[0]?.kind === "alignment", "safe horizontal geometry did not reach the import result");
			assert((inbox.items.filter((item) => item.kind === "profile" || item.kind === "cant").length) === 0, "profile or cant was fabricated");
			assert(preview?.source?.fileName === file.name && preview?.source?.parserId === "gnd-edit-mdb", "normal MDB preview provenance is missing");
			result.validPassed = true;
		}, initial);

		await runScenario("missing-core", async () => new File([await loadFixture("missing-core-jet4.mdb")], "missing-core-jet4.mdb", { type: "application/x-msaccess" }), async ({ log, worker, inbox, preview }) => {
			const envelope = worker.messages.find((message) => message?.type === "result")?.envelope;
			assert(envelope?.inventory?.length === 6 && !envelope.inventory.some((table) => table.name === "X_ASC13_PH"), "missing PH inventory is not truthful");
			assert(envelope?.diagnostics?.some((entry) => entry.code === "GND_CORE_TABLE_ABSENT" && entry.table === "X_ASC13_PH"), "missing PH diagnostic is absent");
			assert(log.includes("GND_SOURCE_INCOMPLETE"), "missing-core rejection code is not visible");
			assert((inbox?.items?.length ?? 0) === 0 && preview == null, "missing-core evidence constructed geometry");
			result.missingCorePassed = true;
		}, initial);

		await runScenario("conflicting-evidence", async () => new File([await loadFixture("conflicting-evidence-jet4.mdb")], "conflicting-evidence-jet4.mdb", { type: "application/x-msaccess" }), async ({ worker, inbox, preview }) => {
			const envelope = worker.messages.find((message) => message?.type === "result")?.envelope;
			const systems = [...new Set(envelope.tables.find((table) => table.name === "X_ASC12_PL").rows.map((row) => row.cells.find((entry) => entry.columnName === "LSYS")?.value))].sort();
			assert(same(systems, ["CONFLICT_LSYS", "SYNTH_LSYS"]), "both conflicting LSYS realizations were not retained");
			assert((inbox?.items?.length ?? 0) > 0, "conflicting source produced no inspectable import evidence");
			assert(inbox.items.every((item) => item?.status?.promotable !== true), "ambiguous LSYS evidence became promotable");
			assert(inbox.items.every((item) => item?.status?.eligibility?.reason === "conflicting-reference-evidence"), "conflicting item eligibility reason is missing");
			assert(inbox.items.every((item) => item?.derived?.spatialRef?.crsId == null && item?.derived?.spatialRef?.horizontalCrsId == null), "conflicting item selected a unique LSYS");
			assert(preview == null, "an arbitrary conflicting LSYS was selected for preview");
			await window.__ufAIM_gndImportWorkbench.open();
			await waitFor(() => inbox.items.every((item) => document.querySelector(`[data-evidence-id="${CSS.escape(item.evidenceId)}"]`)), "physical conflict Workbench evidence");
			assert(inbox.items.every((item) => document.querySelector(`[data-gnd-promote="${CSS.escape(item.id)}"]`)?.disabled === true), "physical conflict is transferable in Workbench");
			assert(same(await spotObjects(), initial.spots), "physical conflict created a SPOT object");
			window.__ufAIM_gndImportWorkbench.close({ restore: false });
			result.conflictPassed = true;
		}, initial);

		await runScenario("corrupt-page", async () => {
			const bytes = await loadFixture("valid-minimal-jet4.mdb");
			new Uint8Array(bytes).fill(0xff, 6144, 10240);
			return new File([bytes], "corrupt-page.mdb", { type: "application/x-msaccess" });
		}, async ({ log, worker, inbox, preview }) => {
			const error = worker.messages.find((message) => message?.type === "error")?.error;
			assert(error?.code === "MDB_CORRUPT" && log.includes("MDB_CORRUPT"), "corrupt-page error is not structured and visible");
			assert((inbox?.items?.length ?? 0) === 0 && preview == null, "corrupt-page evidence reached construction");
			result.corruptPagePassed = true;
		}, initial);

		result.restorationPassed = true;
	} catch (error) {
		result.failures.push({ phase: result.phase, assertion: String(error?.message ?? error) });
		try { await cleanScenario(initial); result.restorationPassed = true; }
		catch (restoreError) { result.restorationDiagnostics.push({ assertion: String(restoreError?.message ?? restoreError) }); }
	}
	const finalSpots = await spotObjects();
	result.remainingFixtureIds = finalSpots.map((entry) => String(entry?.id ?? "")).filter((id) => !initial.spots.some((entry) => String(entry?.id ?? "") === id));
	result.passed = result.validPassed && result.missingCorePassed && result.conflictPassed && result.corruptPagePassed && result.installedDropPathPassed && result.workerPassed && result.restorationPassed && result.restorationDiagnostics.length === 0 && result.remainingFixtureIds.length === 0 && result.failures.length === 0;
	result.phase = "complete";
	result.completedAt = new Date().toISOString();
	console.log(`GndMdbDrop E2E RESULT ${JSON.stringify(result)}`);
	console[result.passed ? "log" : "error"](`GndMdbDrop E2E ${result.passed ? "PASSED" : "FAILED"}`);
	return result;
})();
