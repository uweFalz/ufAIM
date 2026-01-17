// app/core/appCore.js

import { wireUI } from "./uiWiring.js";
import { t } from "../i18n/strings.js";

import { installFileDrop } from "../io/fileDrop.js";
import { importFileAuto } from "../io/importTRA_GRA.js";
import { makeImportSession } from "../io/importSession.js";
import { applyImportToProject } from "../io/importApply.js";

import { createWorkspaceState } from "./workspaceState.js";
import { makeThreeViewer } from "../view/threeViewer.js";

function clampNumber(value, min, max) {
	const v = Number(value);
	if (!Number.isFinite(v)) return min;
	return Math.max(min, Math.min(max, v));
}

function formatNum(v, digits = 3) {
	return Number.isFinite(v) ? v.toFixed(digits) : "—";
}

function computeChainage(polyline2d) {
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
	if (!cum || !Array.isArray(polyline2d) || polyline2d.length < 2) return null;

	const total = cum[cum.length - 1];
	const ss = clampNumber(s, 0, total);

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

// ---- RP select binding helpers ----

function updateRouteProjectSelect(selectEl, routeProjects, activeId) {
	if (!selectEl) return;

	const ids = Object.keys(routeProjects ?? {}).sort((a, b) => a.localeCompare(b));

	// keep current value if still present
	const wanted = activeId && ids.includes(activeId) ? activeId : "";

	// rebuild options (cheap; counts are small)
	selectEl.innerHTML = "";
	const none = document.createElement("option");
	none.value = "";
	none.textContent = "(none)";
	selectEl.appendChild(none);

	for (const id of ids) {
		const opt = document.createElement("option");
		opt.value = id;
		opt.textContent = id;
		selectEl.appendChild(opt);
	}

	selectEl.value = wanted;
}

export async function bootApp() {
	if (window.__ufAIM_booted) return;
	window.__ufAIM_booted = true;

	const store = createWorkspaceState();
	if (location.hostname === "localhost") window.__ufAIM_store = store;

	const logElement = document.getElementById("log");
	const statusElement = document.getElementById("status");
	const propsElement = document.getElementById("props");

	const logLine = (line) => { if (logElement) logElement.textContent += String(line) + "\n"; };

	if (statusElement) statusElement.textContent = t("booting");
	logLine(t("boot_start"));

	const ui = wireUI({ logElement, statusElement });
	ui.setStatus(t("boot_ok"));
	logLine(t("boot_ready"));

	// 3D master
	const canvas = document.getElementById("view3d");
	if (!canvas) throw new Error("Missing <canvas id='view3d'>");
	const three = makeThreeViewer({ canvas });
	three.start?.();

	const importSession = makeImportSession();

	// Cursor wiring
	function setCursorS(nextS) {
		store.actions?.setCursor?.({ s: Number(nextS) || 0 });
		ui.setCursorSInputValue(nextS);
	}
	ui.elements.cursorSInput?.addEventListener("change", () => setCursorS(ui.elements.cursorSInput.value));
	ui.elements.cursorSInput?.addEventListener("keydown", (ev) => { if (ev.key === "Enter") setCursorS(ui.elements.cursorSInput.value); });
	ui.elements.cursorMinus?.addEventListener("click", () => setCursorS((store.getState().cursor?.s ?? 0) - 10));
	ui.elements.cursorPlus?.addEventListener("click", () => setCursorS((store.getState().cursor?.s ?? 0) + 10));

	// RP select -> store
	ui.elements.routeProjectSelect?.addEventListener("change", () => {
		const id = ui.elements.routeProjectSelect.value || null;
		store.actions?.setActiveRouteProject?.(id);
	});

	// Drag & Drop import
	installFileDrop({
		element: document.documentElement,
		onFiles: async (files) => {
			for (const file of files) {
				logLine(`drop: ${file.name}`);
				try {
					const imported = await importFileAuto(file);
					logLine(`kind=${imported.kind}`);

					const ingest = importSession.ingest(imported);

					const effects = applyImportToProject({
						store,
						imp: ingest.imp,
						draft: ingest.draft,
						slot: ingest.slot,
					});

					for (const e of effects) {
						if (e.type === "log") logLine(e.message);
						if (e.type === "props") ui.logInfo(JSON.stringify(e.object));
					}

					// keep cursor in range if new alignment exists
					const st = store.getState();
					const poly = st.import_polyline2d;
					if (Array.isArray(poly) && poly.length >= 2) {
						const cum = computeChainage(poly);
						const total = cum ? cum[cum.length - 1] : 0;
						const cs = st.cursor?.s ?? 0;
						if (cs < 0 || cs > total) setCursorS(0);
					}
				} catch (err) {
					logLine(`❌ import failed: ${file.name}`);
					logLine(String(err));
					ui.setStatusError();
				}
			}
		},
	});

	// Store -> UI render
	let cachedCum = null;

	store.subscribe((state) => {
		// RP select population + keep active selection
		updateRouteProjectSelect(ui.elements.routeProjectSelect, state.routeProjects, state.activeRouteProjectId);

		// Props (debug)
		if (propsElement) {
			propsElement.textContent = JSON.stringify(
			{
				activeRouteProjectId: state.activeRouteProjectId ?? null,
				routeProjects: Object.keys(state.routeProjects ?? {}).length,
				cursor: state.cursor ?? {},
				import_meta: state.import_meta ?? null,
			},
			null,
			2
			);
		}

		// Bands overlay
		ui.setBoardBandsText(renderBandsText(state));

		// Section overlay + 3D debug
		const polyline2d = state.import_polyline2d;
		let sectionInfo = null;

		if (Array.isArray(polyline2d) && polyline2d.length >= 2) {
			if (!cachedCum || cachedCum.length !== polyline2d.length) cachedCum = computeChainage(polyline2d);

			const cs = Number(state.cursor?.s ?? 0);
			sectionInfo = samplePointAndTangent(polyline2d, cachedCum, cs);

			if (sectionInfo) {
				const line = makeSectionLine(sectionInfo, 30);
				three.setMarker?.({ x: sectionInfo.x, y: sectionInfo.y, z: 0, s: sectionInfo.s });
				three.setSectionLine?.(line.p0, line.p1);
			}

			three.setTrackPoints?.(polyline2d.map(p => ({ x: p.x, y: p.y, z: 0 })));
		}

		ui.setBoardSectionText(renderSectionText(state, sectionInfo));
	}, { immediate: true });

	return ui;
}
