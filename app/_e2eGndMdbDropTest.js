import { getLanguage } from "@app/i18n/strings.js";
import {
	FILE_DROP_LIFECYCLE_EVENT,
	installFileDrop,
} from "@io/input/fileDrop.js";
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
	dropLifecyclePassed: false,
	dropDisposerPassed: false,
	filePickerPassed: false,
	validPhysicalOutcomePassed: false,
	unsupportedPhysicalOutcomePassed: false,
	importSummaryPreservedPassed: false,
	importJobReadOncePassed: false,
	importJobHeartbeatPassed: false,
	importJobResponsivenessPassed: false,
	importJobCancellationPassed: false,
	importJobAtomicityPassed: false,
	importJobInteractionTimes: null,
	importJobPerformanceDebt: null,
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

function installDelayedWorkerObservation(delayMs = 2200) {
	const NativeWorker = window.Worker;
	const observation = { starts: [], terminations: 0, messages: [] };
	window.Worker = class DelayedProductionWorker extends NativeWorker {
		constructor(url, options) {
			super(url, options);
			this.delayedOnMessage = null;
			observation.starts.push(String(url));
			super.addEventListener("message", (event) => {
				observation.messages.push(clone(event.data));
				setTimeout(() => this.delayedOnMessage?.call(this, event), delayMs);
			});
		}
		set onmessage(handler) { this.delayedOnMessage = handler; }
		get onmessage() { return this.delayedOnMessage; }
		terminate() {
			observation.terminations += 1;
			return super.terminate();
		}
	};
	return { observation, restore: () => { window.Worker = NativeWorker; } };
}

async function measureAction(name, action, verify) {
	const targetMs = 250;
	const started = performance.now();
	await action();
	await new Promise((resolve) => requestAnimationFrame(resolve));
	await verify?.();
	const elapsedMs = performance.now() - started;
	return [name, Object.freeze({
		targetMs,
		elapsedMs,
		exceededTarget: elapsedMs > targetMs,
		functionalPassed: true,
	})];
}

async function dispatchInstalledDrop(file, observation) {
	const log = document.getElementById("log");
	assert(log, "application log unavailable");
	const beforeBatches = (log.textContent.match(/import batch:/g) ?? []).length;
	const lifecycle = [];
	const observeLifecycle = (event) => lifecycle.push(clone(event.detail));
	document.documentElement.addEventListener(FILE_DROP_LIFECYCLE_EVENT, observeLifecycle);
	const transfer = new DataTransfer();
	transfer.items.add(file);
	try {
		document.documentElement.dispatchEvent(new DragEvent("dragenter", {
			bubbles: true,
			cancelable: true,
			dataTransfer: transfer,
		}));
		const accepted = !document.documentElement.dispatchEvent(new DragEvent("drop", {
			bubbles: true,
			cancelable: true,
			dataTransfer: transfer,
		}));
		assert(accepted, "installed drop listener did not cancel the document drop event");
		await waitFor(
			() => lifecycle.some((entry) => entry.state === "completed" || entry.state === "failed"),
			`${file.name} terminal drop lifecycle`
		);
		const terminal = lifecycle.findLast(
			(entry) => entry.state === "completed" || entry.state === "failed"
		);
		if (terminal?.state === "failed") {
			throw new Error(
				`${file.name} drop failed: ${terminal.code ?? "FILE_DROP_IMPORT_FAILED"} :: ${terminal.message ?? "unknown error"}`
			);
		}
		await waitFor(() => (log.textContent.match(/import batch:/g) ?? []).length > beforeBatches, `${file.name} ImportController completion`);
		await waitFor(() => observation.terminations === observation.starts.length, `${file.name} worker termination`);
		assert(lifecycle.some((entry) => entry.state === "drag-active"), `${file.name} missing drag-active lifecycle`);
		assert(lifecycle.some((entry) => entry.state === "processing" && entry.fileCount === 1), `${file.name} missing processing lifecycle`);
		assert(lifecycle.some((entry) => entry.state === "completed" && entry.fileCount === 1), `${file.name} missing completed lifecycle`);
		assert(log.textContent.includes("file drop: processing (1)"), `${file.name} processing feedback is not visible`);
		assert(log.textContent.includes("file drop: completed (1)"), `${file.name} completion feedback is not visible`);
		const completed = terminal;
		assert(completed?.outcome?.fileOutcomes?.length === 1, `${file.name} completed lifecycle lost its file outcome`);
		result.dropLifecyclePassed = true;
		return {
			log: log.textContent,
			lifecycle,
			outcome: clone(completed.outcome.fileOutcomes[0]),
		};
	} finally {
		document.documentElement.removeEventListener(FILE_DROP_LIFECYCLE_EVENT, observeLifecycle);
	}
}

async function verifyDropRejectionAndDisposer() {
	const element = document.createElement("div");
	const lifecycle = [];
	let calls = 0;
	const dispose = installFileDrop({
		element,
		onFiles: async () => { calls += 1; },
		onLifecycle: (detail) => lifecycle.push(clone(detail)),
	});
	element.dispatchEvent(new DragEvent("drop", {
		bubbles: true,
		cancelable: true,
		dataTransfer: new DataTransfer(),
	}));
	await waitFor(() => lifecycle.some((entry) => entry.state === "rejected"), "empty drop rejection");
	assert(lifecycle.some((entry) => entry.code === "FILE_DROP_NO_FILES"), "empty drop rejection code is missing");
	element.dispatchEvent(new DragEvent("dragenter", {
		bubbles: true,
		cancelable: true,
		dataTransfer: new DataTransfer(),
	}));
	element.dispatchEvent(new DragEvent("dragleave", {
		bubbles: true,
		cancelable: true,
		dataTransfer: new DataTransfer(),
	}));
	assert(lifecycle.some((entry) => entry.state === "drag-active"), "drag-active lifecycle is missing");
	assert(lifecycle.filter((entry) => entry.state === "idle").length >= 2, "idle lifecycle is missing after dragleave");
	dispose();
	dispose();
	const transfer = new DataTransfer();
	transfer.items.add(new File(["ignored"], "ignored.txt", { type: "text/plain" }));
	element.dispatchEvent(new DragEvent("drop", {
		bubbles: true,
		cancelable: true,
		dataTransfer: transfer,
	}));
	await sleep(20);
	assert(calls === 0, "disposed drop listener still invokes imports");

	const failingLifecycle = [];
	const failingElement = document.createElement("div");
	const disposeFailing = installFileDrop({
		element: failingElement,
		onFiles: async () => { throw new Error("synthetic file-drop failure"); },
		onLifecycle: (detail) => failingLifecycle.push(clone(detail)),
	});
	const failingTransfer = new DataTransfer();
	failingTransfer.items.add(new File(["failure"], "failure.txt", { type: "text/plain" }));
	failingElement.dispatchEvent(new DragEvent("drop", {
		bubbles: true,
		cancelable: true,
		dataTransfer: failingTransfer,
	}));
	await waitFor(() => failingLifecycle.some((entry) => entry.state === "failed"), "failed drop lifecycle");
	assert(failingLifecycle.some((entry) => entry.code === "FILE_DROP_IMPORT_FAILED"), "failed drop code is missing");
	disposeFailing();
	result.dropDisposerPassed = true;
}

async function verifyFilePicker(file, observation) {
	const input = document.getElementById("fileImport");
	assert(input, "file picker input is unavailable");
	const log = document.getElementById("log");
	const beforeBatches = (log.textContent.match(/import batch:/g) ?? []).length;
	const transfer = new DataTransfer();
	transfer.items.add(file);
	input.files = transfer.files;
	input.dispatchEvent(new Event("change", { bubbles: true }));
	await waitFor(() => (log.textContent.match(/import batch:/g) ?? []).length > beforeBatches, "file picker ImportController completion");
	await waitFor(() => observation.terminations === observation.starts.length, "file picker worker termination");
	assert(observation.starts.length === 1, "file picker did not invoke the production Worker");
	assert(input.value === "", "file picker value was not reset");
	result.filePickerPassed = true;
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
		const drop = await dispatchInstalledDrop(file, worker.observation);
		assert(worker.observation.starts.length === 1, `${name} did not create exactly one Worker`);
		assert(worker.observation.starts[0].includes("mdb-reader-worker-3.2.0.js"), `${name} bypassed the production MDB Worker bundle`);
		assert(worker.observation.terminations === 1, `${name} Worker was not terminated`);
		await verify({
			file,
			log: drop.log,
			outcome: drop.outcome,
			worker: worker.observation,
			inbox: await importState(),
			preview: window.__ufAIM_store.getState()?.preview_item ?? null,
		});
		result.workerPassed = true;
		result.installedDropPathPassed = true;
	} finally {
		worker.restore();
		await cleanScenario(initial);
	}
}

async function verifyCancellableBackgroundJob(initial) {
	result.phase = "cancellable-background-job";
	const bridge = window.__ufAIM_teBridge;
	assert(bridge, "TransEd bridge unavailable");
	await bridge.open();
	bridge.close();
	const bytes = await loadFixture("valid-minimal-jet4.mdb");
	let reads = 0;
	const file = new File([bytes], "cancelled-valid-minimal-jet4.mdb", {
		type: "application/x-msaccess",
	});
	const nativeArrayBuffer = file.arrayBuffer.bind(file);
	Object.defineProperty(file, "arrayBuffer", {
		value: async () => { reads += 1; return nativeArrayBuffer(); },
	});
	const before = {
		importState: clone(await importState()),
		spots: clone(await spotObjects()),
		selection: clone(getWorkspaceSelection(window.__ufAIM_store.getState())),
		preview: clone(window.__ufAIM_store.getState()?.preview_item ?? null),
		tracks: clone(window.__ufAIM_store.getState()?.workspace_visible_tracks ?? null),
	};
	const delayed = installDelayedWorkerObservation(10_000);
	const commands = [];
	const nativeSend = window.messaging.sendCmdAwait.bind(window.messaging);
	window.messaging.sendCmdAwait = async (name, payload, options) => {
		commands.push(name);
		return nativeSend(name, payload, options);
	};
	let fitCalls = 0;
	const nativeFit = window.__ufAIM_viewController.fitActive.bind(window.__ufAIM_viewController);
	window.__ufAIM_viewController.fitActive = async (...args) => {
		fitCalls += 1;
		return nativeFit(...args);
	};
	const lifecycle = [];
	const observeLifecycle = (event) => lifecycle.push(clone(event.detail));
	document.documentElement.addEventListener(FILE_DROP_LIFECYCLE_EVENT, observeLifecycle);
	try {
		const transfer = new DataTransfer();
		transfer.items.add(file);
		document.documentElement.dispatchEvent(new DragEvent("drop", {
			bubbles: true,
			cancelable: true,
			dataTransfer: transfer,
		}));
		await waitFor(
			() => window.__ufAIM_importController.getActiveImportJob()?.phase === "extracting",
			"background import extracting phase"
		);
		const extracting = window.__ufAIM_importController.getActiveImportJob();
		const times = [];
		times.push(await measureAction("TransEd open", async () => {
			document.getElementById("btnTrans").click();
		}, () => assert(!document.getElementById("transOverlay").classList.contains("hidden"), "TransEd did not open")));
		times.push(await measureAction("TransEd close", async () => {
			document.getElementById("btnTransClose").click();
		}, () => assert(document.getElementById("transOverlay").classList.contains("hidden"), "TransEd did not close")));
		times.push(await measureAction("TransEd reopen", async () => {
			document.getElementById("btnTrans").click();
		}, () => assert(!document.getElementById("transOverlay").classList.contains("hidden"), "TransEd did not reopen")));
		const nextLevel = bridge.getDebugState().level === "simpleFcn" ? "transition" : "simpleFcn";
		times.push(await measureAction("TransEd level", () => bridge.selectLevel(nextLevel), () => {
			assert(bridge.getDebugState().level === nextLevel, "TransEd level did not change");
		}));
		await bridge.selectLevel("transition");
		const stateBeforePreset = bridge.getDebugState();
		const nextPreset = stateBeforePreset.catalogue.records.transition
			.find((entry) => entry.id !== stateBeforePreset.recordId)?.id;
		times.push(await measureAction("TransEd preset", () => bridge.selectRecord(nextPreset), async () => {
			assert(bridge.getDebugState().recordId === nextPreset, "TransEd preset did not change");
			const spec = await window.messaging.sendCmdAwait("Transition.GetPresetSpec", { presetId: nextPreset });
			assert(spec?.descriptor, "Transition.GetPresetSpec did not reflect preset change");
			assert(window.__ufAIM_store.getState()?.te_presetId === nextPreset, "TransEd store did not reflect preset change");
		}));
		const shell = document.getElementById("ufShell");
		assert(shell, "application shell unavailable");
		const cockpitWasCollapsed = shell.classList.contains("is-cockpit-collapsed");
		times.push(await measureAction("Cockpit toggle", async () => {
			document.getElementById("btnCockpit").click();
		}, async () => {
			assert(
				shell.classList.contains("is-cockpit-collapsed") !== cockpitWasCollapsed,
				"Cockpit shell state did not toggle"
			);
			document.getElementById("btnCockpit").click();
			await new Promise((resolve) => requestAnimationFrame(resolve));
			assert(
				shell.classList.contains("is-cockpit-collapsed") === cockpitWasCollapsed,
				"Cockpit shell state did not toggle back"
			);
		}));
		times.push(await measureAction("Viewer Fit", async () => {
			document.getElementById("btnFit").click();
		}, () => assert(fitCalls === 1, "Viewer Fit did not reach fitActive")));
		result.importJobInteractionTimes = Object.freeze(Object.fromEntries(times));
		result.importJobPerformanceDebt = Object.freeze(
			times
				.filter(([, measurement]) => measurement.exceededTarget)
				.map(([name, measurement]) => Object.freeze({ name, ...measurement }))
		);
		result.importJobResponsivenessPassed = true;
		await sleep(550);
		const heartbeat = window.__ufAIM_importController.getActiveImportJob();
		assert(heartbeat.jobId === extracting.jobId && heartbeat.phase === "extracting", "job identity or phase changed during interaction");
		assert(heartbeat.heartbeatAt !== extracting.heartbeatAt, "job heartbeat stopped during extraction");
		result.importJobHeartbeatPassed = true;
		assert(!commands.includes("Import.CommitJob"), "cancelled job committed before cancellation");
		assert(!commands.some((name) => [
			"Import.BeginSession",
			"Import.PublishResultEvidence",
			"Import.AddItems",
		].includes(name)), "productive job used legacy publication before cancellation");
		assert(same(before, {
			importState: clone(await importState()),
			spots: clone(await spotObjects()),
			selection: clone(getWorkspaceSelection(window.__ufAIM_store.getState())),
			preview: clone(window.__ufAIM_store.getState()?.preview_item ?? null),
			tracks: clone(window.__ufAIM_store.getState()?.workspace_visible_tracks ?? null),
		}), "pre-commit extraction mutated application state");
		assert(window.__ufAIM_importController.cancelActiveImportJob("e2e-cancel") === true, "active job cancellation was rejected");
		await waitFor(
			() => lifecycle.some((entry) => entry.state === "completed" && entry.outcome?.status === "cancelled"),
			"cancelled drop completion"
		);
		await waitFor(() => delayed.observation.terminations === 1, "cancelled worker termination");
		await sleep(2300);
		assert(delayed.observation.terminations === 1, "late worker result caused repeated termination");
		assert(reads === 1, `MDB file was read ${reads} times`);
		result.importJobReadOncePassed = true;
		result.importJobCancellationPassed = true;
		assert(same(before, {
			importState: clone(await importState()),
			spots: clone(await spotObjects()),
			selection: clone(getWorkspaceSelection(window.__ufAIM_store.getState())),
			preview: clone(window.__ufAIM_store.getState()?.preview_item ?? null),
			tracks: clone(window.__ufAIM_store.getState()?.workspace_visible_tracks ?? null),
		}), "cancelled job leaked partial state");
		result.importJobAtomicityPassed = true;
	} finally {
		document.documentElement.removeEventListener(FILE_DROP_LIFECYCLE_EVENT, observeLifecycle);
		window.messaging.sendCmdAwait = nativeSend;
		window.__ufAIM_viewController.fitActive = nativeFit;
		delayed.restore();
		bridge.close();
		await cleanScenario(initial);
	}
}

async function verifyUnsupportedPhysicalDrop(initial) {
	result.phase = "unsupported-physical-drop";
	const file = new File(
		["unsupported physical drop characterization"],
		"physical-drop.unsupported",
		{ type: "application/octet-stream" }
	);
	const worker = installWorkerObservation();
	try {
		const drop = await dispatchInstalledDrop(file, worker.observation);
		const outcome = drop.outcome;
		assert(worker.observation.starts.length === 0, "unsupported physical drop unexpectedly started the MDB Worker");
		assert(outcome.fileName === "physical-drop.unsupported", "unsupported outcome lost the exact filename");
		assert(outcome.extension === ".unsupported", "unsupported outcome lost the exact extension");
		assert(outcome.status === "unknown", "unsupported outcome was not classified as unknown");
		assert(typeof outcome.reason === "string" && outcome.reason.length > 0, "unsupported outcome lost its reason");
		assert(outcome.parserId === null, "unsupported outcome fabricated a parser ID");
		assert(outcome.itemCount === 0 && outcome.rejectedCount === 0, "unsupported outcome fabricated import items");
		assert(outcome.evidencePublished === false, "unsupported outcome fabricated published evidence");
		assert(outcome.failed === false, "unsupported classification was reported as an execution failure");
		assert(document.getElementById("status")?.textContent?.includes(file.name), "completed lifecycle overwrote the unsupported file summary");
		assert(drop.log.includes(`file outcome: ${JSON.stringify(outcome)}`), "unsupported file-specific outcome was not logged");
		result.unsupportedPhysicalOutcomePassed = true;
		result.importSummaryPreservedPassed = true;
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
		await verifyDropRejectionAndDisposer();
		await verifyCancellableBackgroundJob(initial);

		await runScenario("valid", async () => {
			const bytes = await loadFixture("valid-minimal-jet4.mdb");
			assert(await sha256(bytes) === EXPECTED_HASH, "valid fixture fingerprint mismatch before drop");
			return new File([bytes], "valid-minimal-jet4.mdb", { type: "application/x-msaccess" });
		}, async ({ file, log, outcome, worker, inbox, preview }) => {
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
			assert(outcome.fileName === file.name, "valid physical drop outcome lost its filename");
			assert(outcome.extension === ".mdb", "valid physical drop outcome lost its MDB extension");
			assert(outcome.status !== "unknown", `supported GND file was classified unknown: ${outcome.fileName} (${outcome.extension})`);
			assert(outcome.parserId === "gndEdit", "valid physical drop outcome lost its parser ID");
			assert(outcome.itemCount === 1 && outcome.rejectedCount === 0, "valid physical drop outcome counts are incorrect");
			assert(outcome.evidencePublished === true && outcome.failed === false, "valid physical drop outcome publication flags are incorrect");
			assert(document.getElementById("status")?.textContent?.includes(file.name), "completed lifecycle overwrote the valid file summary");
			assert(log.includes(`file outcome: ${JSON.stringify(outcome)}`), "valid file-specific outcome was not logged");
			result.validPhysicalOutcomePassed = true;
			result.importSummaryPreservedPassed = true;
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

		await verifyUnsupportedPhysicalDrop(initial);

		result.phase = "file-picker";
		const pickerWorker = installWorkerObservation();
		try {
			const bytes = await loadFixture("valid-minimal-jet4.mdb");
			await verifyFilePicker(
				new File([bytes], "picker-valid-minimal-jet4.mdb", { type: "application/x-msaccess" }),
				pickerWorker.observation
			);
		} finally {
			pickerWorker.restore();
			await cleanScenario(initial);
		}

		result.restorationPassed = true;
	} catch (error) {
		result.failures.push({ phase: result.phase, assertion: String(error?.message ?? error) });
		try { await cleanScenario(initial); result.restorationPassed = true; }
		catch (restoreError) { result.restorationDiagnostics.push({ assertion: String(restoreError?.message ?? restoreError) }); }
	}
	const finalSpots = await spotObjects();
	result.remainingFixtureIds = finalSpots.map((entry) => String(entry?.id ?? "")).filter((id) => !initial.spots.some((entry) => String(entry?.id ?? "") === id));
	result.passed = result.validPassed && result.missingCorePassed && result.conflictPassed && result.corruptPagePassed && result.installedDropPathPassed && result.dropLifecyclePassed && result.dropDisposerPassed && result.filePickerPassed && result.validPhysicalOutcomePassed && result.unsupportedPhysicalOutcomePassed && result.importSummaryPreservedPassed && result.importJobReadOncePassed && result.importJobHeartbeatPassed && result.importJobResponsivenessPassed && result.importJobCancellationPassed && result.importJobAtomicityPassed && result.workerPassed && result.restorationPassed && result.restorationDiagnostics.length === 0 && result.remainingFixtureIds.length === 0 && result.failures.length === 0;
	result.phase = "complete";
	result.completedAt = new Date().toISOString();
	console.log(`GndMdbDrop E2E RESULT ${JSON.stringify(result)}`);
	console[result.passed ? "log" : "error"](`GndMdbDrop E2E ${result.passed ? "PASSED" : "FAILED"}`);
	return result;
})();
