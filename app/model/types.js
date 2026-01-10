// app/model/types.js (oder einfach als Kommentar-Contract)
SevenLineSet = {
	id, name, source, crs,
	kmLine: { horizontals, outerStationing },
	right: [Track], left: [Track], other: [],
	meta: { kind, internalStaRange, header, ... }
}

Track = {
	id, name, crsCode,
	horizontals: { id, segments, padSequence } | null,
	verticals: [], cants: [],
	meta: { stationRange, ... }
}
