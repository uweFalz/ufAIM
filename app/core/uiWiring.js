// app/core/uiWiring.js
//
// UI-only wiring for ufAIM sandbox
// - find DOM elements
// - addEventListener (buttons, inputs, selects)
// - write status/log/boards/props
// - manage overlay panes (Bands/Section + Transition legacy)
//
// Rule of thumb:
// - appCore provides callbacks (onSetS, onStep, onRouteProjectChange, ...)
// - uiWiring owns ALL DOM listeners

import { t } from "../i18n/strings.js";

function resolveElement(explicit, fallbackId) {
	if (explicit) return explicit;
	return fallbackId ? document.getElementById(fallbackId) : null;
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
	const isHiddenNow = element.classList.toggle(hiddenClass);
	return !isHiddenNow; // true => visible
}

function setPrimary(button, isOn) {
	if (!button) return;
	button.classList.toggle("btn--primary", Boolean(isOn));
}

export function wireUI({ logElement, statusElement } = {}) {
	// -------------------------------------------------------------------------
	// Elements
	// -------------------------------------------------------------------------
	const elements = {
		// status + debug panes
		log: resolveElement(logElement, "log"),
		status: resolveElement(statusElement, "status"),
		props: document.getElementById("props"),

		// overlays + boards
		boardBands: document.getElementById("board2d"),
		boardSection: document.getElementById("boardSection"),

		overlayBands: document.getElementById("overlayBands"),
		overlaySection: document.getElementById("overlaySection"),

		buttonBands: document.getElementById("btnToggleBands"),
		buttonSection: document.getElementById("btnToggleSection"),

		closeBands: document.getElementById("btnCloseBands"),
		closeSection: document.getElementById("btnCloseSection"),

		// cursor controls (topbar)
		cursorSInput: document.getElementById("inputCursorS"),
		cursorMinus: document.getElementById("btnCursorMinus"),
		cursorPlus: document.getElementById("btnCursorPlus"),

		// RP select (topbar)
		routeProjectSelect: document.getElementById("routeProjectSelect"),
		// G: NEW slot picker
		slotSelect: document.getElementById("slotSelect"),

		// Transition overlay (legacy / optional)
		transitionOverlay: document.getElementById("transOverlay"),
		buttonTransition: document.getElementById("btnTrans"),
		buttonTransitionClose: document.getElementById("btnTransClose"),
	};

	// -------------------------------------------------------------------------
	// Logging + status
	// -------------------------------------------------------------------------
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

	// -------------------------------------------------------------------------
	// Props (debug)
	// -------------------------------------------------------------------------
	function showProps(object) {
		if (!elements.props) return;
		try {
			elements.props.textContent = JSON.stringify(object ?? null, null, 2);
		} catch {
			elements.props.textContent = String(object);
		}
	}

	// -------------------------------------------------------------------------
	// Boards (text-only right now)
	// -------------------------------------------------------------------------
	function setBoardBandsText(text) {
		if (!elements.boardBands) return;
		elements.boardBands.textContent = String(text ?? "");
	}

	function setBoardSectionText(text) {
		if (!elements.boardSection) return;
		elements.boardSection.textContent = String(text ?? "");
	}

	// -------------------------------------------------------------------------
	// Cursor input helpers
	// -------------------------------------------------------------------------
	function setCursorSInputValue(value) {
		if (!elements.cursorSInput) return;
		elements.cursorSInput.value = String(value ?? "");
	}

	// -------------------------------------------------------------------------
	// RouteProject select helpers
	// -------------------------------------------------------------------------
	function setRouteProjectOptions(ids, activeId) {
		const sel = elements.routeProjectSelect;
		if (!sel) return;

		const list = Array.isArray(ids) ? ids.slice() : [];
		list.sort((a, b) => String(a).localeCompare(String(b)));

		const wanted = activeId && list.includes(activeId) ? activeId : "";

		sel.innerHTML = "";
		const none = document.createElement("option");
		none.value = "";
		none.textContent = "(none)";
		sel.appendChild(none);

		for (const id of list) {
			const opt = document.createElement("option");
			opt.value = id;
			opt.textContent = id;
			sel.appendChild(opt);
		}

		sel.value = wanted;
	}

	// -------------------------------------------------------------------------
	// Overlay panes (Bands / Section)
	// -------------------------------------------------------------------------
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

	// -------------------------------------------------------------------------
	// Transition overlay (legacy)
	// -------------------------------------------------------------------------
	function openTransition() {
		if (!elements.transitionOverlay) return;
		elements.transitionOverlay.classList.remove("hidden");
	}

	function closeTransition() {
		if (!elements.transitionOverlay) return;
		elements.transitionOverlay.classList.add("hidden");
	}

	// -------------------------------------------------------------------------
	// Wiring hooks (callbacks injected by appCore)
	// -------------------------------------------------------------------------
	function wireCursorControls({ onSetS, onStep } = {}) {
		const input = elements.cursorSInput;
		const minus = elements.cursorMinus;
		const plus = elements.cursorPlus;

		if (input) {
			input.addEventListener("change", () => onSetS?.(input.value));
			input.addEventListener("keydown", (ev) => {
				if (ev.key === "Enter") onSetS?.(input.value);
			});
		}
		minus?.addEventListener("click", () => onStep?.(-10));
		plus?.addEventListener("click", () => onStep?.(+10));
	}

	function wireRouteProjectSelect({ onChange } = {}) {
		const sel = elements.routeProjectSelect;
		if (!sel) return;
		sel.addEventListener("change", () => onChange?.(sel.value || ""));
	}

	// G: NEW
	function setSlotSelectValue(value) {
		if (!elements.slotSelect) return;
		elements.slotSelect.value = String(value ?? "right");
	}

	// -------------------------------------------------------------------------
	// Default UI state + built-in UI-only listeners
	// -------------------------------------------------------------------------
	// start hidden
	closeBands();
	closeSection();
	closeTransition();

	// overlay buttons
	elements.buttonBands?.addEventListener("click", toggleBands);
	elements.buttonSection?.addEventListener("click", toggleSection);
	elements.closeBands?.addEventListener("click", closeBands);
	elements.closeSection?.addEventListener("click", closeSection);

	// transition buttons
	elements.buttonTransition?.addEventListener("click", openTransition);
	elements.buttonTransitionClose?.addEventListener("click", closeTransition);

	// click on backdrop closes transition (but not clicks inside card)
	elements.transitionOverlay?.addEventListener("click", (event) => {
		if (event.target === elements.transitionOverlay) closeTransition();
	});

	// ESC closes transition
	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape") closeTransition();
	});

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

		// cursor
		setCursorSInputValue,
		wireCursorControls,

		// RP select
		setRouteProjectOptions,
		wireRouteProjectSelect,
		
		// G: NEW
		setSlotSelectValue,

		// overlays (optional external control)
		openBands,
		closeBands,
		toggleBands,

		openSection,
		closeSection,
		toggleSection,

		openTransition,
		closeTransition,
	};
}
