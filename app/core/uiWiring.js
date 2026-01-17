// app/core/uiWiring.js
// UI only: find elements, wire buttons, write status/log, provide tiny setters.

import { t } from "../i18n/strings.js";

function resolveElement(explicit, fallbackId) {
	if (explicit) return explicit;
	if (!fallbackId) return null;
	return document.getElementById(fallbackId);
}

function setText(target, text) {
	if (!target) return;
	target.textContent = String(text ?? "");
}

function appendLine(target, line) {
	if (!target) return;
	const text = String(line ?? "");
	target.textContent = (target.textContent ?? "") + text + (text.endsWith("\n") ? "" : "\n");
}

function toggleHiddenByClass(element, hiddenClass) {
	if (!element) return false;
	const isHidden = element.classList.toggle(hiddenClass);
	return !isHidden; // now visible?
}

function setPrimary(button, isOn) {
	if (!button) return;
	button.classList.toggle("btn--primary", Boolean(isOn));
}

export function wireUI({ logElement, statusElement } = {}) {
	const elements = {
		log: resolveElement(logElement, "log"),
		status: resolveElement(statusElement, "status"),
		props: document.getElementById("props"),

		// overlays
		boardBands: document.getElementById("board2d"),
		boardSection: document.getElementById("boardSection"),

		buttonBands: document.getElementById("btnToggleBands"),
		buttonSection: document.getElementById("btnToggleSection"),

		overlayBands: document.getElementById("overlayBands"),
		overlaySection: document.getElementById("overlaySection"),

		closeBands: document.getElementById("btnCloseBands"),
		closeSection: document.getElementById("btnCloseSection"),

		// transition overlay
		transitionOverlay: document.getElementById("transOverlay"),
		buttonTransition: document.getElementById("btnTrans"),
		buttonTransitionClose: document.getElementById("btnTransClose"),

		// cursor
		cursorSInput: document.getElementById("inputCursorS"),
		cursorMinus: document.getElementById("btnCursorMinus"),
		cursorPlus: document.getElementById("btnCursorPlus"),

		// RP picker
		routeProjectSelect: document.getElementById("routeProjectSelect"),
	};

	function logLine(line) { appendLine(elements.log, line); }
	function logInfo(line) { appendLine(elements.log, `ℹ️ ${String(line ?? "")}`); }
	function logError(error) {
		const msg = error instanceof Error ? (error.stack || error.message) : String(error);
		appendLine(elements.log, `❌ ${msg}`);
	}

	function setStatus(text) { setText(elements.status, text); }
	function setStatusOk() { setText(elements.status, t("status_ready")); }
	function setStatusBusy() { setText(elements.status, t("status_busy")); }
	function setStatusError() { setText(elements.status, t("status_error")); }

	function setBoardBandsText(text) {
		if (!elements.boardBands) return;
		elements.boardBands.textContent = String(text ?? "");
	}
	function setBoardSectionText(text) {
		if (!elements.boardSection) return;
		elements.boardSection.textContent = String(text ?? "");
	}

	function showProps(object) {
		if (!elements.props) return;
		try { elements.props.textContent = JSON.stringify(object ?? null, null, 2); }
		catch { elements.props.textContent = String(object); }
	}

	function setCursorSInputValue(value) {
		if (!elements.cursorSInput) return;
		elements.cursorSInput.value = String(value ?? "");
	}

	function setRouteProjectSelectValue(value) {
		if (!elements.routeProjectSelect) return;
		elements.routeProjectSelect.value = String(value ?? "");
	}

	// --- Overlays ---
	function closeBands() {
		if (!elements.overlayBands) return;
		elements.overlayBands.classList.add("overlayPane--hidden");
		setPrimary(elements.buttonBands, false);
	}
	function toggleBands() {
		if (!elements.overlayBands) return;
		const visible = toggleHiddenByClass(elements.overlayBands, "overlayPane--hidden");
		setPrimary(elements.buttonBands, visible);
	}

	function closeSection() {
		if (!elements.overlaySection) return;
		elements.overlaySection.classList.add("overlayPane--hidden");
		setPrimary(elements.buttonSection, false);
	}
	function toggleSection() {
		if (!elements.overlaySection) return;
		const visible = toggleHiddenByClass(elements.overlaySection, "overlayPane--hidden");
		setPrimary(elements.buttonSection, visible);
	}

	function openTransition() {
		if (!elements.transitionOverlay) return;
		elements.transitionOverlay.classList.remove("hidden");
	}
	function closeTransition() {
		if (!elements.transitionOverlay) return;
		elements.transitionOverlay.classList.add("hidden");
	}

	// initial state
	closeBands();
	closeSection();
	closeTransition();

	// wire buttons
	elements.buttonBands?.addEventListener("click", toggleBands);
	elements.buttonSection?.addEventListener("click", toggleSection);
	elements.closeBands?.addEventListener("click", closeBands);
	elements.closeSection?.addEventListener("click", closeSection);

	elements.buttonTransition?.addEventListener("click", openTransition);
	elements.buttonTransitionClose?.addEventListener("click", closeTransition);

	elements.transitionOverlay?.addEventListener("click", (event) => {
		if (event.target === elements.transitionOverlay) closeTransition();
	});
	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape") closeTransition();
	});

	// boot feedback
	logLine(t("boot_ui"));
	setStatus(t("boot_ui_ok"));

	return {
		elements,
		logLine, logInfo, logError,
		setStatus, setStatusOk, setStatusBusy, setStatusError,
		showProps,
		setCursorSInputValue,
		setRouteProjectSelectValue,
		setBoardBandsText,
		setBoardSectionText,
		toggleBands, toggleSection,
		openTransition, closeTransition,
	};
}
