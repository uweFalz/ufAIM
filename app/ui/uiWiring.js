// app/ui/uiWiring.js
//
// UI wiring only
//
// @baustelle [I18N_GATE]
// All user-visible strings must pass through t(...).
// uiWiring is the translation gate for status/help/button text.
// Do not introduce raw UI text literals here.
//
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

import { t, getLanguages, getLanguage, setLanguage } from "@app/i18n/strings.js";
import { clamp01 } from "@utils/helpers.js";
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

function escapeHtmlText(s) {
	return String(s ?? "")
	.replaceAll("&", "&amp;")
	.replaceAll("<", "&lt;")
	.replaceAll(">", "&gt;")
	.replaceAll('"', "&quot;")
	.replaceAll("'", "&#39;");
}

// ------------------------------------------------------------
// wireUI
// ------------------------------------------------------------
export function wireUI({ logElement, statusElement, prefs } = {}) {
	
	// console.log("[wireUI] btnImport", document.getElementById("btnImport"));
	// console.log("[wireUI] i18n count", document.querySelectorAll("[data-i18n]").length);
	
	const elements = {
		buttonLang: document.getElementById("btnLang"),
		langMenu: document.getElementById("langMenu"),
		
		log: resolveElement(logElement, "log"),
		status: resolveElement(statusElement, "status"),
		props: document.getElementById("props"),

		buttonCockpit: document.getElementById("btnCockpit"),
		buttonCockpitClose: document.getElementById("btnCockpitClose"),
		shell: document.getElementById("ufShell"),
		
		// Debug
		buttonDebug: document.getElementById("btnToggleDebug"),
		overlayDebug: document.getElementById("debugOverlay"),
		buttonDebugClose: document.getElementById("btnCloseDebug"),

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
		alignmentEditorOverlay: document.getElementById("alignmentEditorOverlay"),
		buttonAlignmentEditor: document.getElementById("btnAlignmentEditor"),
		buttonAlignmentEditorClose: document.getElementById("btnAlignmentEditorClose"),

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
	
	function renderLanguageMenu() {
		if (!elements.langMenu) return;

		const currentLang = getLanguage();
		const items = getLanguages()
		.filter((lang) => !lang.disabled)
		.map((lang) => {
			const active = lang.code === currentLang;
			return `
			<button
			class="uf-langMenu__item ${active ? "is-active" : ""}"
			data-lang-code="${escapeHtmlText(lang.code)}"
			type="button"
			>
			${escapeHtmlText(lang.label)}
			</button>
			`;
		})
		.join("");

		elements.langMenu.innerHTML = items || "";
	}

	// ------------------------------------------------------------
	// i18n
	// ------------------------------------------------------------
	function applyI18n(root = document) {
		if (!root) return;

		const textNodes = root.querySelectorAll("[data-i18n]");
		const titleNodes = root.querySelectorAll("[data-i18n-title]");
		const ariaLabelNodes = root.querySelectorAll("[data-i18n-aria-label]");
		const placeholderNodes = root.querySelectorAll("[data-i18n-placeholder]");

		/*
		console.log("[applyI18n] counts", {
			text: textNodes.length,
			title: titleNodes.length,
			placeholder: placeholderNodes.length,
		});
		*/

		textNodes.forEach((el) => {
			const key = el.getAttribute("data-i18n");
			if (!key) return;
			el.textContent = t(key);
		});

		titleNodes.forEach((el) => {
			const key = el.getAttribute("data-i18n-title");
			if (!key) return;
			el.setAttribute("title", t(key));
		});

		ariaLabelNodes.forEach((el) => {
			const key = el.getAttribute("data-i18n-aria-label");
			if (!key) return;
			el.setAttribute("aria-label", t(key));
		});

		placeholderNodes.forEach((el) => {
			const key = el.getAttribute("data-i18n-placeholder");
			if (!key) return;
			el.setAttribute("placeholder", t(key));
		});
	}
	
	function openLanguageMenu() {
		if (!elements.langMenu) return;
		renderLanguageMenu();
		elements.langMenu.classList.remove("hidden");
		elements.buttonLang?.setAttribute("aria-expanded", "true");
	}

	function closeLanguageMenu() {
		if (!elements.langMenu) return;
		elements.langMenu.classList.add("hidden");
		elements.buttonLang?.setAttribute("aria-expanded", "false");
	}

	function toggleLanguageMenu() {
		if (!elements.langMenu) return;
		const hidden = elements.langMenu.classList.contains("hidden");
		if (hidden) openLanguageMenu();
		else closeLanguageMenu();
	}

	function wireLanguageMenu() {
		elements.buttonLang?.addEventListener("click", (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			toggleLanguageMenu();
		});

		elements.langMenu?.addEventListener("click", (ev) => {
			const btn = ev.target.closest("[data-lang-code]");
			if (!btn) return;

			const lang = String(btn.dataset.langCode ?? "");
			if (!lang) return;

			const changed = setLanguage(lang);
			if (!changed) return;

			closeLanguageMenu();
			applyI18n(document);
			spotView.refresh();
			setStatus(t("status_ready"));
			renderLanguageMenu();
		});

		document.addEventListener("click", (ev) => {
			if (!elements.langMenu || !elements.buttonLang) return;
			const insideMenu = elements.langMenu.contains(ev.target);
			const insideButton = elements.buttonLang.contains(ev.target);
			if (!insideMenu && !insideButton) {
				closeLanguageMenu();
			}
		});
	}

	// ------------------------------------------------------------
	// SPOT view
	// ------------------------------------------------------------
	const spotView = makeSpotView({
		rootEl: elements.spotOverlayBody,
	});

	// ------------------------------------------------------------
	// cockpit
	// ------------------------------------------------------------

	function openCockpit() {
		if (!elements.shell) return;
		closeSpot();
		elements.shell.classList.remove("is-cockpit-collapsed");
		setPrimary(elements.buttonCockpit, true);
	}

	function closeCockpit() {
		if (!elements.shell) return;
		elements.shell.classList.add("is-cockpit-collapsed");
		setPrimary(elements.buttonCockpit, false);
	}

	function toggleCockpit() {
		if (!elements.shell) return;
		if (elements.shell.classList.contains("is-cockpit-collapsed")) openCockpit();
		else closeCockpit();
	}

	// ------------------------------------------------------------
	// log ringbuffer
	// ------------------------------------------------------------
	const MAX_LOG_LINES = 400;
	const MAX_LOG_LINE_LENGTH = 220;
	const logBuf = [];

	function shortenLogLine(line, maxLen = MAX_LOG_LINE_LENGTH) {
		const s = String(line ?? "");
		return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
	}

	function pushLog(line) {
		logBuf.push(shortenLogLine(line));

		if (logBuf.length > MAX_LOG_LINES) {
			logBuf.splice(0, logBuf.length - MAX_LOG_LINES);
		}

		if (elements.log) {
			const isNearBottom =
			elements.log.scrollTop + elements.log.clientHeight >= elements.log.scrollHeight - 20;

			elements.log.textContent = logBuf.join("\n") + "\n";

			if (isNearBottom) {
				elements.log.scrollTop = elements.log.scrollHeight;
			}
		}
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
	// import
	// ------------------------------------------------------------
	function setImportSummary({
	fileName,
	spot = null,
	working = null,
	items = 0,
	rejected = 0,
	promotable = 0,
	error = false,
} = {}) {
	if (error) {
		setStatus(t("import_result_failed", { fileName }));
		return;
	}

	const usableSpot = Number.isFinite(spot) ? spot : promotable;
	const usableWorking = Number.isFinite(working) ? working : Math.max(0, items - promotable);

	if (usableSpot === 1) {
		setStatus(t("import_result_alignment_ready", { fileName }));
	} else if (usableSpot > 1) {
		setStatus(t("import_result_alignments_ready", {
			fileName,
			count: usableSpot,
		}));
	} else if (usableWorking > 0) {
		setStatus(t("import_result_only_aux_data", { fileName }));
	} else if (items > 0 && rejected === 0) {
		// defensive fallback:
		// imported something valid, but no explicit spot/working split available
		setStatus(t("import_result_alignment_ready", { fileName }));
	} else {
		setStatus(t("import_result_no_usable_alignment", { fileName }));
	}

	if (usableWorking > 0 && usableSpot > 0) {
		logInfo(t("import_note_aux_data_present"));
	}
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
	function openDebug() {
		if (!elements.overlayDebug) return;
		elements.overlayDebug.classList.remove("hidden");
		markPanelHidden(elements.overlayDebug, false);
		setPrimary(elements.buttonDebug, true);
	}

	function closeDebug() {
		if (!elements.overlayDebug) return;
		elements.overlayDebug.classList.add("hidden");
		markPanelHidden(elements.overlayDebug, true);
		setPrimary(elements.buttonDebug, false);
	}

	function toggleDebug() {
		if (!elements.overlayDebug) return;
		const visible = toggleHiddenByClass(elements.overlayDebug, "hidden");
		markPanelHidden(elements.overlayDebug, !visible);
		setPrimary(elements.buttonDebug, visible);
	}

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

	function openAlignmentEditor() {
		show(elements.alignmentEditorOverlay);
		markPanelHidden(elements.alignmentEditorOverlay, false);
		setPrimary(elements.buttonAlignmentEditor, true);
	}

	function closeAlignmentEditor() {
		hide(elements.alignmentEditorOverlay);
		markPanelHidden(elements.alignmentEditorOverlay, true);
		setPrimary(elements.buttonAlignmentEditor, false);
	}

	function toggleAlignmentEditor() {
		if (elements.alignmentEditorOverlay?.classList.contains("hidden")) openAlignmentEditor();
		else closeAlignmentEditor();
	}

	function wireOverlayButtons() {
		elements.buttonCockpit?.addEventListener("click", toggleCockpit);
		elements.buttonCockpitClose?.addEventListener("click", closeCockpit);

		elements.buttonDebug?.addEventListener("click", toggleDebug);
		elements.buttonDebugClose?.addEventListener("click", closeDebug);

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
		closeCockpit();
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
	wireLanguageMenu();
	applyI18n(document);

	logLine(t("boot_ui"));
	setStatus(t("boot_ui_ok"));

	wireSpotOverlay();
	wireOverlayButtons();
	if (elements.overlaySpot && !elements.overlaySpot.classList.contains("hidden")) {
		closeCockpit();
		setPrimary(elements.buttonSpot, true);
	}

	return {
		elements,
		
		applyI18n,
		
		openDebug,
		closeDebug,
		toggleDebug,

				openCockpit,
		closeCockpit,
		toggleCockpit,

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
		setImportSummary,
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
		getSpotQuery: spotView.getQuery,
		setSpotQuery: spotView.setQuery,
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
		openAlignmentEditor,
		closeAlignmentEditor,
		toggleAlignmentEditor,

		// fit / pin
		setAutoFitToggleVisible,
		setAutoFitToggleValue,
		wireAutoFitToggle,
		wireFitButton,
		wirePinControls,
		setPinsInfoText,
	};
}
