// app/core/uiWiring.js

// import { setupFileDrop } from "../io/fileDrop.js";
import { installFileDrop } from "../io/fileDrop.js";

import { t } from "../i18n/strings.js";

export function wireUI({ logElement, statusElement }) {
	const elements = {
		log: logElement ?? document.getElementById("log"),
		status: statusElement ?? document.getElementById("status"),
		dropZone: document.getElementById("dropZone"),
	};

	if (elements.log) elements.log.textContent += `${t("boot_ui")} \n`;

	// Drop-Zone robust initialisieren
	try {
		installFileDrop({
			element: elements.dropZone ?? document.body,
			onFiles: (files) => {
				if (elements.log) elements.log.textContent += `files: ${files.length}\n`;
			},
		});
	} catch (error) {
		if (elements.log) elements.log.textContent += `${t("drop_files")}: ${files.length}\n`;
	}

	if (elements.status) elements.status.textContent = t("boot_ui_ok");

	return { elements };
}










/*


import { clamp01 } from "../transitionModel.js";
import { getStrings } from "../i18n/strings.js";

export function wireUI(stateStore, hooks = {}) {
const t = getStrings("de");

const elements = {
status: document.getElementById("status"),
log: document.getElementById("log"),
props: document.getElementById("props"),

stationSlider: document.getElementById("s"),
uSlider: document.getElementById("u"),
uValue: document.getElementById("uVal"),
stationValue: document.getElementById("sVal"),

lengthSlider: document.getElementById("L"),
lengthValue: document.getElementById("LVal"),

radiusSlider: document.getElementById("R"),
radiusValue: document.getElementById("RVal"),

resetButton: document.getElementById("btnReset"),

// overlay
transitionButton: document.getElementById("btnTrans"),
transitionCloseButton: document.getElementById("btnTransClose"),
transitionOverlay: document.getElementById("transOverlay"),

w1Slider: document.getElementById("w1"),
w2Slider: document.getElementById("w2"),
w1Value: document.getElementById("w1Val"),
w2Value: document.getElementById("w2Val"),
presetSelect: document.getElementById("preset"),

// readout
k0Value: document.getElementById("k0Val"),
k1Value: document.getElementById("k1Val"),
kappaValue: document.getElementById("kappaVal"),
LShow: document.getElementById("LShow"),
RShow: document.getElementById("RShow"),

familySelect: document.getElementById("familySel"),

// IO
saveButton: document.getElementById("btnSave"),
exportButton: document.getElementById("btnExport"),
importButton: document.getElementById("btnImport"),
importFileInput: document.getElementById("fileImport"),
};

function setStatus(text) {
if (elements.status) elements.status.textContent = text;
}

function log(message) {
if (!elements.log) return;
elements.log.textContent = (elements.log.textContent ? elements.log.textContent + "\n" : "") + message;
}

function showProps(object) {
if (!elements.props) return;
elements.props.textContent = Object.entries(object)
.map(([key, value]) => `${key}: ${typeof value === "number" ? value.toFixed(6) : value}`)
.join("\n");
}

// sliders → store
elements.stationSlider?.addEventListener("input", () => stateStore.setState({ s: Number(elements.stationSlider.value) }));
elements.uSlider?.addEventListener("input", () => stateStore.setState({ u: Number(elements.uSlider.value) / 1000 }));
elements.lengthSlider?.addEventListener("input", () => stateStore.setState({ L: Number(elements.lengthSlider.value) }));
elements.radiusSlider?.addEventListener("input", () => stateStore.setState({ R: Number(elements.radiusSlider.value) }));

// reset
elements.resetButton?.addEventListener("click", () => {
stateStore.setState({ s: 90, L: 120, R: 800 });
log(t.logReset);
});

// overlay toggle
elements.transitionButton?.addEventListener("click", async () => {
const state = stateStore.getState();
const next = !state.te_visible;
stateStore.setState({ te_visible: next });
if (hooks.onToggleTransEditor) await hooks.onToggleTransEditor(next);
});
elements.transitionCloseButton?.addEventListener("click", () => stateStore.setState({ te_visible: false }));

// overlay sliders
elements.w1Slider?.addEventListener("input", () => stateStore.setState({ te_w1: Number(elements.w1Slider.value) / 1000 }));
elements.w2Slider?.addEventListener("input", () => stateStore.setState({ te_w2: Number(elements.w2Slider.value) / 1000 }));

// preset -> w1/w2
function applyPreset(preset) {
if (preset === "clothoid") stateStore.setState({ te_w1: 0.0, te_w2: 1.0 });
if (preset === "bloss") stateStore.setState({ te_w1: 0.5, te_w2: 0.5 });
if (preset === "berlin") stateStore.setState({ te_w1: 0.18, te_w2: 0.82 });
}
elements.presetSelect?.addEventListener("change", () => applyPreset(elements.presetSelect.value));

// family select
elements.familySelect?.addEventListener("change", () => {
stateStore.setState({ te_family: elements.familySelect.value });
log("family: " + elements.familySelect.value);
});

// IO: Save/Export/Import
elements.saveButton?.addEventListener("click", () => { hooks.onSave?.(); log(t.logSaveLocal); });
elements.exportButton?.addEventListener("click", () => { hooks.onExport?.(); log(t.logExportFile); });

elements.importButton?.addEventListener("click", () => elements.importFileInput?.click());

// IMPORTANT: allow non-JSON imports via hooks.onImportFile(file)
elements.importFileInput?.addEventListener("change", async () => {
const file = elements.importFileInput.files?.[0];
if (!file) return;

try {
if (hooks.onImportFile) {
const handled = await hooks.onImportFile(file);
if (handled) {
log(`${t.logImportOk} ${file.name}`);
return;
}
}

const text = await file.text();
const projectObject = JSON.parse(text);
hooks.onProjectLoaded?.(projectObject);
log(`${t.logImportOk} ${file.name}`);
} catch (error) {
log(`${t.logImportFailed} ${String(error)}`);
} finally {
elements.importFileInput.value = "";
}
});

function toast({ text, level = "info", ms = 2500 }) {
const host = document.getElementById("toasts");
if (!host) {
log(`🔔 ${level}: ${text}`);
return;
}

const toastElement = document.createElement("div");
toastElement.className = "toast";
toastElement.dataset.level = level;
toastElement.textContent = text;

host.appendChild(toastElement);
setTimeout(() => toastElement.remove(), ms);
}

setStatus(t.statusReady);

return {
hooks,
log,
setStatus,
showProps,
updateReadouts({ state, marker, readout }) {
const u = clamp01((state.s - state.lead) / Math.max(1e-9, state.L));

if (elements.stationValue) elements.stationValue.textContent = `s≈ ${Math.round(state.s)} m`;
if (elements.uValue) elements.uValue.textContent = `u=${u.toFixed(3)}`;

if (elements.stationSlider) elements.stationSlider.value = String(Math.round(state.s));
if (elements.lengthValue) elements.lengthValue.textContent = String(state.L);
if (elements.radiusValue) elements.radiusValue.textContent = String(state.R);

if (elements.k0Value) elements.k0Value.textContent = (readout.k0 ?? 0).toFixed(6) + " 1/m";
if (elements.k1Value) elements.k1Value.textContent = (readout.k1 ?? 0).toFixed(6) + " 1/m";
if (elements.kappaValue) elements.kappaValue.textContent = (readout.kappaNorm ?? 0).toFixed(6);
if (elements.LShow) elements.LShow.textContent = `${state.L} m`;
if (elements.RShow) elements.RShow.textContent = `${state.R} m`;

if (elements.transitionOverlay) {
elements.transitionOverlay.classList.toggle("hidden", !state.te_visible);
}

if (elements.w1Slider) elements.w1Slider.value = String(Math.round((state.te_w1 ?? 0) * 1000));
if (elements.w2Slider) elements.w2Slider.value = String(Math.round((state.te_w2 ?? 1) * 1000));
if (elements.w1Value) elements.w1Value.textContent = (state.te_w1 ?? 0).toFixed(3);
if (elements.w2Value) elements.w2Value.textContent = (state.te_w2 ?? 1).toFixed(3);
},
toast,
elements,
};
}

*/
