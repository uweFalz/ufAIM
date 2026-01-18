// app/core/uiWiring.js
//
// UI only:
// - find elements
// - wire buttons / inputs
// - write status/log/boards
//
// i18n: all UI strings via t(...)

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
	return !isHidden; // returns "now visible"
}

function setPrimary(button, isOn) {
	if (!button) return;
	button.classList.toggle("btn--primary", Boolean(isOn));
}

export function wireUI({ logElement, statusElement } = {}) {
	// ------------------------------------------------------------
	// Element lookup
	// ------------------------------------------------------------
	const elements = {
		log: resolveElement(logElement, "log"),
		status: resolveElement(statusElement, "status"),
		props: document.getElementById("props"),

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

		// transition overlay
		transitionOverlay: document.getElementById("transOverlay"),
		buttonTransition: document.getElementById("btnTrans"),
		buttonTransitionClose: document.getElementById("btnTransClose"),

		// cursor controls
		cursorSInput: document.getElementById("inputCursorS"),
		cursorMinus: document.getElementById("btnCursorMinus"),
		cursorPlus: document.getElementById("btnCursorPlus"),

		// RP select
		routeProjectSelect: document.getElementById("routeProjectSelect"),
		slotSelect: document.getElementById("slotSelect"),
	};

	// ------------------------------------------------------------
	// logging + status
	// ------------------------------------------------------------
	function logLine(line) {
		appendLine(elements.log, line);
	}

	function logInfo(line) {
		appendLine(elements.log, `ℹ️ ${String(line ?? "")}`);
	}

	function logError(error) {
		const msg = error instanceof Error ? (error.stack || error.message) : String(error);
		appendLine(elements.log, `❌ ${msg}`);
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
	// boards (text-only)
	// ------------------------------------------------------------
	function setBoardBandsText(text) {
		if (!elements.boardBands) return;
		elements.boardBands.textContent = String(text ?? "");
	}

	function setBoardSectionText(text) {
		if (!elements.boardSection) return;
		elements.boardSection.textContent = String(text ?? "");
	}

	// ------------------------------------------------------------
	// props (debug helper)
	// ------------------------------------------------------------
	function showProps(object) {
		if (!elements.props) return;
		try {
			elements.props.textContent = JSON.stringify(object ?? null, null, 2);
		} catch {
			elements.props.textContent = String(object);
		}
	}

	// ------------------------------------------------------------
	// cursor input helper
	// ------------------------------------------------------------
	function setCursorSInputValue(value) {
		if (!elements.cursorSInput) return;
		elements.cursorSInput.value = String(value ?? "");
	}

	// ------------------------------------------------------------
	// RP select helper
	// ------------------------------------------------------------
	function setRouteProjectOptions(ids, activeId) {
		const sel = elements.routeProjectSelect;
		if (!sel) return;

		const safeIds = Array.isArray(ids) ? ids : [];
		const wanted = activeId && safeIds.includes(activeId) ? activeId : "";

		sel.innerHTML = "";

		const none = document.createElement("option");
		none.value = "";
		none.textContent = "(none)";
		sel.appendChild(none);

		for (const id of safeIds) {
			const opt = document.createElement("option");
			opt.value = id;
			opt.textContent = id;
			sel.appendChild(opt);
		}

		sel.value = wanted;
	}
	
	function setSlotSelectValue(value) {
		if (!elements.slotSelect) return;
		elements.slotSelect.value = String(value ?? "right");
	}

	// ------------------------------------------------------------
	// overlays
	// ------------------------------------------------------------
	function openBands() {
		if (!elements.overlayBands) return;
		elements.overlayBands.classList.remove("overlayPane--hidden");
		setPrimary(elements.buttonBands, true);
	}

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

	function openSection() {
		if (!elements.overlaySection) return;
		elements.overlaySection.classList.remove("overlayPane--hidden");
		setPrimary(elements.buttonSection, true);
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

	// initial UI state
	closeBands();
	closeSection();
	closeTransition();

	// wire overlay buttons
	elements.buttonBands?.addEventListener("click", toggleBands);
	elements.buttonSection?.addEventListener("click", toggleSection);
	elements.closeBands?.addEventListener("click", closeBands);
	elements.closeSection?.addEventListener("click", closeSection);

	elements.buttonTransition?.addEventListener("click", openTransition);
	elements.buttonTransitionClose?.addEventListener("click", closeTransition);

	// click backdrop closes (but not clicks inside card)
	elements.transitionOverlay?.addEventListener("click", (event) => {
		if (event.target === elements.transitionOverlay) closeTransition();
	});

	// ESC closes transition overlay
	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape") closeTransition();
	});

	// ------------------------------------------------------------
	// wiring helpers (so appCore doesn't touch addEventListener)
	// ------------------------------------------------------------
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

	function wireRouteProjectSelect({ onChange } = {}) {
		const sel = elements.routeProjectSelect;
		if (!sel || typeof onChange !== "function") return;

		sel.addEventListener("change", () => {
			onChange(sel.value || "");
		});
	}
	
	function wireSlotSelect({ onChange } = {}) {
		const sel = elements.slotSelect;
		if (!sel || typeof onChange !== "function") return;

		sel.addEventListener("change", () => {
			onChange(sel.value || "right");
		});
	}

	// small boot feedback
	logLine(t("boot_ui"));
	setStatus(t("boot_ui_ok"));

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

		// boards
		setBoardBandsText,
		setBoardSectionText,

		// cursor helpers
		setCursorSInputValue,

		// RP helpers
		setRouteProjectOptions,
		setSlotSelectValue,
		wireSlotSelect,

		// overlays
		openBands,
		closeBands,
		toggleBands,
		openSection,
		closeSection,
		toggleSection,
		openTransition,
		closeTransition,

		// wiring helpers
		wireCursorControls,
		wireRouteProjectSelect,
	};
}
