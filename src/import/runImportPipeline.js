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
// - transform into importResult (spotCandidates, workingItems, referenceItems)
//
// NOT:
// - no UI
// - no SPOT interaction
// - no rendering / preview
// - no global state mutation
//
// Output contract:
// {
//   spotCandidates: [],
//   workingItems: [],
//   referenceItems: []
// }
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
				status: "unknown",
				reason: sniff?.reason ?? "unknown format",
				spotCandidates: [],
				workingItems: [],
				referenceItems: [],
			};
		}

		const parserId = sniff.parserId;
		const parser = await loadParserModule(parserId);
		validateParserModule(parserId, parser);

		log(`import: ${parser.meta?.label ?? parserId} :: ${file.name}`);

		const fat = await parser.parse({
			file,
			context: { ...context, log, sniff, parserId },
		});

		log(`parse ok: ${file.name}`);

		const fatValidation = validateLandFAT(fat);

		if (!fatValidation?.ok) {
			const err = new Error(`validateLandFAT failed: ${file?.name ?? "(unknown file)"}`);
			err.code = "LAND_FAT_INVALID";
			err.validation = fatValidation;
			throw err;
		}

		log(`validateLandFAT ok: ${file.name}`);

		const result = buildImportResultFromParsed(fat, {
			log,
			file,
			sniff,
			parserId,
			parserMeta: parser.meta ?? null,
		});

		log(
			`result ok: ${file.name} :: ` +
			`spot=${result?.spotCandidates?.length ?? 0} ` +
			`working=${result?.workingItems?.length ?? 0} ` +
			`ref=${result?.referenceItems?.length ?? 0}`
		);

		return result;
	} catch (err) {
		log(
			`import failed: ${file?.name ?? "(unknown file)"} :: ` +
			`${err?.code ?? "ERR"} :: ${err?.message ?? String(err)}`
		);

		if (err?.validation?.errors?.length) {
			for (const e of err.validation.errors.slice(0, 10)) {
				log(`  validation error: ${e}`);
			}
		}

		if (err?.validation?.warnings?.length) {
			for (const w of err.validation.warnings.slice(0, 10)) {
				log(`  validation warning: ${w}`);
			}
		}

		throw err;
	}
}
