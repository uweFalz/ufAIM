// src/import/runImportPipeline.js

import { sniffImportFile } from "./sniffers/sniffImportFile.js";
import { loadParserModule } from "./parsers/parserRegistry.js";
import { validateParserModule } from "./parsers/validateParserModule.js";
import { validateLandFAT } from "@kimport/landfat/validateLandFAT.js";
import { buildImportResultFromParsed } from "./domain/buildImportResultFromParsed.js";

export async function runImportPipeline(file, context = {}) {
	const log = typeof context.log === "function" ? context.log : () => {};

	const sniff = await sniffImportFile(file, { log, ...context });
	log(`sniff: ${JSON.stringify(sniff ?? null)}`);

	if (!sniff?.ok || !sniff?.parserId) {
		return {
			status: "unknown",
			spotCandidates: [],
			workingItems: [],
			referenceItems: [],
		};
	}

	const parserId = sniff.parserId;
	const parser = await loadParserModule(parserId);
	validateParserModule(parserId, parser);

	log(`import: ${parser.meta?.label ?? parserId} :: ${file.name}`);

	const raw = await parser.parse({
		file,
		context: { ...context, log, sniff, parserId }
	});

	log(`raw keys: ${Object.keys(raw ?? {}).join(",")}`);
	
	validateLandFAT(raw);   // <-- hier

	return buildImportResultFromParsed(raw, {
		log,
		file,
		sniff,
		parserId,
		parserMeta: parser.meta ?? null,
	});
}
