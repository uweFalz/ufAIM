// app/i18n/strings.js

import { de } from "./strings.de.js";

const DICTS = { de };
let current = "de";

export function setLanguage(lang) {
	if (DICTS[lang]) current = lang;
}

export function t(key) {
	return (DICTS[current] && DICTS[current][key]) || key;
}
