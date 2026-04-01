// app/view/shell/makePanelDraggable.js
//
// minimal floating-panel drag helper
// - drag by handle
// - keeps panel inside viewport
// - raises z-index on pointerdown
// - works with absolute/fixed positioned panels

import { loadPanelLayout, savePanelLayout } from "./panelLayoutStore.js";

let __ufPanelZ = 100;

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function getPointer(ev) {
	if ("touches" in ev && ev.touches?.length) {
		return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
	}
	return { x: ev.clientX, y: ev.clientY };
}

function bringToFront(panelEl) {
	__ufPanelZ += 1;
	panelEl.style.zIndex = String(__ufPanelZ);
}

function ensurePositioned(panelEl) {
	const cs = window.getComputedStyle(panelEl);
	if (cs.position !== "absolute" && cs.position !== "fixed") {
		panelEl.style.position = "absolute";
	}

	if (!panelEl.style.left && !panelEl.style.top) {
		const rect = panelEl.getBoundingClientRect();
		panelEl.style.left = `${Math.round(rect.left)}px`;
		panelEl.style.top = `${Math.round(rect.top)}px`;
	}
}

function keepInViewport(panelEl, margin = 8) {
	const rect = panelEl.getBoundingClientRect();
	const vw = window.innerWidth;
	const vh = window.innerHeight;

	const left = parseFloat(panelEl.style.left || rect.left || 0);
	const top = parseFloat(panelEl.style.top || rect.top || 0);

	const maxLeft = Math.max(margin, vw - rect.width - margin);
	const maxTop = Math.max(margin, vh - rect.height - margin);

	panelEl.style.left = `${Math.round(clamp(left, margin, maxLeft))}px`;
	panelEl.style.top = `${Math.round(clamp(top, margin, maxTop))}px`;
}

function persistPanel(panelEl) {
	const id = panelEl?.id;
	if (!id) return;

	savePanelLayout(id, {
		left: panelEl.style.left || "",
		top: panelEl.style.top || "",
		zIndex: panelEl.style.zIndex || "",
	});
}

function restorePanel(panelEl, margin = 8) {
	const id = panelEl?.id;
	if (!id) return;

	const layout = loadPanelLayout(id);
	if (!layout) return;

	if (layout.left) panelEl.style.left = String(layout.left);
	if (layout.top) panelEl.style.top = String(layout.top);
	if (layout.zIndex) {
		panelEl.style.zIndex = String(layout.zIndex);
		const zi = Number(layout.zIndex);
		if (Number.isFinite(zi)) __ufPanelZ = Math.max(__ufPanelZ, zi);
	}

	ensurePositioned(panelEl);
	keepInViewport(panelEl, margin);
}

export function makePanelDraggable(panelEl, handleEl = null, options = {}) {
	if (!panelEl) return () => {};

	const handle = handleEl || panelEl;
	const margin = Number(options.margin ?? 8);

	let dragging = false;
	let startPointerX = 0;
	let startPointerY = 0;
	let startLeft = 0;
	let startTop = 0;

	restorePanel(panelEl, margin);

	const onMove = (ev) => {
		if (!dragging) return;

		const p = getPointer(ev);
		const dx = p.x - startPointerX;
		const dy = p.y - startPointerY;

		const rect = panelEl.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		const maxLeft = Math.max(margin, vw - rect.width - margin);
		const maxTop = Math.max(margin, vh - rect.height - margin);

		const nextLeft = clamp(startLeft + dx, margin, maxLeft);
		const nextTop = clamp(startTop + dy, margin, maxTop);

		panelEl.style.left = `${Math.round(nextLeft)}px`;
		panelEl.style.top = `${Math.round(nextTop)}px`;

		if (ev.cancelable) ev.preventDefault();
	};

	const stopDrag = () => {
		if (!dragging) return;
		dragging = false;
		persistPanel(panelEl);

		document.removeEventListener("mousemove", onMove);
		document.removeEventListener("mouseup", stopDrag);
		document.removeEventListener("touchmove", onMove);
		document.removeEventListener("touchend", stopDrag);
	};

	const startDrag = (ev) => {
		if (ev.button != null && ev.button !== 0) return;

		ensurePositioned(panelEl);
		keepInViewport(panelEl, margin);
		bringToFront(panelEl);
		persistPanel(panelEl);

		const p = getPointer(ev);
		const rect = panelEl.getBoundingClientRect();

		startPointerX = p.x;
		startPointerY = p.y;
		startLeft = parseFloat(panelEl.style.left || rect.left || 0);
		startTop = parseFloat(panelEl.style.top || rect.top || 0);
		dragging = true;

		document.addEventListener("mousemove", onMove, { passive: false });
		document.addEventListener("mouseup", stopDrag);
		document.addEventListener("touchmove", onMove, { passive: false });
		document.addEventListener("touchend", stopDrag);

		if (ev.cancelable) ev.preventDefault();
	};

	const onPanelPointerDown = () => {
		bringToFront(panelEl);
		persistPanel(panelEl);
	};

	const onResize = () => {
		keepInViewport(panelEl, margin);
		persistPanel(panelEl);
	};

	handle.addEventListener("mousedown", startDrag);
	handle.addEventListener("touchstart", startDrag, { passive: false });
	panelEl.addEventListener("mousedown", onPanelPointerDown);
	panelEl.addEventListener("touchstart", onPanelPointerDown, { passive: true });
	window.addEventListener("resize", onResize);

	handle.style.cursor = "move";

	return function destroyDraggable() {
		stopDrag();
		handle.removeEventListener("mousedown", startDrag);
		handle.removeEventListener("touchstart", startDrag);
		panelEl.removeEventListener("mousedown", onPanelPointerDown);
		panelEl.removeEventListener("touchstart", onPanelPointerDown);
		window.removeEventListener("resize", onResize);
		handle.style.cursor = "";
	};
}
