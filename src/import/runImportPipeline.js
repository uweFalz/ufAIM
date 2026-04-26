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

export async function runImportPipeline(file, context = {}) {
	const log = typeof context.log === "function" ? context.log : () => {};

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

		console.log("[runImportPipeline] parsed shape", {
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

			console.log("[runImportPipeline] fatValidation", fatValidation);

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

		console.log("[runImportPipeline] import result", {
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
		console.error("[runImportPipeline] CATCH", {
			fileName: file?.name ?? null,
			message: err?.message ?? String(err),
			stack: err?.stack ?? null,
			err,
		});

		log(
			`import failed: ${file?.name ?? "(unknown file)"} :: ` +
			`${err?.code ?? "ERR"} :: ${err?.message ?? String(err)}`
		);

		return {
			ok: false,
			status: "invalid",
			reason: err?.code ?? "import-failed",
			meta: null,
			errors: [String(err?.message ?? err)],
			warnings: [],
			items: [],
			rejected: [],
			relationCandidates: [],
		};
	}
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
