// src/domain/coordinates/crsAlias.js

// Minimaler Alias-Katalog. Ergänze ihn, sobald du die DB-Richtlinie griffbereit hast.
export const CRS_ALIAS_LSYS = {
	// DB-intern (Planhorizont / Lage)
	// Beispiele/Platzhalter – bitte mit echten Bedeutungen hinterlegen:
	'CR0': 'DBREF:CR0',   // z.B. DB-Referenzlokal (Platzhalter)
	'DA9': 'DBREF:DA9',

	// Gängige Kürzel:
	'WGS84':    'EPSG:4326',
	'UTM32':    'EPSG:25832', // ETRS89 / UTM Zone 32N
	'UTM33':    'EPSG:25833', // ETRS89 / UTM Zone 33N
	'GK3':      'EPSG:31467', // DHDN / 3-degree Gauss-Krüger zone 3
	'GK4':      'EPSG:31468', // DHDN / 3-degree Gauss-Krüger zone 4
	'ETRS89_32':'EPSG:25832',
	'ETRS89_33':'EPSG:25833',
};

export const CRS_ALIAS_HSYS = {
	// DB-intern (Höhenbezug)
	'V00': 'DBREF:V00',   // Platzhalter
	'R01': 'DBREF:R01',
	'N00': 'DBREF:N00',

	// Gängige Höhensysteme:
	'DHHN92': 'EPSG:5783',
	'DHHN2016': 'EPSG:7837',
};

// Fallbacks, falls „LFREMD/HFREMD“ schon EPSG:-Strings enthalten.
export function coalesceToEpsg(str) {
	if (!str) return null;
	const t = String(str).trim().toUpperCase();
	if (t.startsWith('EPSG:')) return t;
	return null;
}
