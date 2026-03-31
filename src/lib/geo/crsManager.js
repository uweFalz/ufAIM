// src/lib/geo/crsManager.js

// Zentrale Normalisierung + (optionale) proj4-Registrierung für Custom-CRS.

import { CRS_ALIAS_LSYS, CRS_ALIAS_HSYS, coalesceToEpsg } from './crsAlias.js';

//
// ...
//
export function getProj4(crsCode) {
	const epsg = normalizeCrsTag(crsCode);
	if (!epsg.startsWith('EPSG:') && !epsg.startsWith('DBREF')) return null;
	try {
		return proj4.defs(epsg) || null;
	} catch {
		return null;
	}
}

// domain: 'L' (Lage) oder 'H' (Höhe) – nötig, weil DB zwei getrennte Systeme führen kann.
export function normalizeCrsTag(raw, { domain = 'L' } = {}) {
	if (!raw) return 'UNKNOWN';
	const tag = String(raw).trim().toUpperCase();

	// „EPSG:xxxx“ direkt durchreichen
	const direct = coalesceToEpsg(tag);
	if (direct) return direct;

	const map = domain === 'H' ? CRS_ALIAS_HSYS : CRS_ALIAS_LSYS;
	return map[tag] || tag; // Unbekanntes Kürzel vorerst als Tag zurückgeben (sichtbar!)
}

// Optional: proj4-Defs für DBREF (Beispiel! Bitte anpassen.)
export async function ensureProj4Defs(loadProj4) {
	if (typeof loadProj4 !== 'function') return;
	const proj4 = await loadProj4();

	// Nur definieren, wenn noch nicht vorhanden:
	const defineOnce = (code, def) => {
		try { if (!proj4.defs(code)) proj4.defs(code, def); } catch { /* ignore */ }
	};

	// ⚠️ Platzhalter! Sobald du reale Parameter hast, hier ersetzen.
	defineOnce('DBREF:CR0', '+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs');
	defineOnce('DBREF:DA9', '+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs');

	// Höhensysteme sind i.d.R. separater Vertikal-CRS — meist genügt „numerisch durchreichen“.
	// Falls du reale vertikale Transformationsparameter hast, könntest du hier ebenfalls definieren.
}

// Kleine Helper: Punkte/Elemente nach CRS gruppieren
export function groupByCrs(items, getKey, { domain = 'L' } = {}) {
	const m = new Map();
	for (const it of items) {
		const raw = getKey(it);
		const key = normalizeCrsTag(raw, { domain });
		if (!m.has(key)) m.set(key, []);
		m.get(key).push(it);
	}
	return m;
}
