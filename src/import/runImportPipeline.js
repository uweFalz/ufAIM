// src/import/runImportPipeline.js
//
// runImportPipeline
//
// Pure import pipeline (format → landFAT → importResult).
//
// Responsibilities:
// - sniff file format
// - load and validate parser
// - parse into landFAT
// - validate landFAT structure
// - transform into canonical importResult
//
// NOT:
// - no UI
// - no SPOT interaction
// - no rendering / preview
// - no global state mutation
//
// Rule:
// This is a pure function boundary.
// Side effects start only after this step.
//

import { sniffImportFile } from "./sniffers/sniffImportFile.js";
import { loadParserModule } from "./parsers/parserRegistry.js";
import { validateParserModule } from "./parsers/validateParserModule.js";
import { validateLandFAT } from "@kimport/landfat/validateLandFAT.js";
import { buildImportResultFromParsed } from "./build/buildImportResultFromParsed.js";
import { applyImportTruthfulnessEligibility } from "./evidence/applyImportTruthfulnessEligibility.js";
import { assessGndReferenceEvidence } from "./evidence/assessGndReferenceEvidence.js";

export async function runImportPipeline(file, context = {}) {
	const log = typeof context.log === "function" ? context.log : () => {};
	const trace = context.trace === true || globalThis.__ufAIM_importTrace === true;

	try {
		const sniff = await sniffImportFile(file, { log, ...context });

		if (!sniff?.ok || !sniff?.parserId) {
			log(`import unknown: ${file?.name ?? "(unknown file)"} :: ${sniff?.reason ?? "sniff not ok"}`);
			return {
				ok: false,
				status: "unknown",
				reason: sniff?.reason ?? "no parser matched",
				meta: null,
				items: [],
				rejected: [],
				relationCandidates: [],
			};
		}

		const parserId = sniff.parserId;
		const parser = await loadParserModule(parserId);
		validateParserModule(parserId, parser);

		log(`import: ${parser.meta?.label ?? parserId} :: ${file?.name ?? "(unknown file)"}`);

		const parsed = await parser.parse({
			file,
			context: { ...context, log, sniff, parserId },
		});

		log(`parse ok: ${file?.name ?? "(unknown file)"}`);

		if (trace) console.debug("[runImportPipeline] parsed shape", {
			fileName: file?.name ?? null,
			isObject: isObject(parsed),
			type: parsed?.type ?? null,
			keys: isObject(parsed) ? Object.keys(parsed) : null,
			alignments: Array.isArray(parsed?.alignments) ? parsed.alignments.length : null,
			profiles: Array.isArray(parsed?.profiles) ? parsed.profiles.length : null,
			cants: Array.isArray(parsed?.cants) ? parsed.cants.length : null,
		});

		if (parsed?.type === "landFAT") {
			const fatValidation = validateLandFAT(parsed);

			if (trace) console.debug("[runImportPipeline] fatValidation", fatValidation);

			if (!fatValidation?.ok) {
				console.warn("[runImportPipeline] validateLandFAT FAILED", {
					fileName: file?.name ?? null,
					errors: fatValidation?.errors ?? [],
					warnings: fatValidation?.warnings ?? [],
					parsed,
				});

				log(`import invalid: ${file?.name ?? "(unknown file)"} :: landFAT invalid`);

				return {
					ok: false,
					status: "invalid",
					reason: "invalid-landfat",
					meta: {
						sourceFormat: parserId,
						fileName: file?.name ?? null,
						containerType: parsed?.type ?? null,
					},
					errors: fatValidation?.errors ?? [],
					warnings: fatValidation?.warnings ?? [],
					items: [],
					rejected: [],
					relationCandidates: [],
				};
			}

			log(`validateLandFAT ok: ${file?.name ?? "(unknown file)"}`);
		}

		const source = {
			fileName: file?.name ?? null,
			file: file?.name ?? null,
			parserId,
			format: parserId,
		};

		const result = buildImportResultFromParsed({
			parsed,
			source,
		});
		result.meta = {
			...(result?.meta ?? {}),
			diagnostics: Array.isArray(parsed?.meta?.diagnostics)
				? parsed.meta.diagnostics
				: Array.isArray(parsed?.extras?.diagnostics) ? parsed.extras.diagnostics : [],
		};
		const sourceEnvelope = parsed?.meta?.sourceEnvelope ?? null;
		if (sourceEnvelope) {
			result.sourceEnvelope = sourceEnvelope;
		}
		const referenceEvidence = assessGndReferenceEvidence({ result, parsed, sourceEnvelope });
		result.meta.referenceEvidence = referenceEvidence;
		applyImportTruthfulnessEligibility(result, referenceEvidence);
		if (sourceEnvelope) result.meta.gndSource = summarizeGndSource(sourceEnvelope, result);

		for (const diagnostic of result?.meta?.diagnostics ?? []) {
			log(
				`GND ${diagnostic.severity ?? "warning"} ${diagnostic.code ?? "diagnostic"}: ` +
				`${diagnostic.family ?? "?"} ${diagnostic.rowRef ?? ""} ${diagnostic.field ?? ""} ` +
				`→ ${diagnostic.decision ?? "retained"}`
			);
		}

		if (trace) console.debug("[runImportPipeline] import result", {
			fileName: file?.name ?? null,
			status: result?.status ?? null,
			reason: result?.reason ?? null,
			meta: result?.meta ?? null,
			items: Array.isArray(result?.items) ? result.items.length : null,
			rejected: Array.isArray(result?.rejected) ? result.rejected.length : null,
			relationCandidates: Array.isArray(result?.relationCandidates)
				? result.relationCandidates.length
				: null,
		});

		log(
			`result ${result?.status ?? "unknown"}: ${file?.name ?? "(unknown file)"} :: ` +
			`items=${result?.items?.length ?? 0} ` +
			`rejected=${result?.rejected?.length ?? 0}`
		);

		return result;
	} catch (err) {
		const sourceEnvelope = err?.sourceEnvelope ?? null;
		console.warn("[runImportPipeline] rejected", {
			fileName: file?.name ?? null,
			code: err?.code ?? "import-failed",
			message: err?.message ?? String(err),
		});

		log(
			`import failed: ${file?.name ?? "(unknown file)"} :: ` +
			`${err?.code ?? "ERR"} :: ${err?.message ?? String(err)}`
		);

		return {
			ok: false,
			status: "invalid",
			reason: err?.code ?? "import-failed",
			meta: sourceEnvelope ? {
				gndSource: summarizeGndSource(sourceEnvelope, { ok: false, items: [] }),
				diagnostics: err?.diagnostics ?? sourceEnvelope.diagnostics ?? [],
			} : null,
			sourceEnvelope,
			errors: [String(err?.message ?? err)],
			warnings: [],
			items: [],
			rejected: [],
			relationCandidates: [],
		};
	}
}

function summarizeGndSource(envelope, result) {
	const core = (envelope.inventory ?? []).filter((table) => table.interpreted).map((table) => table.name);
	const additional = (envelope.inventory ?? []).filter((table) => !table.interpreted).map((table) => table.name);
	return {
		originalFile: envelope.source.fileName,
		sha256: envelope.source.sha256,
		container: envelope.source.container,
		format: envelope.source.format,
		extractor: envelope.extractor,
		coreTables: core,
		additionalTables: additional,
		warnings: (envelope.diagnostics ?? []).map(({ code, table, field, rowOrdinal }) => ({ code, table, field, rowOrdinal })),
		retainedEvidenceCount: (envelope.tables ?? []).reduce((sum, table) => sum + table.rows.length, 0),
		status: result?.items?.some((item) => item?.status?.promotable) ? "constructive" : result?.ok === false ? "rejected" : "unresolved",
	};
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
