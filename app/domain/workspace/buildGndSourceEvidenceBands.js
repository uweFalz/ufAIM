const FAMILY = Object.freeze({ profile: "EH", cant: "EU" });

export function buildGndSourceEvidenceBands(record) {
	const attachments = Array.isArray(record?.unresolvedEvidence) ? record.unresolvedEvidence : [];
	return Object.freeze(["profile", "cant"].map((kind) => {
		const family = FAMILY[kind];
		const relevant = attachments.filter((entry) => entry?.kind === kind);
		const band = buildBand(kind, relevant);
		return band.segments.length ? band : buildBand(kind, sourceEnvelopeAttachments(record, kind, family));
	}));
}

function buildBand(kind, attachments) {
	const family = FAMILY[kind];
	const segments = [];
	let offset = 0;
	for (const attachment of attachments) {
		for (const source of Array.isArray(attachment?.sourceElements) ? attachment.sourceElements : []) {
			const parameters = source?.parameters ?? {};
			const length = finite(parameters[`${family}PAR1`]);
			const startValue = finite(parameters[`${family}PAR2`]);
			const endValue = finite(parameters[`${family}PAR3`]);
			const drawable = length != null && length >= 0 && startValue != null && endValue != null;
			segments.push(Object.freeze({
				family,
				rowRef: source?.rowRef ?? null,
				typeCode: finite(source?.typeCode),
				padStart: source?.padStart ?? attachment?.padStart ?? null,
				padEnd: source?.padEnd ?? attachment?.padEnd ?? null,
				attachmentStatus: attachment?.attachmentStatus ?? attachment?.status ?? "unresolved",
				length,
				startS: drawable ? offset : null,
				endS: drawable ? offset + length : null,
				startValue,
				endValue,
				drawable,
			}));
			if (drawable) offset += length;
		}
	}
	return Object.freeze({
		kind,
		family,
		valueUnit: kind === "profile" ? "‰ (Quellgradient)" : "m (Quellüberhöhung)",
		interpretation: "source-evidence-only",
		segments: Object.freeze(segments),
		drawableSegments: Object.freeze(segments.filter((entry) => entry.drawable)),
	});
}

function sourceEnvelopeAttachments(record, kind, family) {
	const tables = Array.isArray(record?.sourceEnvelope?.tables) ? record.sourceEnvelope.tables : [];
	const sourceElements = [];
	for (const table of tables.filter((entry) => new RegExp(`(?:^|_)${family}$`, "i").test(String(entry?.name ?? "")))) {
		for (const row of Array.isArray(table?.rows) ? table.rows : []) {
			const values = Object.fromEntries((Array.isArray(row?.cells) ? row.cells : [])
				.filter((cell) => !["absent", "unreadable"].includes(cell?.state))
				.map((cell) => [cell.columnName, cell.value]));
			sourceElements.push({
				family,
				rowRef: `${table.name}:${row?.ordinal ?? "?"}`,
				typeCode: finite(values[`${family}TYP`]),
				padStart: values.PAD1 ?? null,
				padEnd: values.PAD2 ?? null,
				parameters: {
					[`${family}PAR1`]: finite(values[`${family}PAR1`]),
					[`${family}PAR2`]: finite(values[`${family}PAR2`]),
					[`${family}PAR3`]: finite(values[`${family}PAR3`]),
					[`${family}PAR4`]: finite(values[`${family}PAR4`]),
				},
			});
		}
	}
	if (!sourceElements.length) return [];
	return [{
		kind,
		attachmentStatus: diagnosticAttachmentStatus(record, family),
		sourceElements,
	}];
}

function diagnosticAttachmentStatus(record, family) {
	const codes = (Array.isArray(record?.diagnostics) ? record.diagnostics : [])
		.filter((entry) => entry?.family === family)
		.map((entry) => String(entry?.code ?? ""));
	if (codes.some((code) => code.includes("ambiguous"))) return "ambiguous-unattached";
	if (codes.some((code) => code.includes("rejected"))) return "rejected-unattached";
	return "source-envelope · Zuordnung nicht bestätigt";
}

function finite(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export default buildGndSourceEvidenceBands;
