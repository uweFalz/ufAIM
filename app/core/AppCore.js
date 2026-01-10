// app/core/appCore.js

import { createStore } from "../viewSync.js";

import { registerTransitionFamily } from "../transition/transitionFamily.js";
import { transitionFamilies } from "../transition/families/index.js";

import { makeProjectModel } from "../model/projectModel.js";
import { DEFAULT_PROJECT } from "../model/defaults.js";
import { loadProjectLocal, saveProjectLocal, exportProjectFile } from "../io/projectIO.js";

import { makeThreeViewer } from "../threeViewer.js";
import { makeAlignmentBandView } from "../alignmentBandView.js";
import { makeTransitionEditorView } from "../transitionEditorView.js";

import { buildDemoAlignmentFromState, sampleAndEvalDemo } from "./demoAlignmentBridge.js";
import { wireUI } from "./uiWiring.js";

import { installFileDrop } from "../io/fileDrop.js";
import { importFileAuto } from "../io/importTRA_GRA.js";
import { applyImportToProject } from "../io/importApply.js";
import { makeImportSession } from "../io/importSession.js";

function registerFamilies() {
	for (const fam of transitionFamilies) registerTransitionFamily(fam);
}

function makeInitialProject() {
	const loaded = loadProjectLocal();
	if (loaded) return makeProjectModel(loaded);
	// structuredClone is available in modern browsers; fallback if needed
	const base = typeof structuredClone === "function"
	? structuredClone(DEFAULT_PROJECT)
	: JSON.parse(JSON.stringify(DEFAULT_PROJECT));
	return makeProjectModel(base);
}

function applyProjectToStore(project, store) {
	const v = project?.view ?? {};
	const tr = project?.transition ?? {};
	const p = tr?.params ?? {};
	
	const L = v.L ?? 120;
	const lead = v.lead ?? 60;
	const u = v.u ?? 0.25;

	const s = (v.s != null) ? v.s : (lead + u * L);

	store.setState({
		s,
		// demo “world embedding”
		u: v.u ?? 0.25,
		L: v.L ?? 120,
		R: v.R ?? 800,
		lead: v.lead ?? 60,
		arcLen: v.arcLen ?? 220,

		// transition editor
		te_visible: false,
		te_family: tr.family ?? "linear-clothoid",
		te_w1: p.w1 ?? 0.0,
		te_w2: p.w2 ?? 1.0,
		te_m: p.m ?? 1.0,
		te_plot: tr.plot ?? "k"
	});
}

function readProjectFromStore(store) {
	const st = store.getState();
	return makeProjectModel({
		view: {
			u: st.u,
			L: st.L,
			R: st.R,
			lead: st.lead,
			arcLen: st.arcLen
		},
		transition: {
			family: st.te_family,
			params: { w1: st.te_w1, w2: st.te_w2, m: st.te_m ?? 1.0 },
			plot: st.te_plot ?? "k"
		}
	});
}

export async function bootApp() {
	// 1) register transition families
	registerFamilies();

	// 2) store (single source of truth)
	const store = createStore({
		te_visible: false,
		te_family: "linear-clothoid",
		te_w1: 0.0,
		te_w2: 1.0,
		te_m: 1.0,
		te_plot: "k",

		s: 90, // meters (station)
		u: 0.25,
		L: 120,
		R: 800,
		lead: 60,
		arcLen: 220
	});

	// 3) load project and apply to store
	const project = makeInitialProject();
	applyProjectToStore(project, store);

	// 4) build views
	const canvas = document.getElementById("view3d");
	if (!canvas) throw new Error("Missing <canvas id='view3d'>");

	const three = makeThreeViewer({ canvas });
	const band = makeAlignmentBandView(store);
	await band.init("board2d");

	const teView = makeTransitionEditorView(store);
	let teInited = false;

	// 5) UI wiring (DOM -> store + IO buttons)
	const ui = wireUI(store, {
		onSave: () => {
			const p = readProjectFromStore(store);
			saveProjectLocal(p);
		},
		onExport: () => {
			const p = readProjectFromStore(store);
			exportProjectFile(p, "ufAIM-project.json");
		},
		onProjectLoaded: (obj) => {
			const p = makeProjectModel(obj);
			applyProjectToStore(p, store);
			// optional: auto-save after import
			saveProjectLocal(readProjectFromStore(store));
		},
		onToggleTransEditor: async (visible) => {
			if (visible && !teInited) {
				teInited = true;
				await teView.init();
			}
		},
		onMarkerClick: () => {
			const st = store.getState();
			ui.showProps({
				type: "marker click",
				u: st.u,
				note: "selection confirmed"
			});
			// ???
			ui.log(`TRA: elems=${imp.meta?.elements ?? "?"} pts=${imp.meta?.points ?? "?"} header=${imp.meta?.header ?? "-"}`);
		}
	});

	// also allow 3D viewer marker click -> UI
	three.onMarkerClick(() => ui.hooks?.onMarkerClick?.());

	const importCache = new Map(); 
	// key: baseName ("401"), value: { tra?, gra?, ts }
	
	const importSession = makeImportSession();

	// --- Drag&Drop import (TRA/GRA minimal) ---
	installFileDrop({
		element: document.documentElement,
		onFiles: async (files) => {
			for (const f of files) {
				ui.log(`drop: ${f.name} (${f.size} bytes)`);
				try {
					const imp = await importFileAuto(f);
					const res = importSession.ingest(imp);

					const effects = applyImportToProject({
						project,
						store,
						imp: res.imp,
						draft: res.draft,
						slot: res.slot,
						ui
					});

					if (effects?.zoomBBox) {
						three.zoomToFitBox?.(effects.zoomBBox, { padding: 1.35 });
					}
				} catch (e) {
					ui.log(`import failed: ${f.name} ❌ ${String(e)}`);
				}
			}
		}
	});


	// 6) subscription: compute -> render
	store.subscribe((st) => {
		const alignment = buildDemoAlignmentFromState(st);
		const { pts, marker, k0, k1, kappaNorm } = sampleAndEvalDemo(alignment, st);

		// 3D
		three.setTrackPoints(pts);
		three.setMarker(marker);
		
		const importedPts = st.import_polyline;
		if (Array.isArray(importedPts) && importedPts.length >= 2) {
			const pts = importedPts.map(p => ({ x: p.x, y: p.y, z: 0 }));
			three.setTrackPoints?.(pts);

			const m = st.import_marker;
			const marker = (m && Number.isFinite(m.x) && Number.isFinite(m.y))
			? { x: m.x, y: m.y, z: 0, s: 0 }
			: { x: pts[0].x, y: pts[0].y, z: 0, s: 0 };

			three.setMarker?.(marker);

			band.update();
			ui.updateReadouts({ st, marker: { s: 0 }, readout: { k0: 0, k1: 0, kappaNorm: 0 } });
			return;
		}

		// Temporary bridge for bandView (until bandView reads model directly)
		window.__ufAIM_latestSample = {
			pts: pts.map(p => ({ x: p.x, y: p.y })),
			lead: st.lead,
			totalLen: alignment.totalLength
		};
		window.__ufAIM_marker = { x: marker.x, y: marker.y };

		// 2D
		band.update();

		// UI readouts
		ui.updateReadouts({
			st,
			marker,
			readout: {
				k0,
				k1,
				kappaNorm
			}
		});
	}, { immediate: true });

	// 7) start render loop (viewer calls resize internally if you applied that patch)
	three.start();

	ui.log("boot: AppCore online ✅");
}

function buildSevenLinesDraft(base, traImp, graImp) {
	const rawPts =
	traImp?.geometry?.pts ??
	traImp?.geometry ??
	traImp?.pts ??
	[];

	// normalize to [{x,y},...]
	const polyline2d = [];
	for (const p of rawPts) {
		const x = p?.x ?? p?.[0];
		const y = p?.y ?? p?.[1];
		if (Number.isFinite(x) && Number.isFinite(y)) polyline2d.push({ x, y });
	}

	// bbox + center (for marker)
	let bbox = null;
	let bboxCenter = null;
	if (polyline2d.length >= 2) {
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const p of polyline2d) {
			if (p.x < minX) minX = p.x;
			if (p.y < minY) minY = p.y;
			if (p.x > maxX) maxX = p.x;
			if (p.y > maxY) maxY = p.y;
		}
		bbox = { minX, minY, maxX, maxY };
		bboxCenter = { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 };
	}

	return {
		type: "SevenLinesDraft",
		id: base,
		source: { tra: traImp?.name, gra: graImp?.name },

		kmLine: { alignmentRef: "right" },

		right: {
			polyline2d,
			bbox,
			bboxCenter
		},

		left: null,
		grade: graImp?.grade ?? graImp?.profile ?? null,
		cant: graImp?.cant ?? null,

		raw: {
			traKeys: traImp ? Object.keys(traImp) : [],
			graKeys: graImp ? Object.keys(graImp) : []
		}
	};
}
