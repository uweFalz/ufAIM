// app/core/uiWiring.js
//
// UI only:
// - find elements
// - wire buttons / inputs
// - write status/log/boards
//
// deliberately NO:
// - app boot logic
// - routeProject hydration logic
// - docs overlay orchestration
//
// i18n: all UI strings via t(...)

import { t } from "@app/i18n/strings.js";
import { clamp01 } from "@src/utils/helpers.js";
import { makeSpotView } from "@app/view/overlays/spotView.js";
import { savePanelLayout } from "@app/view/shell/panelLayoutStore.js";

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------
function resolveElement(explicit, fallbackId) {
	if (explicit) return explicit;
	if (!fallbackId) return null;
	return document.getElementById(fallbackId);
}

function setText(target, text) {
	if (!target) return;
	target.textContent = String(text ?? "");
}

function toggleHiddenByClass(element, hiddenClass) {
	if (!element) return false;
	const isHidden = element.classList.toggle(hiddenClass);
	return !isHidden;
}

function setPrimary(button, isOn) {
	if (!button) return;
	button.classList.toggle("btn--primary", Boolean(isOn));
}

function show(el) {
	if (!el) return;
	el.classList.remove("hidden");
}

function hide(el) {
	if (!el) return;
	el.classList.add("hidden");
}

function markPanelHidden(panelEl, hidden) {
	if (!panelEl?.id) return;
	savePanelLayout(panelEl.id, { hidden: Boolean(hidden) });
}

// ------------------------------------------------------------
// wireUI
// ------------------------------------------------------------
export function wireUI({ logElement, statusElement, prefs } = {}) {
	const elements = {
		log: resolveElement(logElement, "log"),
		status: resolveElement(statusElement, "status"),
		props: document.getElementById("props"),

		// SPOT host
		importSession: document.getElementById("importSession"),

		// SPOT overlay
		buttonSpot: document.getElementById("btnSpot"),
		overlaySpot: document.getElementById("spotOverlay"),
		spotOverlayBody: document.getElementById("spotOverlayBody"),
		buttonSpotClose: document.getElementById("btnSpotClose"),

		// boards
		boardBands: document.getElementById("board2d"),
		boardSection: document.getElementById("boardSection"),

		// overlay toggles
		buttonBands: document.getElementById("btnToggleBands"),
		buttonSection: document.getElementById("btnToggleSection"),
		overlayBands: document.getElementById("overlayBands"),
		overlaySection: document.getElementById("overlaySection"),
		closeBands: document.getElementById("btnCloseBands"),
		closeSection: document.getElementById("btnCloseSection"),

		// import picker
		buttonImport: document.getElementById("btnImport"),
		fileImport: document.getElementById("fileImport"),

		// transition overlay
		transitionOverlay: document.getElementById("transOverlay"),
		buttonTransition: document.getElementById("btnTrans"),
		buttonTransitionClose: document.getElementById("btnTransClose"),

		// cursor controls
		cursorSInput: document.getElementById("inputCursorS"),
		cursorMinus: document.getElementById("btnCursorMinus"),
		cursorPlus: document.getElementById("btnCursorPlus"),

		// optional slot select
		slotSelect: document.getElementById("slotSelect"),

		// fit / pin
		chkAutoFit: document.getElementById("chkAutoFit"),
		buttonFit: document.getElementById("btnFit"),
		buttonPinToggle: document.getElementById("btnPinToggle"),
		buttonPinsClear: document.getElementById("btnPinsClear"),
		pinsInfo: document.getElementById("pinsInfo"),

		// transition overlay controls (transEd legacy)
		tePresetSelMain: document.getElementById("tePresetSelMain"),
		tePresetSelAlt: document.getElementById("tePresetSelAlt"),
		teW1: document.getElementById("teW1"),
		teW2: document.getElementById("teW2"),
		teW1Val: document.getElementById("teW1Val"),
		teW2Val: document.getElementById("teW2Val"),

		// transition plot controls
		tePlotK: document.getElementById("tePlotK"),
		tePlotK1: document.getElementById("tePlotK1"),
		tePlotK2: document.getElementById("tePlotK2"),
		tePlotNodes: document.querySelectorAll('input[name="tePlot"]'),
	};

	// ------------------------------------------------------------
	// SPOT view
	// ------------------------------------------------------------
	const spotView = makeSpotView({
		rootEl: elements.spotOverlayBody ?? elements.importSession,
	});

	// ------------------------------------------------------------
	// log ringbuffer
	// ------------------------------------------------------------
	const MAX_LOG_LINES = 400;
	const logBuf = [];

	function pushLog(line) {
		logBuf.push(String(line ?? ""));
		if (logBuf.length > MAX_LOG_LINES) {
			logBuf.splice(0, logBuf.length - MAX_LOG_LINES);
		}
		if (elements.log) elements.log.textContent = logBuf.join("\n") + "\n";
	}

	// ------------------------------------------------------------
	// logging + status
	// ------------------------------------------------------------
	function logLine(line) {
		pushLog(line);
	}

	function logInfo(line) {
		pushLog(`ℹ️ ${String(line ?? "")}`);
	}

	function logError(error) {
		const msg = error instanceof Error ? (error.stack || error.message) : String(error);
		pushLog(`❌ ${msg}`);
	}

	function setStatus(text) {
		setText(elements.status, text);
	}

	function setStatusOk() {
		setText(elements.status, t("status_ready"));
	}

	function setStatusBusy() {
		setText(elements.status, t("status_busy"));
	}

	function setStatusError() {
		setText(elements.status, t("status_error"));
	}

	// ------------------------------------------------------------
	// boards
	// ------------------------------------------------------------
	function setBoardBandsText(text) {
		if (!elements.boardBands) return;
		elements.boardBands.textContent = String(text ?? "");
	}

	function setBoardSectionText(text) {
		if (!elements.boardSection) return;
		elements.boardSection.textContent = String(text ?? "");
	}

	function setSelectOptions(selectEl, items, activeValue = "") {
		if (!selectEl) return;
		selectEl.innerHTML = "";
		for (const it of items ?? []) {
			const opt = document.createElement("option");
			opt.value = String(it.value ?? "");
			opt.textContent = String(it.label ?? it.value ?? "");
			selectEl.appendChild(opt);
		}
		if (activeValue != null) selectEl.value = String(activeValue);
	}

	function setSlider01(sliderEl, value01) {
		if (!sliderEl) return;
		const v = Math.round(clamp01(value01) * 1000);
		sliderEl.value = String(v);
	}

	function readSlider01(sliderEl) {
		if (!sliderEl) return 0;
		const v = Number(sliderEl.value);
		if (!Number.isFinite(v)) return 0;
		return clamp01(v / 1000);
	}

	// ------------------------------------------------------------
	// props
	// ------------------------------------------------------------
	function showProps(object) {
		if (!elements.props) return;
		try {
			elements.props.textContent = JSON.stringify(object ?? null, null, 2);
		} catch {
			elements.props.textContent = String(object);
		}
	}

	function emitProps(obj) {
		if (!elements.props) return;
		elements.props.textContent = JSON.stringify(obj ?? null, null, 2);
	}

	// ------------------------------------------------------------
	// cursor helpers
	// ------------------------------------------------------------
	function setCursorSInputValue(value) {
		if (!elements.cursorSInput) return;
		if (document.activeElement === elements.cursorSInput) return;
		elements.cursorSInput.value = String(value ?? "");
	}

	function wireCursorControls({ onSetCursorS, onNudgeMinus, onNudgePlus } = {}) {
		const input = elements.cursorSInput;

		if (input && typeof onSetCursorS === "function") {
			input.addEventListener("change", () => onSetCursorS(input.value));
			input.addEventListener("keydown", (ev) => {
				if (ev.key === "Enter") onSetCursorS(input.value);
			});
		}

		if (elements.cursorMinus && typeof onNudgeMinus === "function") {
			elements.cursorMinus.addEventListener("click", () => onNudgeMinus());
		}

		if (elements.cursorPlus && typeof onNudgePlus === "function") {
			elements.cursorPlus.addEventListener("click", () => onNudgePlus());
		}
	}

	// ------------------------------------------------------------
	// optional slot select
	// ------------------------------------------------------------
	function setSlotSelectValue(value) {
		if (!elements.slotSelect) return;
		elements.slotSelect.value = String(value ?? "right");
	}

	function wireSlotSelect({ onChange } = {}) {
		const sel = elements.slotSelect;
		if (!sel || typeof onChange !== "function") return;

		sel.addEventListener("change", () => {
			onChange(sel.value || "right");
		});
	}

	// ------------------------------------------------------------
	// import picker
	// ------------------------------------------------------------
	function wireImportPicker({ onFiles } = {}) {
		if (!elements.buttonImport || !elements.fileImport) return;

		elements.buttonImport.addEventListener("click", () => {
			elements.fileImport.click();
		});

		elements.fileImport.addEventListener("change", () => {
			const files = Array.from(elements.fileImport.files ?? []);
			if (files.length && typeof onFiles === "function") onFiles(files);
			elements.fileImport.value = "";
		});
	}

	// ------------------------------------------------------------
	// fit / pin
	// ------------------------------------------------------------
	function setAutoFitToggleVisible(visible) {
		if (!elements.chkAutoFit) return;
		const host =
			elements.chkAutoFit.closest(".toggle") ||
			elements.chkAutoFit.closest("label") ||
			elements.chkAutoFit.parentElement;
		if (!host) return;
		host.style.display = visible ? "" : "none";
	}

	function setAutoFitToggleValue(value) {
		if (!elements.chkAutoFit) return;
		elements.chkAutoFit.checked = Boolean(value);
	}

	function wireAutoFitToggle({ onChange } = {}) {
		const el = elements.chkAutoFit;
		if (!el || typeof onChange !== "function") return;

		el.addEventListener("change", () => {
			onChange(Boolean(el.checked));
		});
	}

	function wireFitButton({ onClick } = {}) {
		if (!elements.buttonFit) {
			logLine("uiWiring: btnFit not found");
			return;
		}
		elements.buttonFit.onclick = (e) => {
			e?.preventDefault?.();
			onClick?.();
		};
	}

	function setPinsInfoText(text) {
		const value = String(text ?? "");
		const nodes = document.querySelectorAll("#pinsInfo");
		if (nodes?.length) {
			nodes.forEach((n) => {
				if (n) n.textContent = value;
			});
			return;
		}
		if (elements.pinsInfo) elements.pinsInfo.textContent = value;
	}

	function wirePinControls({ onTogglePin, onClearPins } = {}) {
		elements.buttonPinToggle?.addEventListener("click", () => {
			if (typeof onTogglePin === "function") onTogglePin();
			else logInfo("Pin toggle: no handler wired");
		});

		elements.buttonPinsClear?.addEventListener("click", () => {
			if (typeof onClearPins === "function") onClearPins();
			else logInfo("Pins clear: no handler wired");
		});
	}

	// ------------------------------------------------------------
	// overlays
	// ------------------------------------------------------------
	function openBands() {
		if (!elements.overlayBands) return;
		elements.overlayBands.classList.remove("hidden");
		markPanelHidden(elements.overlayBands, false);
		setPrimary(elements.buttonBands, true);
	}

	function closeBands() {
		if (!elements.overlayBands) return;
		elements.overlayBands.classList.add("hidden");
		markPanelHidden(elements.overlayBands, true);
		setPrimary(elements.buttonBands, false);
	}

	function toggleBands() {
		if (!elements.overlayBands) return;
		const visible = toggleHiddenByClass(elements.overlayBands, "hidden");
		markPanelHidden(elements.overlayBands, !visible);
		setPrimary(elements.buttonBands, visible);
	}

	function openSection() {
		if (!elements.overlaySection) return;
		elements.overlaySection.classList.remove("hidden");
		markPanelHidden(elements.overlaySection, false);
		setPrimary(elements.buttonSection, true);
	}

	function closeSection() {
		if (!elements.overlaySection) return;
		elements.overlaySection.classList.add("hidden");
		markPanelHidden(elements.overlaySection, true);
		setPrimary(elements.buttonSection, false);
	}

	function toggleSection() {
		if (!elements.overlaySection) return;
		const visible = toggleHiddenByClass(elements.overlaySection, "hidden");
		markPanelHidden(elements.overlaySection, !visible);
		setPrimary(elements.buttonSection, visible);
	}

	function openTransition() {
		if (!elements.transitionOverlay) return;
		elements.transitionOverlay.classList.remove("hidden");
		markPanelHidden(elements.transitionOverlay, false);
		setPrimary(elements.buttonTransition, true);
	}

	function closeTransition() {
		if (!elements.transitionOverlay) return;
		elements.transitionOverlay.classList.add("hidden");
		markPanelHidden(elements.transitionOverlay, true);
		setPrimary(elements.buttonTransition, false);
	}

	function toggleTransition() {
		if (!elements.transitionOverlay) return;
		const visible = toggleHiddenByClass(elements.transitionOverlay, "hidden");
		markPanelHidden(elements.transitionOverlay, !visible);
		setPrimary(elements.buttonTransition, visible);
	}

	function wireOverlayButtons() {
		elements.buttonBands?.addEventListener("click", toggleBands);
		elements.buttonSection?.addEventListener("click", toggleSection);
		elements.closeBands?.addEventListener("click", closeBands);
		elements.closeSection?.addEventListener("click", closeSection);

		elements.buttonTransition?.addEventListener("click", toggleTransition);
		elements.buttonTransitionClose?.addEventListener("click", closeTransition);
	}

	// ------------------------------------------------------------
	// SPOT overlay
	// ------------------------------------------------------------
	function openSpot() {
		show(elements.overlaySpot);
		markPanelHidden(elements.overlaySpot, false);
		setPrimary(elements.buttonSpot, true);
	}

	function closeSpot() {
		hide(elements.overlaySpot);
		markPanelHidden(elements.overlaySpot, true);
		setPrimary(elements.buttonSpot, false);
	}

	function toggleSpot() {
		if (!elements.overlaySpot) return;

		const isHidden = elements.overlaySpot.classList.contains("hidden");

		if (isHidden) openSpot();
		else closeSpot();
	}

	function wireSpotOverlay() {
		elements.buttonSpot?.addEventListener("click", toggleSpot);
		elements.buttonSpotClose?.addEventListener("click", closeSpot);
	}

	// ------------------------------------------------------------
	// boot feedback
	// ------------------------------------------------------------
	logLine(t("boot_ui"));
	setStatus(t("boot_ui_ok"));

	wireSpotOverlay();
	wireOverlayButtons();

	return {
		elements,

		// logging + status
		logLine,
		logInfo,
		logError,
		setStatus,
		setStatusOk,
		setStatusBusy,
		setStatusError,

		// props
		showProps,
		emitProps,

		// boards
		setBoardBandsText,
		setBoardSectionText,
		setSelectOptions,
		setSlider01,
		readSlider01,

		// import
		wireImportPicker,

		// cursor
		setCursorSInputValue,
		wireCursorControls,

		// optional slot
		setSlotSelectValue,
		wireSlotSelect,

		// SPOT
		setSpotState: spotView.setSpotState,
		getSpotState: spotView.getSpotState,
		setSpotHtml: spotView.setSpotHtml,
		setSpotText: spotView.setSpotText,
		renderSpotHtml: spotView.renderSpotHtml,
		renderSpotState: spotView.renderSpotState,
		refreshSpot: spotView.refresh,
		wireSpotActions: spotView.wireActions,
		openSpot,
		closeSpot,
		toggleSpot,

		// overlays
		openBands,
		closeBands,
		toggleBands,
		openSection,
		closeSection,
		toggleSection,
		openTransition,
		closeTransition,
		toggleTransition,

		// fit / pin
		setAutoFitToggleVisible,
		setAutoFitToggleValue,
		wireAutoFitToggle,
		wireFitButton,
		wirePinControls,
		setPinsInfoText,
	};
}
