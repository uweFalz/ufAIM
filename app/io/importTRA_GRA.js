// app/io/importTRA_GRA.js

function extOf(name = "") {
	const m = /\.([a-z0-9]+)$/i.exec(name.trim());
	return m ? m[1].toLowerCase() : "";
}

export async function importFileAuto(file) {
	const name = file?.name ?? "unnamed";
	const ext = extOf(name);

	if (ext === "tra" || ext === "gra") {
		const buf = await file.arrayBuffer();
		if (ext === "tra") return importTRA_bin({ name, buf });
		if (ext === "gra") return importGRA_bin({ name, buf });
	}

	// fallback for text-ish
	const text = await file.text();
	return {
		kind: "unknown",
		name,
		meta: { ext },
		raw: text.slice(0, 2000)
	};
}

const TRA_BYTE_LAYOUT = [
{ name: "radiusA",        offSet: 0,  bytes: 8 },
{ name: "radiusE",        offSet: 8,  bytes: 8 },
{ name: "easting",        offSet: 16, bytes: 8 },
{ name: "northing",       offSet: 24, bytes: 8 },
{ name: "direction",      offSet: 32, bytes: 8 },
{ name: "station",        offSet: 40, bytes: 8 },
{ name: "elementType",    offSet: 48, bytes: 2 },
{ name: "arclength",      offSet: 50, bytes: 8 },
{ name: "cantA",          offSet: 58, bytes: 8 },
{ name: "cantE",          offSet: 66, bytes: 8 },
{ name: "pointKeyNumber", offSet: 74, bytes: 4 }
];
const traCycle = TRA_BYTE_LAYOUT.reduce((s, e) => s + e.bytes, 0);

const GRA_BYTE_LAYOUT = [
{ name: "station",     offSet: 0,  bytes: 8 },
{ name: "height",      offSet: 8,  bytes: 8 },
{ name: "radius",      offSet: 16, bytes: 8 },
{ name: "tangentL",    offSet: 24, bytes: 8 },
{ name: "pointNumber", offSet: 32, bytes: 2 },
{ name: "pointKey",    offSet: 34, bytes: 2 }
];
const graCycle = GRA_BYTE_LAYOUT.reduce((s, e) => s + e.bytes, 0);

function getValueFromHex(dv, base, entry) {
	const off = base + entry.offSet;
	switch (entry.bytes) {
		case 2: return dv.getUint16(off, true);
		case 4: return dv.getFloat32(off, true);
		default: return dv.getFloat64(off, true);
	}
}

function sanitizeHeader(str) {
	if (!str) return "";
	let printable = 0, total = 0;
	for (let i = 0; i < str.length; i++) {
		const c = str.charCodeAt(i);
		if ((c >= 32 && c <= 126) || c === 9) printable++;
		total++;
	}
	if (!total || printable / total < 0.7) return "";
	return str.trim();
}

function parseTraBuffer(arrayBuffer) {
	const dv = new DataView(arrayBuffer);
	const len = dv.byteLength;

	// header (best effort)
	const headerChars = [];
	for (let off = 0; off < traCycle && off < len; off += 2) {
		headerChars.push(String.fromCharCode(dv.getUint8(off)));
	}
	const header = sanitizeHeader(headerChars.join(""));

	const elements = [];
	for (let idx = traCycle; idx + traCycle <= len; idx += traCycle) {
		const row = [];
		for (const entry of TRA_BYTE_LAYOUT) row.push(getValueFromHex(dv, idx, entry));

		const el = {
			radiusAorBeta: row[0],
			radiusE: row[1],
			easting: row[2],
			northing: row[3],
			directionRad: row[4],
			station: row[5],
			type: row[6],
			arcLength: row[7],
			cantA: row[8],
			cantE: row[9],
			pointNumber: row[10]
		};

		el.directionGon = (el.directionRad / Math.PI) * 200.0;
		elements.push(el);
	}

	return { header, elements };
}

function parseGraBuffer(arrayBuffer) {
	const dv = new DataView(arrayBuffer);
	const len = dv.byteLength;

	const headerChars = [];
	for (let off = 0; off < graCycle && off < len; off += 2) {
		headerChars.push(String.fromCharCode(dv.getUint8(off)));
	}
	const header = sanitizeHeader(headerChars.join(""));

	const elements = [];
	for (let idx = graCycle; idx + graCycle <= len; idx += graCycle) {
		const row = [];
		for (const entry of GRA_BYTE_LAYOUT) row.push(getValueFromHex(dv, idx, entry));
		elements.push({
			station: row[0],
			height: row[1],
			radius: row[2],
			tangentL: row[3],
			pointNr: row[4],
			pointKey: row[5]
		});
	}

	return { header, elements };
}

export function importTRA_bin({ name, buf }) {
	const parsed = parseTraBuffer(buf);

	// minimal: polyline from element start points
	const pts = parsed.elements
	.map(e => ({ x: e.easting, y: e.northing }))
	.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

console.log( pts );

	return {
		kind: "TRA",
		name,
		meta: {
			bytes: buf.byteLength,
			header: parsed.header || null,
			elements: parsed.elements.length,
			points: pts.length
		},
		geometry: pts.length ? { type: "polyline", pts } : null,
		_parsed: parsed
	};
}

export function importGRA_bin({ name, buf }) {
	const parsed = parseGraBuffer(buf);

	return {
		kind: "GRA",
		name,
		meta: {
			bytes: buf.byteLength,
			header: parsed.header || null,
			elements: parsed.elements.length
		},
		profile: { type: "gra-raw", elements: parsed.elements },
		_parsed: parsed
	};
}
