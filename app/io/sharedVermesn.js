// Gemeinsame Utilities für Verm.ESN-Formate (TRA/GRA)
// - Robuster Binärdecoder (little-endian, fixes Cycle-Size)
// - Defensive Checks (Ausrutscher / Padding / Restbytes)
// - Einfache Zeit-/Datei-Metadaten

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
