const cellState = (value) => value === 0 ? "zero" : value == null ? "blank" : "value";

export const stationRow = (ordinal, values) => ({
	ordinal,
	cells: Object.entries(values).map(([columnName, value]) => ({
		columnName,
		state: cellState(value),
		value,
	})),
});

export const stationTable = (name, rows) => ({ name, rows });

function type6Envelope({
	fingerprint,
	directionCode,
	startAddress,
	endAddress,
	parameter1,
}) {
	return {
		source: {
			sha256: fingerprint,
			fileName: `${fingerprint}.synthetic.mdb`,
			format: "public-synthetic-gnd",
		},
		tables: [
			stationTable("X_ASC11_PP", [
				stationRow(1, { PAD: "PAD-A", PSTRECKE: 1720, PSTRRIKZ: directionCode, STATION: 59123 }),
				stationRow(2, { PAD: "PAD-B", PSTRECKE: 1720, PSTRRIKZ: directionCode, STATION: 59123 }),
			]),
			stationTable("X_ASC24_EK", [
				stationRow(7, {
					PAD1: "PAD-A",
					PAD2: "PAD-B",
					EKSYS: "DB_REF",
					EKTYP: 6,
					EKPAR1: parameter1,
					EKAKM: startAddress,
					EKEKM: endAddress,
				}),
			]),
		],
	};
}

export const positiveType6Jump = Object.freeze({
	name: "positive type-6 source claim",
	sourceEnvelope: type6Envelope({
		fingerprint: "public-positive-type6",
		directionCode: 1,
		startAddress: 596000,
		endAddress: 596187,
		parameter1: 42,
	}),
});

export const rawDeltaIndependentOfEkpar1 = Object.freeze({
	name: "raw address delta differs from EKPAR1",
	sourceEnvelope: type6Envelope({
		fingerprint: "public-delta-independent",
		directionCode: 1,
		startAddress: 596187,
		endAddress: 596000,
		parameter1: -200,
	}),
});

export const ppCode4LocalPreserveOnly = Object.freeze({
	name: "PP direction code 4 is local source context",
	sourceEnvelope: type6Envelope({
		fingerprint: "public-pp-code4",
		directionCode: 4,
		startAddress: 596000,
		endAddress: 596187,
		parameter1: 187,
	}),
});

export const ppCode5UnknownFailClosed = Object.freeze({
	name: "unknown PP direction code 5",
	sourceEnvelope: type6Envelope({
		fingerprint: "public-pp-code5",
		directionCode: 5,
		startAddress: 596000,
		endAddress: 596187,
		parameter1: 187,
	}),
});

