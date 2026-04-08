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
import { buildImportResultFromParsed } from "./domain/buildImportResultFromParsed.js";

const DEBUG_IMPORT_FLOW = false;

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

		if (DEBUG_IMPORT_FLOW) {
			console.error("PIPE BEFORE VALIDATE:", {
				file: file?.name ?? null,
				parserId,
				sniff,
				parsedType: parsed?.type ?? null,
				parsedKeys: parsed && typeof parsed === "object" ? Object.keys(parsed) : null,
				parsed,
			});
		}

		log(`parse ok: ${file?.name ?? "(unknown file)"}`);

		const fatValidation = validateLandFAT(parsed);

		if (!fatValidation?.ok) {
			const err = new Error(`validateLandFAT failed: ${file?.name ?? "(unknown file)"}`);
			err.code = "LAND_FAT_INVALID";
			err.validation = fatValidation;
			throw err;
		}

		log(`validateLandFAT ok: ${file?.name ?? "(unknown file)"}`);

		const source = {
			fileName: file?.name ?? null,
			file: file?.name ?? null,
			parserId,
			format: parserId,
		};

		if (DEBUG_IMPORT_FLOW) {
			console.error("PIPE BEFORE BUILD:", {
				file: file?.name ?? null,
				parserId,
				sniff,
				source,
				parsedType: parsed?.type ?? null,
				parsedKeys: parsed && typeof parsed === "object" ? Object.keys(parsed) : null,
			});
		}

		const result = buildImportResultFromParsed({
			parsed,
			source,
		});

		log(
			`result ok: ${file?.name ?? "(unknown file)"} :: ` +
			`items=${result?.items?.length ?? 0} ` +
			`rejected=${result?.rejected?.length ?? 0}`
		);

		return result;
	} catch (err) {
		log(
			`import failed: ${file?.name ?? "(unknown file)"} :: ` +
			`${err?.code ?? "ERR"} :: ${err?.message ?? String(err)}`
		);

		if (err?.validation?.errors?.length) {
			for (const e of err.validation.errors.slice(0, 10)) {
				log(`  validation error: ${typeof e === "string" ? e : JSON.stringify(e)}`);
			}
		}

		if (err?.validation?.warnings?.length) {
			for (const w of err.validation.warnings.slice(0, 10)) {
				log(`  validation warning: ${typeof w === "string" ? w : JSON.stringify(w)}`);
			}
		}

		throw err;
	}
}
