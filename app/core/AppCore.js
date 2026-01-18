// app/core/appCore.js
// QuickHooks mode (stable freeze):
// - applyImportToProject writes to store.import_* (import_polyline2d, import_profile1d, import_cant1d, import_meta)
// - RouteProjectSelect (RP) switches activeRouteProjectId and mirrors rp.hooks -> store.import_*
// - 3D master renders from store.import_polyline2d (+ marker + section line debug)
// - overlays are text-only (bands + section)

import { wireUI } from "./uiWiring.js";
import { t } from "../i18n/strings.js";

import { installFileDrop } from "../io/fileDrop.js";
import { importFileAuto } from "../io/importTRA_GRA.js"; // <-- muss hier raus!!!
import { makeImportSession } from "../io/importSession.js";
import { applyImportToProject, mirrorQuickHooksFromActive } from "../io/importApply.js";

import { createWorkspaceState } from "./workspaceState.js";
import { makeThreeViewer } from "../view/threeViewer.js";

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------
function clampNumber(value, min, max) {
	const v = Number(value);
	if (!Number.isFinite(v)) return min;
	return Math.max(min, Math.min(max, v));
}

function formatNum(v, digits = 3) {
	return Number.isFinite(v) ? v.toFixed(digits) : "—";
}

function computeChainage(polyline2d) {
	// cumulative length per vertex
	if (!Array.isArray(polyline2d) || polyline2d.length < 2) return null;

	const cum = new Array(polyline2d.length);
	cum[0] = 0;

	for (let i = 1; i < polyline2d.length; i++) {
		const a = polyline2d[i - 1];
		const b = polyline2d[i];
		cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y);
	}
	return cum;
}

function samplePointAndTangent(polyline2d, cum, s) {
	// s in meters along polyline
	if (!cum || !Array.isArray(polyline2d) || polyline2d.length < 2) return null;

	const total = cum[cum.length - 1];
	const ss = clampNumber(s, 0, total);

	// find segment
	let i = 1;
	while (i < cum.length && cum[i] < ss) i++;
	if (i >= cum.length) i = cum.length - 1;

	const s0 = cum[i - 1];
	const s1 = cum[i];
	const a = polyline2d[i - 1];
	const b = polyline2d[i];

	const ds = (s1 - s0) || 1e-9;
	const tt = (ss - s0) / ds;

	const x = a.x + tt * (b.x - a.x);
	const y = a.y + tt * (b.y - a.y);

	let tx = (b.x - a.x);
	let ty = (b.y - a.y);
	const len = Math.hypot(tx, ty) || 1e-9;
	tx /= len; ty /= len;

	return { x, y, tx, ty, s: ss, total };
}

function makeSectionLine(sample, halfWidth = 20) {
	// normal is (-ty, tx)
	const nx = -sample.ty;
	const ny = sample.tx;
	return {
		p0: { x: sample.x - nx * halfWidth, y: sample.y - ny * halfWidth, z: 0 },
		p1: { x: sample.x + nx * halfWidth, y: sample.y + ny * halfWidth, z: 0 },
	};
}

function renderBandsText(state) {
	const profile = state.import_profile1d;
	const cant = state.import_cant1d;

	const lines = [];
	lines.push(`(Bands) cursor.s=${formatNum(state.cursor?.s ?? 0, 1)} m`);

	// z(s)
	if (Array.isArray(profile) && profile.length >= 2) {
		lines.push("");
		lines.push(`z(s) (Profile) pts=${profile.length}`);
		for (const p of profile.slice(0, 10)) {
			lines.push(`  s=${formatNum(p.s, 1)}  z=${formatNum(p.z, 3)}  R=${p.R ?? "—"}  T=${p.T ?? "—"}`);
		}
	} else {
		lines.push("");
		lines.push("z(s): (noch kein Profile / GRA)");
	}

	// u(s)
	if (Array.isArray(cant) && cant.length >= 2) {
		lines.push("");
		lines.push(`u(s) (Cant/Überhöhung) pts=${cant.length}`);
		for (const p of cant.slice(0, 10)) {
			lines.push(`  s=${formatNum(p.s, 1)}  u=${formatNum(p.u, 4)} m`);
		}
	} else {
		lines.push("");
		lines.push("u(s): (noch keine Überhöhung / Cant)");
	}

	return lines.join("\n");
}

function renderSectionText(state, sectionInfo) {
	const s = state.cursor?.s ?? 0;

	const lines = [];
	lines.push(`(Section) at cursor.s=${formatNum(s, 1)} m`);
	lines.push("");

	if (!sectionInfo) {
		lines.push("No alignment sampling yet.");
		return lines.join("\n");
	}

	lines.push(`sample: x=${formatNum(sectionInfo.x, 3)} y=${formatNum(sectionInfo.y, 3)}`);
	lines.push(`tangent: tx=${formatNum(sectionInfo.tx, 4)} ty=${formatNum(sectionInfo.ty, 4)}`);
	lines.push(`chainage: s=${formatNum(sectionInfo.s, 2)} / total=${formatNum(sectionInfo.total, 2)}`);
	lines.push("");
	lines.push("Querprofil: später (Terrain/Objekte/Lichtraum etc.).");

	return lines.join("\n");
}

// ------------------------------------------------------------
// module core
// ------------------------------------------------------------
export async function bootApp() {
	if (window.__ufAIM_booted) return;
	window.__ufAIM_booted = true;

	const store = createWorkspaceState();
	if (location.hostname === "localhost") window.__ufAIM_store = store;

	const logElement = document.getElementById("log");
	const statusElement = document.getElementById("status");
	const propsElement = document.getElementById("props");

	const logLine = (line) => {
		if (logElement) logElement.textContent += String(line) + "\n";
	};

	// boot status
	if (statusElement) statusElement.textContent = t("booting");
	logLine(t("boot_start"));

	// UI wiring (DOM + listeners)
	const ui = wireUI({ logElement, statusElement });
	ui.setStatus(t("boot_ok"));
	logLine(t("boot_ready"));

	// 3D master view
	const canvas = document.getElementById("view3d");
	if (!canvas) throw new Error("Missing <canvas id='view3d'>");

	const three = makeThreeViewer({ canvas });
	three.start?.();

	// Import session
	const importSession = makeImportSession();

	// ------------------------------------------------------------
	// Cursor controls (UI owns listeners, appCore supplies callback)
	// ------------------------------------------------------------
	function setCursorS(nextS) {
		store.actions?.setCursor?.({ s: Number(nextS) || 0 });
		ui.setCursorSInputValue(nextS);
	}

	ui.wireCursorControls({
		onSetCursorS: setCursorS,
		onNudgeMinus: () => setCursorS((store.getState().cursor?.s ?? 0) - 10),
		onNudgePlus: () => setCursorS((store.getState().cursor?.s ?? 0) + 10),
	});

	// ------------------------------------------------------------
	// RP select wiring (UI owns listeners, appCore supplies callback)
	// ------------------------------------------------------------
	function activateRouteProject(baseId) {
		store.setState({
			activeRouteProjectId: baseId || null,
			import_meta: null, // optional: meta “selection”
		});
	}

	ui.wireRouteProjectSelect({
		onChange: (baseId) => {
			activateRouteProject(baseId);
			// 1x spiegeln reicht
			mirrorQuickHooksFromActive(store);
		},
	});
	
	ui.wireSlotSelect?.({
		onChange: (slot) => {
			store.actions?.setActiveSlot?.(slot);
			mirrorQuickHooksFromActive(store);
		},
	});

	// Default slot (optional)
	store.actions?.setActiveSlot?.("right");
	ui.setSlotSelectValue?.("right");
	mirrorQuickHooksFromActive(store); // optional: initial sync

	// ------------------------------------------------------------
	// Drag & Drop import
	// ------------------------------------------------------------
	installFileDrop({
		element: document.documentElement,
		onFiles: async (files) => {
			for (const file of files) {
				logLine(`drop: ${file.name}`);

				try {
					const imported = await importFileAuto(file);
					logLine(`kind=${imported.kind}`);

					const ingest = importSession.ingest(imported);

					// NOTE: current importApply signature (your stable one):
					const effects = applyImportToProject({
						store,
						baseId: ingest.baseId,
						slot: ingest.slot,
						source: ingest.source,
						artifacts: ingest.artifacts,
						ui,
					});

					for (const e of effects) {
						if (e.type === "log") logLine(e.message);
						if (e.type === "props") ui.logInfo(JSON.stringify(e.object));
					}

					// When a new RP appears, ensure RP select isn't stuck on "(none)"
					const st = store.getState();
					if (!st.activeRouteProjectId) {
						const keys = Object.keys(st.routeProjects ?? {});
						if (keys.length === 1) activateRouteProject(keys[0]);
					}
				} catch (err) {
					logLine(`❌ import failed: ${file.name}`);
					logLine(String(err));
					ui.setStatusError();
				}
			}
		},
	});

	// ------------------------------------------------------------
	// Store → UI + 3D
	// ------------------------------------------------------------
	let cachedCum = null;

	store.subscribe((state) => {
		// 0) keep RP select up to date
		const ids = Object.keys(state.routeProjects ?? {}).sort((a, b) => a.localeCompare(b));
		ui.setRouteProjectOptions(ids, state.activeRouteProjectId);

		// 1) props (debug)
		if (propsElement) {
			propsElement.textContent = JSON.stringify(
			{
				activeRouteProjectId: state.activeRouteProjectId ?? null,
				cursor: state.cursor ?? {},
				import_meta: state.import_meta ?? null,

				hasAlignment: Array.isArray(state.import_polyline2d) && state.import_polyline2d.length >= 2,
				hasProfile: Array.isArray(state.import_profile1d) && state.import_profile1d.length >= 2,
				hasCant: Array.isArray(state.import_cant1d) && state.import_cant1d.length >= 2,
			},
			null,
			2
			);
		}

		// 2) bands overlay
		ui.setBoardBandsText(renderBandsText(state));

		// 3) section overlay + 3D debug
		const polyline2d = state.import_polyline2d;

		let sectionInfo = null;
		if (Array.isArray(polyline2d) && polyline2d.length >= 2) {
			if (!cachedCum || cachedCum.length !== polyline2d.length) {
				cachedCum = computeChainage(polyline2d);
			}

			const cursorS = Number(state.cursor?.s ?? 0);
			sectionInfo = samplePointAndTangent(polyline2d, cachedCum, cursorS);

			if (sectionInfo) {
				three.setMarker?.({ x: sectionInfo.x, y: sectionInfo.y, z: 0, s: sectionInfo.s });
				const line = makeSectionLine(sectionInfo, 30);
				three.setSectionLine?.(line.p0, line.p1);
			}
		}

		ui.setBoardSectionText(renderSectionText(state, sectionInfo));

		// 4) 3D: alignment render
		if (Array.isArray(polyline2d) && polyline2d.length >= 2) {
			const pts3 = polyline2d.map((p) => ({ x: p.x, y: p.y, z: 0 }));
			three.setTrackPoints?.(pts3);
		}
	}, { immediate: true });

	return ui;
}
