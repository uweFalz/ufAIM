// app/main.js

import { makeThreeViewer } from "./threeViewer.js";
import { createStore } from "./viewSync.js";
import { clamp01, curvature } from "./transitionModel.js";
import { sampleAlignment, evalAtStation } from "./transitionEmbed.js";
import { makeTransitionEditorView } from "./transitionEditorView.js";
import { makeAlignmentBandView } from "./alignmentBandView.js";

// ---------- DOM ----------
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const propsEl = document.getElementById("props");

const sEl = document.getElementById("s");
const sValEl = document.getElementById("sVal");
const uValEl = document.getElementById("uVal");

const LEl = document.getElementById("L");
const LValEl = document.getElementById("LVal");

const REl = document.getElementById("R");
const RValEl = document.getElementById("RVal");

const btnReset = document.getElementById("btnReset");
const canvas = document.getElementById("view3d");

// 3×3 panel (status readout)
const k0ValEl = document.getElementById("k0Val");
const k1ValEl = document.getElementById("k1Val");
const kappaValEl = document.getElementById("kappaVal");
const LShowEl = document.getElementById("LShow");
const RShowEl = document.getElementById("RShow");
const familySelEl = document.getElementById("familySel"); // TODO: wire to model families later

// Transition overlay
const btnTransEl = document.getElementById("btnTrans");
const overlayEl = document.getElementById("transOverlay");
const btnTransCloseEl = document.getElementById("btnTransClose");

const w1El = document.getElementById("w1");
const w2El = document.getElementById("w2");
const w1ValEl = document.getElementById("w1Val");
const w2ValEl = document.getElementById("w2Val");
const presetEl = document.getElementById("preset");

const plotKEl = document.getElementById("plotK");
const plotK1El = document.getElementById("plotK1");
const plotK2El = document.getElementById("plotK2");

// ---------- helpers ----------
function setStatus(s) {
	statusEl.textContent = s;
}
function log(msg) {
	logEl.textContent = (logEl.textContent ? logEl.textContent + "\n" : "") + msg;
}
function showProps(obj) {
	propsEl.textContent = Object.entries(obj)
	.map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(6) : v}`)
	.join("\n");
}

// ---------- STORE (single source of truth) ----------
const store = createStore({
	// Transition overlay state
	te_visible: false,
	te_w1: 0.0,
	te_w2: 1.0,
	te_preset: "clothoid",
	te_plot: "k", // "k" | "k1" | "k2"

	// Embedded transition demo state
	u: 0.25,     // normalized position in transition (editor language)
	s_abs: null, // if set: viewer language dominates (world station in meters)
	L: 120,      // embedding length (m)
	R: 800,      // embedding radius (m)

	// reserved for future “shape family params” (no UI control right now)
	w: 0.18,

	// embed extras (demo track = lead + transition + arc)
	lead: 60,
	arcLen: 220,

	// future 4D
	slope: 0.0
});

// ---------- Transition overlay UI helpers ----------
function applyTransUI(st) {
	if (!w1El) return;
	w1El.value = String(Math.round(st.te_w1 * 1000));
	w2El.value = String(Math.round(st.te_w2 * 1000));
	w1ValEl.textContent = st.te_w1.toFixed(3);
	w2ValEl.textContent = st.te_w2.toFixed(3);
	presetEl.value = st.te_preset;
}

function setPreset(p) {
	if (p === "clothoid") store.setState({ te_preset: p, te_w1: 0.0, te_w2: 1.0 });
	if (p === "bloss")    store.setState({ te_preset: p, te_w1: 0.5, te_w2: 0.5 });
	if (p === "berlin")   store.setState({ te_preset: p, te_w1: 0.18, te_w2: 0.82 });
}

// ---------- TransitionEditorView (overlay) ----------
const teView = makeTransitionEditorView(store);
let teInited = false;

// ---------- 3D viewer (separate module) ----------
const three = makeThreeViewer({ canvas });
window.addEventListener("resize", () => three.resize());

// Hook: marker click -> props snapshot
three.onMarkerClick(() => {
	const st = store.getState();
	showProps({ type: "marker click", u: clamp01(st.u), note: "selection confirmed" });
});

// ---------- 2D alignment band view ----------
let bandView = null;
let latestSample = null;

async function init2D() {
	bandView = makeAlignmentBandView(store);
	await bandView.init("board2d");
}

function update2D() {
	if (bandView) bandView.update();
}

// ---------- compute/update pipeline ----------
function computeSample(st) {
	const k0 = 0;
	const k1 = 1 / Math.max(1e-9, st.R);

	const sample = sampleAlignment({
		L: st.L,
		k0, k1,
		lead: st.lead,
		arcLen: st.arcLen,
		ds: 1.5
	});

	return { sample, k0, k1 };
}

function stationFromState(sample, st) {
	const u = clamp01(st.u);
	if (st.s_abs == null) {
		return sample.lead + u * st.L;
	}
	return st.s_abs;
}

function uFromStation(sample, st, station) {
	return clamp01((station - sample.lead) / Math.max(1e-9, st.L));
}

function applyStateToUI(st) {
	// L/R sliders
	LEl.value = String(st.L);
	LValEl.textContent = String(st.L);

	REl.value = String(st.R);
	RValEl.textContent = String(st.R);

	// Footer uses s (viewer language)
	if (sEl && latestSample) {
		const total = Math.max(1, latestSample.totalLen || 1);
		sEl.min = "0";
		sEl.max = String(Math.round(total));

		const station = stationFromState(latestSample, st);
		sEl.value = String(Math.round(station));

		sValEl.textContent = `s≈ ${Math.round(station)} m`;
		uValEl.textContent = `u≈ ${clamp01(st.u).toFixed(3)}`;
	}
}

function applyStateToViews(st) {
	const { sample, k0, k1 } = computeSample(st);
	latestSample = sample;

	// update 3D track
	three.setTrackFromXY(sample.pts);

	// station in world space (viewer language)
	const station = stationFromState(sample, st);
	const u_eff = uFromStation(sample, st, station);

	// IMPORTANT: keep store.u synchronized when s_abs dominates,
	// so the TransitionEditor cursor follows the viewer slider.
	if (st.s_abs != null && Math.abs(st.u - u_eff) > 1e-6) {
		store.setState({ u: u_eff });
	}

	// keep UI label in sync (even if s_abs dominates)
	if (sValEl) sValEl.textContent = `s≈ ${Math.round(station)} m`;
	if (uValEl) uValEl.textContent = `u≈ ${u_eff.toFixed(3)}`;

	// embedded evaluation
	const ev = evalAtStation(sample, station);
	three.setMarker(ev.x, ev.y, 0);

	// expose for 2D band view (read-only bridge)
	window.__ufAIM_latestSample = latestSample;
	window.__ufAIM_marker = three.getMarkerXY();

	// physical curvature at u_eff (for readout)
	const params = { w: st.w };
	const k_phys = curvature(u_eff, { k0, k1, params });
	const kappa_norm = (k_phys - k0) / (k1 - k0);

	// update 3×3 readout
	k0ValEl.textContent = k0.toFixed(6) + " 1/m";
	k1ValEl.textContent = k1.toFixed(6) + " 1/m";
	kappaValEl.textContent = kappa_norm.toFixed(6);
	LShowEl.textContent = `${st.L} m`;
	RShowEl.textContent = `${st.R} m`;

	showProps({
		type: "transition (embedded demo)",
		station_m: station,
		u: u_eff,
		kappa_u: kappa_norm,
		k0_1_per_m: k0,
		k1_1_per_m: k1,
		k_u_1_per_m: k_phys,
		L_m: st.L,
		R_m: st.R,
		x: ev.x, y: ev.y,
		heading_rad: ev.yaw
	});

	update2D();
}

// ---------- UI events ----------
sEl.addEventListener("input", () => {
	store.setState({ s_abs: Number(sEl.value) });
});

LEl.addEventListener("input", () => {
	// When L changes, fixed station becomes ambiguous -> let u dominate again
	store.setState({ L: Number(LEl.value), s_abs: null });
});

REl.addEventListener("input", () => {
	store.setState({ R: Number(REl.value), s_abs: null });
});

btnReset.addEventListener("click", () => {
	store.setState({ u: 0.25, s_abs: null, L: 120, R: 800 });
	log("reset: s/u/L/R");
});

function syncPlotRadios(st) {
	if (!plotKEl) return;
	plotKEl.checked  = (st.te_plot === "k");
	plotK1El.checked = (st.te_plot === "k1");
	plotK2El.checked = (st.te_plot === "k2");
}

plotKEl?.addEventListener("change", () => plotKEl.checked && store.setState({ te_plot: "k" }));
plotK1El?.addEventListener("change", () => plotK1El.checked && store.setState({ te_plot: "k1" }));
plotK2El?.addEventListener("change", () => plotK2El.checked && store.setState({ te_plot: "k2" }));

// Transition overlay events
btnTransEl.addEventListener("click", () => {
	const st = store.getState();
	store.setState({ te_visible: !st.te_visible });
});
btnTransCloseEl.addEventListener("click", () => store.setState({ te_visible: false }));

w1El.addEventListener("input", () => store.setState({ te_w1: Number(w1El.value) / 1000 }));
w2El.addEventListener("input", () => store.setState({ te_w2: Number(w2El.value) / 1000 }));
presetEl.addEventListener("change", () => setPreset(presetEl.value));

if (familySelEl) {
	familySelEl.addEventListener("change", () => {
		log("family: " + familySelEl.value + " (v0 only)");
		showProps({ type: "family change", value: familySelEl.value });
	});
}

// ---------- main subscription ----------
store.subscribe((st) => {
	applyStateToUI(st);
	applyStateToViews(st);

	// Transition Editor overlay
	overlayEl.classList.toggle("hidden", !st.te_visible);
	applyTransUI(st);
	
	syncPlotRadios(st);

	if (st.te_visible && !teInited) {
		teInited = true;
		teView.init()
		.then(() => log("TransEditor ready"))
		.catch(e => log("TransEditor failed: " + String(e)));
	}
});

// ---------- boot ----------
three.resize();
setStatus("ready ✅");
log("Kapselung aktiv: model (norm) + embed (meter) + sync (store)");

init2D()
.then(() => log("2D ready"))
.catch(e => log("2D failed: " + String(e)));

setPreset("clothoid"); // initial preset for overlay
three.start();
