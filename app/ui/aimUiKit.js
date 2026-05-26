// app/ui/aimUiKit.js
//
// AIM UI Kit v0
// - safe DOM helpers
// - i18n catalog + msg()
// - legacy t() compatibility
// - slot helper
// - no globals, no side effects

const DEFAULT_LOCALE = "de";

const catalogs = {
	de: {
		ui: {
			button: {
				ok: "OK",
				cancel: "Abbrechen",
				close: "Schließen",
				import: "Importieren",
			},
		},
		import: {
			dropzone: {
				title: "Dateien hier ablegen",
				hint: "TRA, GRA, LandXML, IFC oder GND-Dateien",
			},
		},
		errors: {
			UNKNOWN: "Unbekannter Fehler.",
			SPARSE_START_POSE_MISSING: "Startpose fehlt.",
		},
	},
	en: {
		ui: {
			button: {
				ok: "OK",
				cancel: "Cancel",
				close: "Close",
				import: "Import",
			},
		},
		import: {
			dropzone: {
				title: "Drop files here",
				hint: "TRA, GRA, LandXML, IFC or GND files",
			},
		},
		errors: {
			UNKNOWN: "Unknown error.",
			SPARSE_START_POSE_MISSING: "Start pose is missing.",
		},
	},
};

let activeLocale = DEFAULT_LOCALE;

export const AimUi = Object.freeze({
	el,
	text,
	clear,
	replaceChildren,
	slot,
	msg,
	setLocale,
	getLocale,
	registerCatalog,
	errorText,
});

// ------------------------------------------------------------
// DOM
// ------------------------------------------------------------

export function el(tag, attrs = {}, children = []) {
	const node = document.createElement(tag);

	for (const [key, value] of Object.entries(attrs ?? {})) {
		if (value == null || value === false) continue;

		if (key === "className") {
			node.className = String(value);
		} else if (key === "text") {
			node.textContent = String(value);
		} else if (key === "html") {
			throw new Error("[AimUi.el] innerHTML/html is intentionally forbidden.");
		} else if (key === "dataset" && isObject(value)) {
			for (const [dataKey, dataValue] of Object.entries(value)) {
				node.dataset[dataKey] = String(dataValue);
			}
		} else if (key === "style" && isObject(value)) {
			Object.assign(node.style, value);
		} else if (key.startsWith("on") && typeof value === "function") {
			node.addEventListener(key.slice(2).toLowerCase(), value);
		} else if (value === true) {
			node.setAttribute(key, "");
		} else {
			node.setAttribute(key, String(value));
		}
	}

	for (const child of toArray(children)) {
		appendChild(node, child);
	}

	return node;
}

export function text(value) {
	return document.createTextNode(String(value ?? ""));
}

export function clear(node) {
	if (node) node.replaceChildren();
	return node;
}

export function replaceChildren(node, children = []) {
	if (!node) return null;
	node.replaceChildren();
	for (const child of toArray(children)) {
		appendChild(node, child);
	}
	return node;
}

export function slot(name, root = document) {
	return root.querySelector(`[data-slot="${cssEscape(name)}"]`);
}

// ------------------------------------------------------------
// i18n
// ------------------------------------------------------------

export function setLocale(locale) {
	activeLocale = catalogs[locale] ? locale : DEFAULT_LOCALE;
	return activeLocale;
}

export function getLocale() {
	return activeLocale;
}

export function registerCatalog(locale, catalog) {
	if (!locale || !isObject(catalog)) {
		throw new Error("[AimUi.registerCatalog] locale and catalog required.");
	}

	catalogs[locale] = deepMerge(catalogs[locale] ?? {}, catalog);
}

export function msg(path, params = {}, options = {}) {
	const locale = options.locale ?? activeLocale;
	const fallbackLocale = options.fallbackLocale ?? DEFAULT_LOCALE;

	const value =
		getPath(catalogs[locale], path) ??
		getPath(catalogs[fallbackLocale], path);

	if (typeof value !== "string") {
		console.warn("[AimUi.msg] missing i18n key:", path);
		return `⟦${path}⟧`;
	}

	return interpolate(value, params);
}

// Legacy-compatible facade:
export function t(path, params = {}) {
	return msg(path, params);
}

export function errorText(error, fallbackCode = "UNKNOWN") {
	const code =
		typeof error === "string"
			? error
			: error?.code ?? fallbackCode;

	return msg(`errors.${code}`);
}

// ------------------------------------------------------------
// internals
// ------------------------------------------------------------

function appendChild(parent, child) {
	if (child == null || child === false) return;

	if (child instanceof Node) {
		parent.appendChild(child);
		return;
	}

	parent.appendChild(text(child));
}

function toArray(value) {
	return Array.isArray(value) ? value : [value];
}

function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getPath(root, path) {
	return String(path ?? "")
		.split(".")
		.reduce((obj, key) => obj?.[key], root);
}

function interpolate(template, params) {
	return String(template).replace(/\{(\w+)\}/g, (_, key) => {
		return params[key] == null ? `{${key}}` : String(params[key]);
	});
}

function deepMerge(base, patch) {
	const out = { ...base };

	for (const [key, value] of Object.entries(patch)) {
		out[key] =
			isObject(value) && isObject(out[key])
				? deepMerge(out[key], value)
				: value;
	}

	return out;
}

function cssEscape(value) {
	if (globalThis.CSS?.escape) return CSS.escape(String(value));
	return String(value).replace(/"/g, '\\"');
}
