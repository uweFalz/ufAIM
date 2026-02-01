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

// ...
export function wireUI({ logElement, statusElement, prefs } = {}) {
	// prefs optional – später für UI-Debug-Features nützlich

	// ------------------------------------------------------------
	// Element lookup / cacheElements()
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

		// RP select
		routeProjectSelect: document.getElementById("routeProjectSelect"),
		slotSelect: document.getElementById("slotSelect"),
		
		// ...
		chkAutoFit: document.getElementById("chkAutoFit"),
		// ...
		buttonFit: document.getElementById("btnFit"),
		buttonPinToggle: document.getElementById("btnPinToggle"),
		buttonPinsClear: document.getElementById("btnPinsClear"),
		pinsInfo: document.getElementById("pinsInfo"),

		// docs overlay
		buttonDocs: document.getElementById("btnDocs"),
		overlayDocs: document.getElementById("docsOverlay"),
		docsSelect: document.getElementById("docsSelect"),
		docsText: document.getElementById("docsText"),
		buttonDocsClose: document.getElementById("btnDocsClose"),
	};
	
	// ------------------------------------------------------------
	// log ringbuffer (prevents DOM from growing forever)
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
		// don't fight the user while typing
		if (document.activeElement === elements.cursorSInput) return;
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
	// ...
	// ------------------------------------------------------------
	function setAutoFitToggleVisible(isVisible) {
		if (!elements.chkAutoFit) return;
		const host = elements.chkAutoFit.closest(".toggle");
		if (host) host.style.display = isVisible ? "" : "none";
	}

	function setAutoFitToggleValue(isOn) {
		if (!elements.chkAutoFit) return;
		elements.chkAutoFit.checked = Boolean(isOn);
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

	// ------------------------------------------------------------
	// MS13.12: pinned controls (small helpers)
	// ------------------------------------------------------------
	function setPinsInfoText(text) {
		const t = String(text ?? '');
		// be robust against accidental duplicate ids while developing
		const nodes = document.querySelectorAll('#pinsInfo');
		if (nodes?.length) {
			nodes.forEach(n => { if (n) n.textContent = t; });
			return;
		}
		if (elements.pinsInfo) elements.pinsInfo.textContent = t;
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

	// ------------------------------------------------------------
	// docs overlay (Vision/Roadmap/Freeze)
	// ------------------------------------------------------------
	const docsMap = {
		vision: new URL("../../docs/vision/VISION.md", import.meta.url),
		roadmap: new URL("../../docs/roadmap/ROADMAP.md", import.meta.url),
		freeze: new URL("../../docs/architecture/ARCHITEKTUR_FREEZE.md", import.meta.url),
	};

	async function loadDocs(kind) {
		const k = String(kind || "").toLowerCase();
		const url = docsMap[k] ?? docsMap.roadmap;
		if (!elements.docsText) return;

		try {
			elements.docsText.textContent = "Loading…";
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const text = await res.text();
			elements.docsText.textContent = text;
		} catch (err) {
			elements.docsText.textContent = `Failed to load docs: ${err?.message ?? err}`;
		}
	}

	function show(el) {
		console.debug("show", el);
		if (!el) return;
		el.classList.remove("hidden");
		el.classList.remove("overlayPane--hidden");
	}
	function hide(el) {
		// console.debug("hide", el);
		if (!el) return;
		el.classList.add("hidden");
		el.classList.add("overlayPane--hidden");
	}

	function openDocs()  { show(elements.overlayDocs); }
	function closeDocs() { hide(elements.overlayDocs); }
	function toggleDocs() {
		if (!elements.overlayDocs) return;
		if (elements.overlayDocs.classList.contains("hidden")) openDocs();
		else closeDocs();
	}

	function wireDocs({ defaultDoc } = {}) {
		// ✅ guard: prevent double (or x14) wiring
		if (elements.__docsWired) return;
		elements.__docsWired = true;

		elements.buttonDocs?.addEventListener("click", (e) => {
			e?.preventDefault?.();
			toggleDocs();
		});

		elements.buttonDocsClose?.addEventListener("click", (e) => {
			e?.preventDefault?.();
			closeDocs();
		});

		elements.overlayDocs?.addEventListener("click", (event) => {
			if (event.target === elements.overlayDocs) closeDocs();
		});

		elements.docsSelect?.addEventListener("change", () => {
			loadDocs(elements.docsSelect.value);
		});

		// optional: default doc
		if (elements.docsSelect && defaultDoc) {
			elements.docsSelect.value = String(defaultDoc);
			loadDocs(elements.docsSelect.value);
		}
	}

	// initial UI state
	closeBands();
	closeSection();
	closeTransition();
	closeDocs();

	// wire overlay buttons
	elements.buttonBands?.addEventListener("click", toggleBands);
	elements.buttonSection?.addEventListener("click", toggleSection);
	elements.closeBands?.addEventListener("click", closeBands);
	elements.closeSection?.addEventListener("click", closeSection);

	elements.buttonTransition?.addEventListener("click", openTransition);
	elements.buttonTransitionClose?.addEventListener("click", closeTransition);

	// Docs overlay (MS14.1)
	// wireDocs?.({ defaultDoc: String(prefs?.view?.docsDefault ?? "roadmap") });

	// click backdrop closes (but not clicks inside card)
	elements.transitionOverlay?.addEventListener("click", (event) => {
		if (event.target === elements.transitionOverlay) closeTransition();
	});
	
	// ------------------------------------------------------------
	// import picker (button opens hidden <input type=file>)
	// ------------------------------------------------------------
	function wireImportPicker({ onFiles } = {}) {
		const btn = elements.buttonImport;
		const input = elements.fileImport;

		if (!btn || !input || typeof onFiles !== "function") return;

		// click button -> open file dialog
		btn.addEventListener("click", () => {
			// ensure re-selecting same file triggers change
			input.value = "";
			input.click();
		});

		// file dialog selected -> feed files to caller
		input.addEventListener("change", () => {
			const files = Array.from(input.files ?? []);
			if (files.length) onFiles(files);
		});
	}

	// ESC closes overlays
	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closeTransition();
			closeDocs();
		}
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
	
	function emitProps(obj) {
		const pre = document.getElementById("props");
		if (!pre) return;
		pre.textContent = JSON.stringify(obj ?? null, null, 2);
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
		
		wireImportPicker,

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
		
		// docs overlay
		openDocs,
		closeDocs,
		toggleDocs,
		wireDocs,

		// wiring helpers
		wireCursorControls,
		wireRouteProjectSelect,
		
		// ...
		setAutoFitToggleVisible,
		setAutoFitToggleValue,
		wireAutoFitToggle,
		// ...
		wireFitButton,
		wirePinControls,
		setPinsInfoText,
		
		// ...
		emitProps,
	};
}
