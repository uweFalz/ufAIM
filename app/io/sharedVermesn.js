// app/io/sharedVermesn.js
//
// Gemeinsame Utilities für Verm.ESN-Formate (TRA/GRA)
// - Robuster Binärdecoder (little-endian, fixes Cycle-Size)
// - Defensive Checks (Ausrutscher / Padding / Restbytes)
// - Einfache Zeit-/Datei-Metadaten

/* *********************************************************************************************************

Speicherformat der Trassen (Endung .TRA)

Datensatz RANDOM-Format
TYPE TrassenTyp
R1 AS DOUBLE '64 Bit IEEE-Format Radius am Elementanfang
R2 AS DOUBLE '64 Bit IEEE-Format Radius am Elementende
Y AS DOUBLE '64 Bit IEEE-Format Rechtswert am Elementanfang
X AS DOUBLE '64 Bit IEEE-Format Hochwert am Elementanfang
T AS DOUBLE '64 Bit IEEE-Format Richtung am Elementanfang
S AS DOUBLE '64 Bit IEEE-Format Station am Elementanfang
Kz AS INTEGER '16 Bit Kennzeichen des Elementes
L AS DOUBLE '64 Bit IEEE-Format Länge des Elementes
U1 AS DOUBLE '64 Bit IEEE-Format Überhöhung am Elementanfang
U2 AS DOUBLE '64 Bit IEEE-Format Überhöhung am Elementanfang
C AS SINGLE '32 Bit IEEE-Format Abstand zur Trasse,i.d.R. 0 nur für Parallelübergangsbögen <== changed!!!
END TYPE

Trassenkennzeichen
Kz 0 = Gerade R1=0 R2=0
Kz 1 = Kreis R2=R1
Kz 2 = Klotoide
Kz 3 = ÜB S-Form
Kz 4 = Bloss
Kz 5 = Gerade/Knick	R1=Knickwinkel am Ende der Gerade (199.937-200.063Gon)
Kz 6 = KSprung	L=Überlänge bzw. Fehllänge
Kz 7 = S-Form (1f geschw.)
Kz 8 = Bloss (1f geschw.)

Trasse einlesen
Fvon = 1
GET FFileNum, 1, Tr(0)
FBis = Tr(0).Kz
FOR N = Fvon TO FBis + 1
GET FFileNum, N - Fvon + 2, Tr(N)
NEXT

Datensatz 0:	In Kz steht die Anzahl der Elemente
Datensatz 1:	1 Trassenelement mit Ausgangskoordinaten und Richtung
. . . . .
. . . . .
. . . . .
Datensatz Ende:	letztes Trassenelement mit Anfangskoordinaten
Datensatz Ende+1:	Endkoordinaten des letzten Trassenelements

++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

Speicherformat der Gradienten (Endung .GRA)

Datensatz RANDOM-Format
TYPE GradientenTyp
S AS DOUBLE '64 Bit IEEE-Format Station NW oder Station RE1
H AS DOUBLE '64 Bit IEEE-Format Höhe NW oder Station RA
R AS DOUBLE '64 Bit IEEE-Format Ausrundungsradius oder Station RE2
T AS DOUBLE '64 Bit IEEE-Format Tangentenlänge oder Überhöhung1+Kz
Pkt AS LONG '32 Bit Long Integer Punktnummer *10000 oder Überhöhung2 <== changed!!!
END TYPE

Gleisscheren
Inhalt von Gra(N).S:	Station RE1
Inhalt von Gra(N).H:	Station RA
Inhalt von Gra(N).R:	Station RE2
Inhalt von Gra(N).T:	Überhöhung 1+ Kennzeichen Rampe * 1000
Inhalt von Gra(N).Pkt:	Überhöhung 2 * 10

SELECT CASE Gra(N).T
CASE 3000 TO 3999, 7000 TO 7999: A$ = "geschw. Rampe"
CASE 4000 TO 4999, 8000 TO 8999: A$ = "BLOSS Rampe"
CASE ELSE : A$ = "Gerade Rampe"
END SELECT

Gradiente einlesen
GET FFileNum, 1, Gra(0)
AnzNw = Gra(0).S
AnzScheren = Gra(0).Pkt
FOR N = 1 TO AnzNW + AnzScheren
GET FFileNum, N + 1, Gra(N)
NEXT

Datensatz 0:	In S steht die Anzahl der Neigungswechsel, In Pkt steht die Anzahl der Gleisscheren
Datensatz 1:	1. NW mit Station, Höhe und Punktnummer
. . . . .
. . . . .
. . . . .
Datensatz AnzNW:	letzter Neigungswechsel
Datensatz AnzNW+1:	1. Gleisschere
. . . . .
. . . . .
. . . . .
Datensatz AnzNW+AnzScheren:	letzte Gleisschere

********************************************************************************************************* */

const KENNZEICHEN = {
	"0": "Gerade",
	"1": "Kreis",
	"2": "Klothoide",
	"3": "ÜB S-Form",
	"4": "Bloss",
	"5": "Gerade/Knick",
	"6": "KSprung",
	"7": "S-Form (1f geschw.)",
	"8": "Bloss (1f geschw.)",
};

/*
const DECODE = {
	'u16' : " ",
	'f32' : "  ",
	'f64' : "   ",
};
*/

const technetRANDOM = {
	XXX : {
		CYCLE_SIZE : 123,
		BYTE_LAYOUT : [
		{}, // ...
		{}, // ...
		{}  // ...
		],
	},
	GRA: [
	{ id: 'S',   kind: 'f64', off:  0, bytes: 8 }, // [m] Station NW || Station RE1
	{ id: 'H',   kind: 'f64', off:  8, bytes: 8 }, // [m] Höhe NW || Station RA
	{ id: 'R',   kind: 'f64', off: 16, bytes: 8 }, // [m] Ausrundungsradius || Station RE2
	{ id: 'T',   kind: 'f64', off: 24, bytes: 8 }, // [m] Tangentenlänge || Überhöhung1+Kz
	{ id: 'Nr',  kind: 'u16', off: 32, bytes: 2 }, // [#] Punktnummer *10000 || Überhöhung2
	{ id: 'Key', kind: 'u16', off: 34, bytes: 2 }  // [#] PunktSchlüssel
	],
	TRA: [
	{ id: 'R1', kind: 'f64', off:  0, bytes: 8 }, // [m] Radius am Elementanfang
	{ id: 'R2', kind: 'f64', off:  8, bytes: 8 }, // [m] Radius am Elementende
	{ id: 'Y',  kind: 'f64', off: 16, bytes: 8 }, // [m] Rechtswert am Elementanfang
	{ id: 'X',  kind: 'f64', off: 24, bytes: 8 }, // [m] Hochwert am Elementanfang
	{ id: 'T',  kind: 'f64', off: 32, bytes: 8 }, // [rad] Richtung am Elementanfang
	{ id: 'S',  kind: 'f64', off: 40, bytes: 8 }, // [m] Station am Elementanfang
	{ id: 'Kz', kind: 'u16', off: 48, bytes: 2 }, // [#] Kennzeichen des Elementes
	{ id: 'L',  kind: 'f64', off: 50, bytes: 8 }, // [m] Länge des Elementes
	{ id: 'U1', kind: 'f64', off: 58, bytes: 8 }, // [mm] Überhöhung am Elementanfang
	{ id: 'U2', kind: 'f64', off: 66, bytes: 8 }, // [mm] Überhöhung am Elementanfang
	{ id: 'C',  kind: 'f32', off: 74, bytes: 4 }, // [Key.Nr] changed!!!
	],
};

// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

export const BYTE_LAYOUT = {
	GRA: [
	{ name: 'station',     off:  0, bytes: 8, kind: 'f64' }, // m
	{ name: 'height',      off:  8, bytes: 8, kind: 'f64' }, // m (NW)
	{ name: 'radius',      off: 16, bytes: 8, kind: 'f64' }, // m (Ausrundungsradius)
	{ name: 'tangentL',    off: 24, bytes: 8, kind: 'f64' }, // m (Tangentenlänge der Ausrundung)
	{ name: 'pointNumber', off: 32, bytes: 2, kind: 'u16' }, // #
	{ name: 'pointKey',    off: 34, bytes: 2, kind: 'u16' }, // #
	],
	TRA: [
	{ name: 'radiusAorBeta',  off:  0, bytes: 8, kind: 'f64' }, // m  (radIn) ODER beta [gon], je nach Quelle
	{ name: 'radiusE',        off:  8, bytes: 8, kind: 'f64' }, // m  (radOut)
	{ name: 'easting',        off: 16, bytes: 8, kind: 'f64' }, // m  (X in TRA, aber geodätisch oft Easting)
	{ name: 'northing',       off: 24, bytes: 8, kind: 'f64' }, // m  (Y in TRA, aber geodätisch oft Northing)
	{ name: 'direction',      off: 32, bytes: 8, kind: 'f64' }, // rad, 0 = Nord, CW positiv
	{ name: 'station',        off: 40, bytes: 8, kind: 'f64' }, // m  (km-Stationierung absolut)
	{ name: 'elementType',    off: 48, bytes: 2, kind: 'u16' }, // 0=Line,1=Arc,2=Spiral (heur.)
	{ name: 'arcLength',      off: 50, bytes: 8, kind: 'f64' }, // m
	{ name: 'cantA',          off: 58, bytes: 8, kind: 'f64' }, // mm (am Segmentanfang)
	{ name: 'cantE',          off: 66, bytes: 8, kind: 'f64' }, // mm (am Segmentende)
	{ name: 'pointKeyNumber', off: 74, bytes: 4, kind: 'f32' }, // [key.number] als float
	]
};

const CYCLE_SIZE = {
	GRA: 36,
	TRA: 78
};

function readAt(dv, offset, kind) {
	switch (kind) {
		case 'u16': return dv.getUint16(offset, true);
		case 'f32': return dv.getFloat32(offset, true);
		case 'f64': return dv.getFloat64(offset, true);
		default:    return NaN;
	}
}

export function decodeBinary(buffer, layoutKey) {
	const dv = new DataView(buffer);
	const layout = BYTE_LAYOUT[layoutKey];
	const size = CYCLE_SIZE[layoutKey];

	const total = dv.byteLength;
	const n = Math.floor(total / size);
	const remainder = total - n * size;

	const rowsRaw = new Array(n);
	for (let i = 0; i < n; i++) {
		const pos = i * size;
		const obj = {};
		for (const f of layout) obj[f.name] = readAt(dv, pos + f.off, f.kind);
		rowsRaw[i] = obj;
	}

	return { meta: { byteLength: total, cycleBytes: size, cycles: n, remainderBytes: remainder }, rowsRaw };
}

// Hilfen für Parser-Metadaten
export function baseMetaFromFile(file) {
	return {
		name: file.name,
		size: file.size,
		type: file.type || '(binary)',
		lastModified: file.lastModified
	};
}

// TRA → Standard-Bearing (rad), 0 = Ost, positiv = CCW
// TRA liefert: dirTRA (rad), 0 = Nord, positiv = CW
export function traDir_to_eastCCW(dirTRA) {
	// Ost-CCW = +π/2  -  Nord-CW
	return (Math.PI / 2) - dirTRA;
}
