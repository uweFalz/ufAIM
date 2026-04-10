// app/i18n/strings.js

//
// i18n runtime access layer
//
// RULE:
// - all user-visible UI strings must go through t(...)
// - no direct hardcoded UI text in shell/views/controllers
// - technical console/debug output may stay untranslated
//
// canonical fallback dictionary:
//   strings.de.js
//
// fallback chain:
//   current language -> de -> key
//

import { de } from "./strings.de.js";
import { en } from "./strings.en.js";
import { ar } from "./strings.ar.js";
import { he } from "./strings.he.js";
import { fa } from "./strings.fa.js";
import { ur } from "./strings.ur.js";
import { uk } from "./strings.uk.js";
import { ru } from "./strings.ru.js";
import { fr } from "./strings.fr.js";
import { zh } from "./strings.zh.js";
import { ja } from "./strings.ja.js";
import { hi } from "./strings.hi.js";
import { tr } from "./strings.tr.js";
import { ps } from "./strings.ps.js";
import { my } from "./strings.my.js";
import { sw } from "./strings.sw.js";
import { ht } from "./strings.ht.js";

export const LANGS = [
	{ code: "de", label: "Deutsch", dir: "ltr" },
	{ code: "en", label: "English", dir: "ltr" },
	{ code: "ar", label: "العربية", dir: "rtl" },
	{ code: "he", label: "עברית", dir: "rtl" },
	{ code: "fa", label: "فارسی", dir: "rtl" },
	{ code: "ur", label: "اردو", dir: "rtl" },
	{ code: "uk", label: "Українська", dir: "ltr" },
	{ code: "ru", label: "Русский", dir: "ltr" },
	{ code: "fr", label: "Français", dir: "ltr" },
	{ code: "zh", label: "中文", dir: "ltr" },
	{ code: "ja", label: "日本語", dir: "ltr" },
	{ code: "hi", label: "हिन्दी", dir: "ltr" },
	{ code: "tr", label: "Türkçe", dir: "ltr" },
	{ code: "ps", label: "پښتو", dir: "rtl" },
	{ code: "my", label: "မြန်မာဘာသာ", dir: "ltr" },
	{ code: "sw", label: "Kiswahili", dir: "ltr" },
	{ code: "ht", label: "Kreyòl ayisyen", dir: "ltr" },
];

const DICTS = { de, en, ar, he, fa, ur, uk, ru, fr, zh, ja, hi, tr, ps, my, sw, ht };
const DEV =
	location.hostname === "localhost" ||
	location.hostname === "127.0.0.1";

let current = "de";
const missingWarned = new Set();

export function getLanguage() {
	return current;
}

export function getLanguages() {
	return LANGS.filter((x) => x && x.code);
}

export function isRtlLanguage(lang) {
	const def = LANGS.find((x) => x && x.code === lang);
	return def?.dir === "rtl";
}

export function applyDirection(lang) {
	const dir = isRtlLanguage(lang) ? "rtl" : "ltr";
	document.documentElement.dir = dir;
	document.documentElement.lang = String(lang || "de");
}

export function setLanguage(lang) {
	if (!DICTS[lang]) return false;
	current = lang;
	applyDirection(lang);
	try {
		localStorage.setItem("ufAIM.lang", lang);
	} catch {}
	return true;
}

export function initLanguage() {
	let lang = "de";
	try {
		lang = localStorage.getItem("ufAIM.lang") || "de";
	} catch {}
	if (!DICTS[lang]) lang = "de";
	current = lang;
	applyDirection(lang);
	return current;
}

function warnMissingKey(key) {
	if (!DEV) return;
	const marker = `${current}:${key}`;
	if (missingWarned.has(marker)) return;
	missingWarned.add(marker);
	console.warn(`[i18n] missing key "${key}" for lang "${current}"`);
}

function formatString(str, params = {}) {
	return String(str).replace(/\{(\w+)\}/g, (_, k) => {
		return params[k] != null ? String(params[k]) : `{${k}}`;
	});
}

export function t(key, params = {}) {
	const langDict = DICTS[current] || {};
	const fallbackDict = DICTS.de || {};

	const hasLang = Object.prototype.hasOwnProperty.call(langDict, key);
	const hasFallback = Object.prototype.hasOwnProperty.call(fallbackDict, key);

	if (!hasLang && !hasFallback) {
		warnMissingKey(key);
		return formatString(key, params);
	}

	if (!hasLang && hasFallback) {
		warnMissingKey(key);
		return formatString(fallbackDict[key], params);
	}

	return formatString(langDict[key], params);
}
