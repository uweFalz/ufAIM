// app/main.js

import * as THREE from "three";
import { createStore } from "./viewSync.js";
import { clamp01, kappa, curvature, defaultBerlinParams } from "./transitionModel.js";
import { sampleAlignment, evalAtStation } from "./transitionEmbed.js";
import { makeTransitionEditorView } from "./transitionEditorView.js";

const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const propsEl = document.getElementById("props");

const uEl = document.getElementById("u");
const uValEl = document.getElementById("uVal");
const sValEl = document.getElementById("sVal");

const LEl = document.getElementById("L");
const LValEl = document.getElementById("LVal");

const REl = document.getElementById("R");
const RValEl = document.getElementById("RVal");

const btnReset = document.getElementById("btnReset");
const canvas = document.getElementById("view3d");

const k0ValEl = document.getElementById("k0Val");
const k1ValEl = document.getElementById("k1Val");
const kappaValEl = document.getElementById("kappaVal");
const LShowEl = document.getElementById("LShow");
const RShowEl = document.getElementById("RShow");
const familySelEl = document.getElementById("familySel");

const wEl = document.getElementById("w");
const wValEl = document.getElementById("wVal");

const btnTransEl = document.getElementById("btnTrans");
const overlayEl = document.getElementById("transOverlay");
const btnTransCloseEl = document.getElementById("btnTransClose");

const w1El = document.getElementById("w1");
const w2El = document.getElementById("w2");
const w1ValEl = document.getElementById("w1Val");
const w2ValEl = document.getElementById("w2Val");
const presetEl = document.getElementById("preset");

function setStatus(s) { statusEl.textContent = s; }
function log(msg) {
	logEl.textContent = (logEl.textContent ? logEl.textContent + "\n" : "") + msg;
}
function showProps(obj) {
	propsEl.textContent = Object.entries(obj)
	.map(([k,v]) => `${k}: ${typeof v === "number" ? v.toFixed(6) : v}`)
	.join("\n");
}

// --- Wait until JSXGraph is available (loaded via defer script) ---
function waitForJXG() {
	return new Promise((resolve) => {
		const tick = () => (window.JXG ? resolve(window.JXG) : requestAnimationFrame(tick));
		tick();
	});
}

// ---------- STORE (single source of truth) ----------
const store = createStore({
	te_visible: false,
	te_w1: 0.0,
	te_w2: 1.0,
	te_preset: "clothoid",
	u: 0.25,      // normalized position in transition
	L: 120,       // embedding length (m)
	R: 800,       // embedding radius (m)
	w: 0.18,
	lead: 60,
	arcLen: 220,
	slope: 0.0    // keep for later 4D (not used yet)
});

// TransitionEditorView ...
setPreset("clothoid");

const teView = makeTransitionEditorView(store);
let teInited = false;

// ---------- 3D ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e14);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
camera.position.set(0, -220, 160);
camera.lookAt(0, 0, 0);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(200, -100, 300);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
scene.add(new THREE.GridHelper(600, 30));
scene.add(new THREE.AxesHelper(120));

const trackMat = new THREE.LineBasicMaterial();
let trackLine = null;

const marker = new THREE.Mesh(
new THREE.SphereGeometry(4, 18, 12),
new THREE.MeshStandardMaterial()
);
scene.add(marker);

// raw orbit
let isDrag = false, lastX=0, lastY=0;
let yaw = 0.3, pitch = 0.55, radius = 320;
canvas.addEventListener("mousedown", (e) => { isDrag=true; lastX=e.clientX; lastY=e.clientY; });
window.addEventListener("mouseup", () => { isDrag=false; });
window.addEventListener("mousemove", (e) => {
	if(!isDrag) return;
	const dx = e.clientX - lastX;
	const dy = e.clientY - lastY;
	lastX = e.clientX; lastY = e.clientY;
	yaw += dx * 0.005;
	pitch = Math.min(1.45, Math.max(0.15, pitch + dy * 0.005));
});
canvas.addEventListener("wheel", (e) => {
	e.preventDefault();
	radius = Math.min(1200, Math.max(80, radius + e.deltaY * 0.4));
},{ passive:false });

function resize3D() {
	const rect = canvas.getBoundingClientRect();
	const w = Math.max(1, Math.floor(rect.width));
	const h = Math.max(1, Math.floor(rect.height));
	renderer.setSize(w, h, false);
	camera.aspect = w / h;
	camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize3D);

// ---------- 2D (JSXGraph) ----------
let board, centerCurve, kappaCurve, marker2d;
let latestSample = null;

async function init2D() {
	const JXG = await waitForJXG();
	board = JXG.JSXGraph.initBoard("board2d", {
		boundingbox: [-40, 200, 520, -200],
		axis: true,
		showNavigation: false,
		showCopyright: false
	});

	// centerline polyline
	const pts2d = () => (latestSample?.pts || []).map(p => [p.x, p.y]);

	centerCurve = board.create("curve", [
	() => pts2d().map(p => p[0]),
	() => pts2d().map(p => p[1])
	], { strokeWidth: 3 });

	// kappa(u) band on [0,1]x[0,1] mapped into this board area
	// Here: x=20..440, y=150..50  (simple)
	kappaCurve = board.create("curve", [
	(t) => 20 + t * 420,
	(t) => {
		const { w } = store.getState();
		return 150 - kappa(t, { w }) * 100;
	},
	0, 1
	], { strokeWidth: 2, dash: 2 });

	marker2d = board.create("point", [
	() => marker.position.x,
	() => marker.position.y
	], { name:"", size:4, fixed:true });

	board.update();
}

function update2D() {
	if(board) board.update();
}

// ---------- render/update pipeline ----------
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

function applyStateToUI(st) {
	uEl.value = String(Math.round(clamp01(st.u) * 1000));
	uValEl.textContent = clamp01(st.u).toFixed(3);

	LEl.value = String(st.L);
	LValEl.textContent = String(st.L);

	REl.value = String(st.R);
	RValEl.textContent = String(st.R);
}

function applyStateToViews(st) {
	const u = clamp01(st.u);

	const { sample, k0, k1 } = computeSample(st);
	latestSample = sample;

	// update 3D track
	const pts3 = sample.pts.map(p => new THREE.Vector3(p.x, p.y, 0));
	const geo = new THREE.BufferGeometry().setFromPoints(pts3);
	if(trackLine) {
		trackLine.geometry.dispose();
		trackLine.geometry = geo;
	} else {
		trackLine = new THREE.Line(geo, trackMat);
		scene.add(trackLine);
	}

	// station embedding: transition-only
	const station = sample.lead + u * st.L;
	sValEl.textContent = `s≈ ${Math.round(station)} m`;

	const ev = evalAtStation(sample, station);
	marker.position.set(ev.x, ev.y, 0);

	const params = { w: st.w };
	const k_phys = curvature(u, { k0, k1, params });
	const kappa_norm = (k_phys - k0) / (k1 - k0);   // should be ~u for v0

	// update editor UI
	if(k0ValEl) {
		k0ValEl.textContent = k0.toFixed(6) + " 1/m";
		k1ValEl.textContent = k1.toFixed(6) + " 1/m";
		kappaValEl.textContent = kappa_norm.toFixed(6);
		LShowEl.textContent = `${st.L} m`;
		RShowEl.textContent = `${st.R} m`;
	}
	
	showProps({
		type: "transition (normed core)",
		u,
		kappa_u: kappa_norm,
		k0_1_per_m: k0,
		k1_1_per_m: k1,
		k_u_1_per_m: k_phys,
		L_m: st.L,
		R_m: st.R,
		station_m: station,
		x: ev.x, y: ev.y,
		heading_rad: ev.yaw
	});

	update2D();
}



function applyTransUI(st){
	if(!w1El) return;
	w1El.value = String(Math.round(st.te_w1 * 1000));
	w2El.value = String(Math.round(st.te_w2 * 1000));
	w1ValEl.textContent = st.te_w1.toFixed(3);
	w2ValEl.textContent = st.te_w2.toFixed(3);
	presetEl.value = st.te_preset;
}

function setPreset(p){
	if(p === "clothoid") store.setState({ te_preset:p, te_w1:0.0, te_w2:1.0 });
	if(p === "bloss")    store.setState({ te_preset:p, te_w1:0.5, te_w2:0.5 });
	if(p === "berlin")   store.setState({ te_preset:p, te_w1:0.18, te_w2:0.82 });
}


// ---------- UI events ----------
uEl.addEventListener("input", () => {
	store.setState({ u: Number(uEl.value)/1000 });
});
LEl.addEventListener("input", () => {
	store.setState({ L: Number(LEl.value) });
});
REl.addEventListener("input", () => {
	store.setState({ R: Number(REl.value) });
});

btnReset.addEventListener("click", () => {
	store.setState({ u: 0.25, L: 120, R: 800 });
	log("reset: u/L/R");
});

// Marker click -> props snapshot
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
canvas.addEventListener("click", (e) => {
	const rect = canvas.getBoundingClientRect();
	mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
	mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

	raycaster.setFromCamera(mouse, camera);
	const hits = raycaster.intersectObject(marker);
	if(!hits.length) return;

	const st = store.getState();
	const u = clamp01(st.u);
	showProps({ type: "marker click", u, note: "selection confirmed" });
});

// ---------- main subscription ----------
store.subscribe((st) => {
	applyStateToUI(st);
	applyStateToViews(st);
	
	// Transition Editor overlay
	if (overlayEl) {
		overlayEl.classList.toggle("hidden", !st.te_visible);
		applyTransUI(st);

		if (st.te_visible && !teInited) {
			teInited = true;
			teView.init().then(()=>log("TransEditor ready")).catch(e=>log("TransEditor failed: "+String(e)));
		}
	}
});

// ---------- render loop ----------
function animate() {
	const cx = Math.cos(yaw)*Math.sin(pitch)*radius;
	const cy = Math.sin(yaw)*Math.sin(pitch)*radius;
	const cz = Math.cos(pitch)*radius;
	camera.position.set(cx, cy, cz);
	camera.lookAt(0,0,0);

	renderer.render(scene, camera);
	requestAnimationFrame(animate);
}

// ---------- boot ----------
resize3D();
setStatus("ready ✅");
log("Kapselung aktiv: model (norm) + embed (meter) + sync (store)");
init2D().then(() => log("2D ready")).catch(e => log("2D failed: "+String(e)));


btnTransEl.addEventListener("click", ()=>{
	const st = store.getState();
	store.setState({ te_visible: !st.te_visible });
});
btnTransCloseEl.addEventListener("click", ()=>{
	store.setState({ te_visible: false });
});

w1El.addEventListener("input", ()=> store.setState({ te_w1: Number(w1El.value)/1000 }));
w2El.addEventListener("input", ()=> store.setState({ te_w2: Number(w2El.value)/1000 }));
presetEl.addEventListener("change", ()=> setPreset(presetEl.value));



if(familySelEl) {
	familySelEl.addEventListener("change", () => {
		log("family: " + familySelEl.value + " (v0 only)");
		showProps({ type:"family change", value: familySelEl.value });
	});
}

animate();
