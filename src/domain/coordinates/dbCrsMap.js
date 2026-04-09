// src/domain/coordinates/dbCrsMap.js

// DB-internes LSYS → CRS-Mapping (RiL 885 / DBREF).
// Fokus: Lesbarkeit + sichere Defaults. Extensibel für Projektspezifika.

/**
* Zerlegt ein LSYS wie "DR0", "DA9", "EB0", "FS9".
* @param {string} lsys
* @returns {{raw:string, meridian:'C'|'D'|'E'|'F'|null, family:'A'|'B'|'C'|'S'|'R'|null, status:string|null}}
*/
export function parseLSYS(lsys) {
	const raw = String(lsys || '').trim();
	const m = raw.match(/^([CDEF])([ABCSR])([A-Z0-9])$/i);
	if (!m) {
		return { raw, meridian: null, family: null, status: null };
	}
	const [, meridian, family, status] = m;
	return {
		raw,
		meridian: meridian.toUpperCase(),  // C/D/E/F → 6°/9°/12°/15°
		family:   family.toUpperCase(),    // A=RD83, B=PD83, C=42/83, S=Soldner88, R=DBRef
		status:   status.toUpperCase(),    // '0' amtlich/DB-GIS; '1'--'8' projektspez.; '9' gerechnet
	};
}

/** Meridian → Zone-Index (DB/GK-Nomenklatur). */
const MERIDIAN_TO_ZONE = {
	C: 2, // 6°E
	D: 3, // 9°E
	E: 4, // 12°E
	F: 5, // 15°E
};

/** Lesbare Meridian-Infos. */
const MERIDIAN_LABEL = {
	C: '6°E (Zone 2)',
	D: '9°E (Zone 3)',
	E: '12°E (Zone 4)',
	F: '15°E (Zone 5)',
};

/** EPSG-Mapping für DHDN / GK (RD/PD – A/B). */
const EPSG_GK_BY_ZONE = {
	2: 31466, // GK Zone 2 (6°E)
	3: 31467, // GK Zone 3 (9°E)
	4: 31468, // GK Zone 4 (12°E)
	5: 31469, // GK Zone 5 (15°E)
};

/** EPSG-Mapping für DBRef (R). */
const EPSG_DBREF_BY_ZONE = {
	2: 5253, // DBRef / 6°
	3: 5254, // DBRef / 9°
	4: 5255, // DBRef / 12°
	5: 5256, // DBRef / 15°
};

/** Lesbare Familiennamen für HSYS. */
const FAMILY_LABEL = {
	A: 'RD83 (Bessel, Rauenberg) – DHDN/GK',
	B: 'PD83 (Bessel, Potsdam) – DHDN/GK',
	C: '42/83 (Krassowski, Pulkowo) – GK',
	S: 'Soldner Netz 88 (Berlin)',
	R: 'DB-Referenzsystem (DBRef)',
};

/**
* Liefert eine konsolidierte CRS-Beschreibung zu einem LSYS.
* @param {string} lsys e.g. "DR0", "DA9", "EB0", "FS9"
* @returns {{
*   ok:boolean,
*   input:string,
*   lsys:{raw:string, meridian:string|null, family:string|null, status:string|null},
*   epsg:number|null,
*   proj4:string|null,
*   name:string,
*   family:string|null,
*   meridian:string|null,
*   status:{code:string|null, meaning:'amtlich'|'gerechnet'|'lokal/projekt'|null},
*   notes:string[]
* }}
*/
export function resolveDbCrs(lsys) {
	const parsed = parseLSYS(lsys);
	const notes = [];
	let epsg = null;
	let proj4 = null;

	// Status interpretieren (3. Zeichen, KEINE geodätische Aussage):
	let statusMeaning = null;
	if (parsed.status === '0') statusMeaning = 'amtlich';           // DB-GIS Hauptsystem
	else if (parsed.status === '9') statusMeaning = 'gerechnet';     // rechnerisch/transformiert
	else if (parsed.status) statusMeaning = 'lokal/projekt';         // projektspez. Variante

	// Abbruch bei unplausiblem LSYS
	if (!parsed.meridian || !parsed.family) {
		notes.push('LSYS konnte nicht interpretiert werden (erwartet Muster: [CDEF][ABCSR][A-Z0-9]).');
		return {
			ok: false,
			input: String(lsys || ''),
			lsys: parsed,
			epsg,
			proj4,
			name: 'Unbekanntes CRS',
			family: parsed.family,
			meridian: parsed.meridian,
			status: { code: parsed.status, meaning: statusMeaning },
			notes,
		};
	}

	const zone = MERIDIAN_TO_ZONE[parsed.meridian];
	const familyLabel = FAMILY_LABEL[parsed.family] || '(unbekannt)';

	// Familien-spezifisches Mapping
	switch (parsed.family) {
		case 'A': // RD83 → DHDN/GK
		case 'B': { // PD83 → DHDN/GK
			epsg = EPSG_GK_BY_ZONE[zone] ?? null;
			// proj4 bewusst nicht „hart“ codiert; EPSG-Resolver im Viewer verwenden
			if (!epsg) notes.push('Zone → EPSG nicht gefunden (unerwartete Meridiankodierung).');
			break;
		}

		case 'R': { // DBRef
			epsg = EPSG_DBREF_BY_ZONE[zone] ?? null;
			if (!epsg) notes.push('DBRef-Zone nicht gefunden.');
			break;
		}

		case 'C': { // 42/83 Pulkowo (GK)
			// In Deutschland historisch/regional – uneinheitliche EPSG-Nutzung.
			// Wir geben bewusst kein EPSG zurück, um Zwangsannahmen zu vermeiden.
			notes.push('42/83 (Pulkowo): kein einheitliches EPSG – proj4/Projektdefinition erforderlich.');
			break;
		}

		case 'S': { // Soldner Netz 88 (Berlin)
			// Lokales System, i.d.R. ohne EPSG; über proj4 zu definieren (Projekt-Registry).
			notes.push('Soldner Netz 88: kein EPSG – proj4/Projektdefinition erforderlich.');
			break;
		}

		default:
		notes.push('Unbekannte Systemfamilie – bitte Projektdefinition ergänzen.');
	}

	const nameParts = [
	'DB LSYS',
	parsed.raw,
	`• ${familyLabel}`,
	`• ${MERIDIAN_LABEL[parsed.meridian]}`,
	statusMeaning ? `• Status: ${statusMeaning}` : '',
	epsg ? `• EPSG:${epsg}` : '',
	].filter(Boolean);

	return {
		ok: true,
		input: String(lsys || ''),
		lsys: parsed,
		epsg,
		proj4, // bewusst leer lassen; falls benötigt, über eine separate proj4-Registry füllen
		name: nameParts.join(' '),
		family: parsed.family,
		meridian: parsed.meridian,
		status: { code: parsed.status, meaning: statusMeaning },
		notes,
	};
}

/**
* Optionale Hilfsfunktion für HSYS (Höhenbezug) – Platzhalter mit einfachen Heuristiken.
* HSYS-Beispiele: V00 (NN/Normalhöhennull alt), R01 (DHHN92), N00 (DHHN2016) – je nach Datenstand.
* Hier bewusst konservativ: nichts „erraten“, sondern Flag + Name liefern.
* @param {string} hsys
* @returns {{ok:boolean,input:string,code:string|null,name:string,epsg:number|null,notes:string[]}}
*/
export function resolveDbHeight(hsys) {
	const raw = String(hsys || '').trim().toUpperCase();
	const notes = [];
	if (!raw) return { ok: false, input: raw, code: null, name: 'Unbekannt', epsg: null, notes };

	// Sehr grobe, nicht-bindende Hinweise (können projektspezifisch überschrieben werden)
	let name = 'Unbekanntes Höhensystem';
	let epsg = null;

	if (/^V00$/.test(raw)) { name = 'NN / NHN (historisch angegeben)'; }
	else if (/^R0[1-9]$/.test(raw)) { name = 'DHHN92 (heuristisch)'; }
	else if (/^N0[0-9]$/.test(raw)) { name = 'DHHN2016 (heuristisch)'; }

	notes.push('HSYS-Mapping ist projektspezifisch – bitte bei Bedarf in einer Projekt-Registry präzisieren.');

	return { ok: true, input: raw, code: raw, name, epsg, notes };
}

/** Kompat-Wrapper für ältere Aufrufe / Konsolen-Tests. */
export function getDbCrsInfo(code) {
  return resolveDbCrs(code);
}

// Optionaler Barrel-Export, falls du später weitere Maps/Funktionen bündeln willst:
export default {
  parseLSYS,
  resolveDbCrs,
  resolveDbHeight,
  getDbCrsInfo,
};
