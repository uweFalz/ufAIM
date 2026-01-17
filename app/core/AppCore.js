// app/core/appCore.js
//
// ufAIM sandbox boot
// - Store (workspaceState) as SPOT for UI state
// - Import (TRA/GRA) via importSession + applyImportToProject
// - ThreeView is master view (3D)
// - Overlays are "read-only text docks" for now (Bands / Section)
//
// QuickHooks mode (stable freeze):
// - applyImportToProject writes to store.import_* (import_polyline2d, import_profile1d, import_cant1d, import_meta)
// - appCore mirrors those quickhooks into routeProjects[baseId].hooks for later re-activation via RP select
// - switching RP restores quickhooks into store.import_* (cheap + robust)

import { wireUI } from "./uiWiring.js";
import { t } from "../i18n/strings.js";

import { installFileDrop } from "../io/fileDrop.js";
import { importFileAuto } from "../io/importTRA_GRA.js";
import { makeImportSession } from "../io/importSession.js";
import { applyImportToProject } from "../io/importApply.js";

import { createWorkspaceState } from "./workspaceState.js";
import { makeThreeViewer } from "../view/threeViewer.js";

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------
function clampNumber(value, min, max) {
	const v = Number(value);
	if (!Number.isFinite(v)) return min;
	return Math.max(min, Math.min(max, v));
}

function formatNum(v, digits = 3) {
	return Number.isFinite(v) ? v.toFixed(digits) : "—";
}

function nowIso() {
	return new Date().toISOString();
}

// cumulative chainage along polyline vertices: [0, ..., total]
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

// sample point + tangent at chainage s (m)
function samplePointAndTangent(polyline2d, cum, s) {
	if (!cum || !Array.isArray(polyline2d) || polyline2d.length < 2) return null;

	const total = cum[cum.length - 1];
	const ss = clampNumber(s, 0, total);

	// find segment containing ss
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
	tx /= len;
	ty /= len;

	return { x, y, tx, ty, s: ss, total };
}

// debug section line (perpendicular)
function makeSectionLine(sample, halfWidth = 20) {
	const nx = -sample.ty;
	const ny = sample.tx;
	return {
		p0: { x: sample.x - nx * halfWidth, y: sample.y - ny * halfWidth, z: 0 },
		p1: { x: sample.x + nx * halfWidth, y: sample.y + ny * halfWidth, z: 0 },
	};
}

// -----------------------------------------------------------------------------
// Overlay renderers (text only, no plotting yet)
// -----------------------------------------------------------------------------
function renderBandsText(profile1d, cant1d, cursorS) {
	const lines = [];
	lines.push(`(Bands) cursor.s=${formatNum(cursorS ?? 0, 1)} m`);

	// z(s)
	if (Array.isArray(profile1d) && profile1d.length >= 2) {
		lines.push("");
		lines.push(`z(s) (Profile) pts=${profile1d.length}`);
		for (const p of profile1d.slice(0, 10)) {
			lines.push(
				`  s=${formatNum(p.s, 1)}  z=${formatNum(p.z, 3)}  R=${p.R ?? "—"}  T=${p.T ?? "—"}`
			);
		}
	} else {
		lines.push("");
		lines.push("z(s): (noch kein Profile / GRA)");
	}

	// u(s)
	if (Array.isArray(cant1d) && cant1d.length >= 2) {
		lines.push("");
		lines.push(`u(s) (Cant/Überhöhung) pts=${cant1d.length}`);
		for (const p of cant1d.slice(0, 10)) {
			lines.push(`  s=${formatNum(p.s, 1)}  u=${formatNum(p.u, 4)} m`);
		}
	} else {
		lines.push("");
		lines.push("u(s): (noch keine Überhöhung / Cant)");
	}

	return lines.join("\n");
}

function renderSectionText(sectionInfo, cursorS) {
	const lines = [];
	lines.push(`(Section) at cursor.s=${formatNum(cursorS ?? 0, 1)} m`);
	lines.push("");

	if (!sectionInfo) {
		lines.push("No alignment sampling yet.");
		lines.push("Need alignment2d → then local (t,n) basis.");
		return lines.join("\n");
	}

	lines.push(`sample: x=${formatNum(sectionInfo.x, 3)} y=${formatNum(sectionInfo.y, 3)}`);
	lines.push(`tangent: tx=${formatNum(sectionInfo.tx, 4)} ty=${formatNum(sectionInfo.ty, 4)}`);
	lines.push(`chainage: s=${formatNum(sectionInfo.s, 2)} / total=${formatNum(sectionInfo.total, 2)}`);
	lines.push("");
	lines.push("Querprofil: später (Terrain/Objekte/Lichtraum etc.).");

	return lines.join("\n");
}

// -----------------------------------------------------------------------------
// QuickHooks <-> RouteProject hooks
// -----------------------------------------------------------------------------
function upsertRouteProject(prevRouteProjects, baseId) {
	const routeProjects = { ...(prevRouteProjects ?? {}) };
	const existing = routeProjects[baseId];

	if (existing) {
		routeProjects[baseId] = {
			...existing,
			updatedAt: nowIso(),
		};
		return { routeProjects, rp: routeProjects[baseId] };
	}

	const created = {
		id: baseId,
		createdAt: nowIso(),
		updatedAt: nowIso(),
		hooks: {
			meta: null,
			polyline2d: null,
			marker2d: null,
			profile1d: null,
			cant1d: null,
		},
		// slots/artifacts registry later – for now we only freeze UI-level hooks here
		slots: { right: {}, left: {}, km: {} },
	};

	routeProjects[baseId] = created;
	return { routeProjects, rp: created };
}

function restoreHooksIntoQuickState(baseId, rp) {
	if (!baseId || !rp) {
		return {
			activeRouteProjectId: null,
			import_meta: null,
			import_polyline2d: null,
			import_marker2d: null,
			import_profile1d: null,
			import_cant1d: null,
		};
	}

	return {
		activeRouteProjectId: baseId,
		import_meta: rp.hooks?.meta ?? null,
		import_polyline2d: rp.hooks?.polyline2d ?? null,
		import_marker2d: rp.hooks?.marker2d ?? null,
		import_profile1d: rp.hooks?.profile1d ?? null,
		import_cant1d: rp.hooks?.cant1d ?? null,
	};
}

// -----------------------------------------------------------------------------
// Boot
// -----------------------------------------------------------------------------
export async function bootApp() {
	// prevent double boot (sw-nocache/dev reloads etc.)
	if (window.__ufAIM_booted) return;
	window.__ufAIM_booted = true;

	const store = createWorkspaceState();
	if (location.hostname === "localhost") window.__ufAIM_store = store;

	// DOM basics (still OK here: just grabbing elements once)
	const logElement = document.getElementById("log");
	const statusElement = document.getElementById("status");
	const propsElement = document.getElementById("props");

	const logLine = (line) => {
		if (logElement) logElement.textContent += String(line) + "\n";
	};

	// boot status
	if (statusElement) statusElement.textContent = t("booting");
	logLine(t("boot_start"));

	// UI wiring (owns ALL addEventListener)
	const ui = wireUI({ logElement, statusElement });
	ui.setStatus(t("boot_ok"));
	logLine(t("boot_ready"));

	// 3D master view
	const canvas = document.getElementById("view3d");
	if (!canvas) throw new Error("Missing <canvas id='view3d'>");
	const three = makeThreeViewer({ canvas });
	three.start?.();

	// Import session (pairs TRA+GRA by base name)
	const importSession = makeImportSession();

	// -------------------------------------------------------------------------
	// UI callbacks -> Store
	// -------------------------------------------------------------------------
	function setCursorS(nextS) {
		store.actions?.setCursor?.({ s: Number(nextS) || 0 });
		ui.setCursorSInputValue?.(nextS);
	}

	ui.wireCursorControls({
		onSetS: (v) => setCursorS(v),
		onStep: (delta) => setCursorS((store.getState().cursor?.s ?? 0) + Number(delta || 0)),
	});

	ui.wireRouteProjectSelect({
		onChange: (baseId) => {
			store.setState((prev) => {
				if (!baseId) return restoreHooksIntoQuickState(null, null);
				const rp = prev.routeProjects?.[baseId] ?? null;
				if (!rp) return { activeRouteProjectId: baseId };
				return restoreHooksIntoQuickState(baseId, rp);
			});
		},
	});

	// -------------------------------------------------------------------------
	// Drag & Drop import (live)
	// -------------------------------------------------------------------------
	installFileDrop({
		element: document.documentElement,
		onFiles: async (files) => {
			for (const file of files) {
				logLine(`drop: ${file.name}`);
				try {
					const imported = await importFileAuto(file);
					logLine(`kind=${imported.kind}`);

					const ingest = importSession.ingest(imported);

					// minimal apply (writes import_* quickhooks + import_meta)
					const effects = applyImportToProject({
						store,
						imp: ingest.imp,
						draft: ingest.draft,
						slot: ingest.slot,
						ui,
					});

					for (const e of effects) {
						if (e.type === "log") logLine(e.message);
						if (e.type === "props") ui.logInfo(JSON.stringify(e.object));
					}

					// Mirror quickhooks into RouteProject hooks (for RP select switching)
					const st = store.getState();
					const baseId = st.import_meta?.base ?? ingest.base ?? ingest.draft?.id ?? imported.name ?? null;

					if (baseId) {
						store.setState((prev) => {
							const { routeProjects } = upsertRouteProject(prev.routeProjects, baseId);
							const rp = routeProjects[baseId];

							routeProjects[baseId] = {
								...rp,
								updatedAt: nowIso(),
								hooks: {
									meta: prev.import_meta ?? null,
									polyline2d: prev.import_polyline2d ?? null,
									marker2d: prev.import_marker2d ?? null,
									profile1d: prev.import_profile1d ?? null,
									cant1d: prev.import_cant1d ?? null,
								},
							};

							// "Apple-ish": switch active RP to the last imported base
							return {
								routeProjects,
								activeRouteProjectId: baseId,
							};
						});
					}
				} catch (err) {
					logLine(`❌ import failed: ${file.name}`);
					logLine(String(err));
					ui.setStatusError();
				}
			}
		},
	});

	// -------------------------------------------------------------------------
	// Store -> UI + 3D (read-only)
	// -------------------------------------------------------------------------
	let cachedCum = null;
	let cachedPolyRef = null;

	function renderFromState(state) {
		// RP select options
		const ids = Object.keys(state.routeProjects ?? {}).sort((a, b) => a.localeCompare(b));
		ui.setRouteProjectOptions(ids, state.activeRouteProjectId);

		// Props (small + useful)
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

		const cursorS = Number(state.cursor?.s ?? 0);

		// Bands overlay (z(s), u(s), later k(s), v(s), ...)
		ui.setBoardBandsText(
			renderBandsText(state.import_profile1d, state.import_cant1d, cursorS)
		);

		// Section overlay + 3D debug marker/line
		const polyline2d = state.import_polyline2d;
		let sectionInfo = null;

		if (Array.isArray(polyline2d) && polyline2d.length >= 2) {
			// chainage cache (invalidate when polyline ref changes)
			if (cachedPolyRef !== polyline2d) {
				cachedPolyRef = polyline2d;
				cachedCum = computeChainage(polyline2d);
			}

			sectionInfo = samplePointAndTangent(polyline2d, cachedCum, cursorS);

			if (sectionInfo) {
				three.setMarker?.({ x: sectionInfo.x, y: sectionInfo.y, z: 0, s: sectionInfo.s });

				const line = makeSectionLine(sectionInfo, 30);
				three.setSectionLine?.(line.p0, line.p1);
			}

			// 3D track
			const pts3 = polyline2d.map((p) => ({ x: p.x, y: p.y, z: 0 }));
			three.setTrackPoints?.(pts3);
		}

		ui.setBoardSectionText(
			renderSectionText(sectionInfo, cursorS)
		);
	}

	// subscribe + initial render
	store.subscribe((s) => renderFromState(s));
	renderFromState(store.getState());

	return ui;
}
