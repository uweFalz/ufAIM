// app/core/appCore.js

import { wireUI } from "./uiWiring.js";
import { t } from "../i18n/strings.js";

export async function bootApp() {
	const logElement = document.getElementById("log");
	const statusElement = document.getElementById("status");

	if (statusElement) statusElement.textContent = t("booting");
	if (logElement) logElement.textContent = `${t("boot_start")}\n`;

	// UI verdrahten (sollte selbst robust sein)
	const ui = wireUI({ logElement, statusElement });

	if (statusElement) statusElement.textContent = t("boot_ok");
	if (logElement) logElement.textContent += `${t("boot_ready")}\n`;

	return ui; // optional – hilfreich zum Debuggen
}









/*

import { makeThreeViewer } from "../threeViewer.js";
import { makeAlignmentBandView } from "../alignmentBandView.js";
import { makeTransitionEditorView } from "../transitionEditorView.js";
import { createStore } from "../viewSync.js";

import { registerTransitionFamily } from "../transition/transitionFamily.js";
import { transitionFamilies } from "../transition/families/index.js";

import { makeProjectModel } from "../model/projectModel.js";
import { DEFAULT_PROJECT } from "../model/defaults.js";

import { buildDemoAlignmentFromState, sampleAndEvalDemo } from "./demoAlignmentBridge.js";
import { wireUI } from "./uiWiring.js";

import { loadProjectLocal, saveProjectLocal, exportProjectFile, importProject } from "../io/projectIO.js";
import { installFileDrop } from "../io/fileDrop.js";

import { importFileAuto } from "../io/importTRA_GRA.js";
import { applyImportToProject } from "../io/importApply.js";
import { makeImportSession } from "../io/importSession.js";
import { runImportEffects } from "../io/importEffects.js";

import { getStrings } from "../i18n/strings.js";

function registerTransitionFamilies() {
	for (const family of transitionFamilies) registerTransitionFamily(family);
}

function makeInitialProjectModel() {
	const loaded = loadProjectLocal();
	if (loaded) return makeProjectModel(loaded);

	const base = typeof structuredClone === "function"
		? structuredClone(DEFAULT_PROJECT)
		: JSON.parse(JSON.stringify(DEFAULT_PROJECT));

	return makeProjectModel(base);
}

function applyProjectToState(projectModel, stateStore) {
	const view = projectModel?.view ?? {};
	const transition = projectModel?.transition ?? {};
	const params = transition?.params ?? {};

	const L = view.L ?? 120;
	const lead = view.lead ?? 60;
	const u = view.u ?? 0.25;

	const s = (view.s != null) ? view.s : (lead + u * L);

	stateStore.setState({
		s,
		u: view.u ?? 0.25,
		L: view.L ?? 120,
		R: view.R ?? 800,
		lead: view.lead ?? 60,
		arcLen: view.arcLen ?? 220,

		te_visible: false,
		te_family: transition.family ?? "linear-clothoid",
		te_w1: params.w1 ?? 0.0,
		te_w2: params.w2 ?? 1.0,
		te_m: params.m ?? 1.0,
		te_plot: transition.plot ?? "k",
	});
}

function readProjectFromState(stateStore) {
	const state = stateStore.getState();
	return makeProjectModel({
		view: {
			u: state.u,
			L: state.L,
			R: state.R,
			lead: state.lead,
			arcLen: state.arcLen,
			s: state.s,
		},
		transition: {
			family: state.te_family,
			params: { w1: state.te_w1, w2: state.te_w2, m: state.te_m ?? 1.0 },
			plot: state.te_plot ?? "k",
		},
	});
}

export async function bootApp() {
	const status = document.getElementById("status");
	const log = document.getElementById("log");

	if (status) status.textContent = "boot ok";
	if (log) log.textContent = "appCore alive\n";

	document.addEventListener("drop", (ev) => {
		ev.preventDefault();
		log.textContent += "drop detected\n";
	});
	document.addEventListener("dragover", (ev) => ev.preventDefault());
}

export async function bootApp_ORG() {
	console.log("bootApp(): start");
	
	const t = getStrings("de");

	// 1) register transition families
	registerTransitionFamilies();

	// 2) state store (single source of truth)
	const stateStore = createStore({
		te_visible: false,
		te_family: "linear-clothoid",
		te_w1: 0.0,
		te_w2: 1.0,
		te_m: 1.0,
		te_plot: "k",

		s: 90,
		u: 0.25,
		L: 120,
		R: 800,
		lead: 60,
		arcLen: 220,
	});

	// 3) load project and apply to store
	const projectModel = makeInitialProjectModel();
	applyProjectToState(projectModel, stateStore);

	// 4) build views
	const canvas3d = document.getElementById("view3d");
	if (!canvas3d) throw new Error("Missing <canvas id='view3d'>");

	const threeViewer = makeThreeViewer({ canvas: canvas3d });
	const bandView = makeAlignmentBandView(stateStore);
	await bandView.init("board2d");

	const transitionEditorView = makeTransitionEditorView(stateStore);
	let transitionEditorInitialized = false;

	// import session
	const importSession = makeImportSession();

	// 5) UI wiring (DOM -> store + IO buttons)
	const ui = wireUI(stateStore, {
		onSave: () => {
			const p = readProjectFromState(stateStore);
			saveProjectLocal(p);
		},
		onExport: () => {
			const p = readProjectFromState(stateStore);
			exportProjectFile(p, "ufAIM-project.json");
		},
		onProjectLoaded: (object) => {
			const p = makeProjectModel(object);
			applyProjectToState(p, stateStore);
			saveProjectLocal(readProjectFromState(stateStore));
		},
		onToggleTransEditor: async (visible) => {
			if (visible && !transitionEditorInitialized) {
				transitionEditorInitialized = true;
				await transitionEditorView.init();
			}
		},

		// IMPORTANT: file picker intercept for TRA/GRA
		onImportFile: async (file) => {
			const ext = (file.name.split(".").pop() || "").toLowerCase();
			if (ext !== "tra" && ext !== "gra") return false;

			const imported = await importFileAuto(file);
			window.__ufAIM_lastImport = imported;

			const ingestResult = importSession.ingest(imported);
			const effects = applyImportToProject({
				project: projectModel,
				store: stateStore,
				imp: ingestResult.imp,
				draft: ingestResult.draft,
				slot: ingestResult.slot,
				ui,
			});

			runImportEffects({ effects, store: stateStore, ui, three: threeViewer });
			ui.toast?.({ level: "success", text: `${t.toastImportOk}: ${file.name}` });
			return true;
		},

		onMarkerClick: () => {
			const last = window.__ufAIM_lastImport;
			ui.showProps({
				type: "marker click",
				lastImport: last?.name ?? "-",
			});
		},
	});

	// 3D viewer marker click -> UI hook
	threeViewer.onMarkerClick(() => ui.hooks?.onMarkerClick?.());

	// --- Drag&Drop import (TRA/GRA minimal) ---
	installFileDrop({
		element: document.documentElement,
		onFiles: async (files) => {
			for (const file of files) {
				ui.log(`drop: ${file.name} (${file.size} bytes)`);
				try {
					const ext = (file.name.split(".").pop() || "").toLowerCase();

					// JSON project import
					if (ext === "json") {
						const text = await file.text();
						const project = importProject(text);
						ui.hooks?.onProjectLoaded?.(project);
						ui.log(`${t.logImportOk} ${file.name}`);
						continue;
					}

					// TRA/GRA import
					if (ext === "tra" || ext === "gra") {
						const imported = await importFileAuto(file);
						window.__ufAIM_lastImport = imported;

						const ingestResult = importSession.ingest(imported);
						const effects = applyImportToProject({
							project: projectModel,
							store: stateStore,
							imp: ingestResult.imp,
							draft: ingestResult.draft,
							slot: ingestResult.slot,
							ui,
						});

						runImportEffects({ effects, store: stateStore, ui, three: threeViewer });
						ui.log(`${t.logImportOk} ${file.name}`);
						continue;
					}

					ui.log(`${t.logDropIgnored}: ${file.name}`);
				} catch (error) {
					ui.log(`${t.logImportFailed} ${file.name} ${String(error)}`);
					ui.toast?.({ level: "error", text: `${t.toastImportFailed}: ${file.name}` });
				}
			}
		},
	});

	// 6) subscription: compute -> render
	stateStore.subscribe((state) => {
		// If import polyline exists, it overrides demo rendering.
		const importedPolyline = state.import_polyline;
		if (Array.isArray(importedPolyline) && importedPolyline.length >= 2) {
			const points3d = importedPolyline.map(p => ({ x: p.x, y: p.y, z: 0 }));
			threeViewer.setTrackPoints?.(points3d);

			const m = state.import_marker;
			const marker = (m && Number.isFinite(m.x) && Number.isFinite(m.y))
				? { x: m.x, y: m.y, z: 0, s: 0 }
				: { x: points3d[0].x, y: points3d[0].y, z: 0, s: 0 };

			threeViewer.setMarker?.(marker);

			bandView.update();
			ui.updateReadouts({ state, marker: { s: 0 }, readout: { k0: 0, k1: 0, kappaNorm: 0 } });
			return;
		}

		// Demo path (fallback)
		const alignment = buildDemoAlignmentFromState(state);
		const { pts, marker, k0, k1, kappaNorm } = sampleAndEvalDemo(alignment, state);

		threeViewer.setTrackPoints(pts);
		threeViewer.setMarker(marker);

		// bridge for bandView (until bandView reads model directly)
		window.__ufAIM_latestSample = {
			pts: pts.map(p => ({ x: p.x, y: p.y })),
			lead: state.lead,
			totalLen: alignment.totalLength,
		};

		window.__ufAIM_marker = { x: marker.x, y: marker.y };

		bandView.update();

		ui.updateReadouts({
			state,
			marker,
			readout: { k0, k1, kappaNorm },
		});
	}, { immediate: true });

	// 7) start render loop
	threeViewer.start();
	ui.log(t.logBootOnline);
}

*/