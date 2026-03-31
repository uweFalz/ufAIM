// app/utils/appHelpers.js
//
// ==> import { nowIso, ensureObject } from "@app/utils/appHelpers.js";

//
// ...
//
export function ensureObject(x) { return (x && typeof x === "object") ? x : {}; }

//
// ...
//
export function escapeHtml(text) {
	return String(text ?? "")
	.replace(/&/g, "&amp;")
	.replace(/</g, "&lt;")
	.replace(/>/g, "&gt;")
	.replace(/\"/g, "&quot;")
	.replace(/'/g, "&#39;");
}

//
// ...
//
export function nowMs() { return Date.now(); }
export function nowIso() { return new Date().toISOString(); }
