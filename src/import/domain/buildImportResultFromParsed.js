// src/import/domain/buildImportResultFromParsed.js

import { buildAlignmentImportOutcome } from "./buildAlignmentImportOutcome.js";
import { collectLandFatProfilesAndCants } from "./collectLandFatProfilesAndCants.js";
import { makeWorkingItem } from "./importItemFactories.js";

// -----------------------------------------------------------------------------

const DEBUG_IMPORT_DETAILS = false;
const DEBUG_IMPORT_FLOW = false;

export function buildImportResultFromParsed(imported, context = {}) {
	const log = typeof context.log === "function" ? context.log : () => {};

	const fileName = context.file?.name ?? null;
	const sourceFormat = context.parserMeta?.id ?? context.parserId ?? "unknown";

	if (DEBUG_IMPORT_FLOW) {
		log(`importResult sourceFormat=${sourceFormat}`);
		log(`importResult raw keys=${Object.keys(imported ?? {}).join(",")}`);
	}

	// -------------------------------------------------------------------------
	// empty / null
	// -------------------------------------------------------------------------

	if (imported == null) {
		log(`parsed result empty: ${fileName ?? "(unknown file)"}`);
		return {
			isEmpty: true,
			reason: "parsed-empty",
			spotCandidates: [],
			workingItems: [],
			referenceItems: [],
		};
	}

	// -------------------------------------------------------------------------
	// legacy single object (.kind)
	// -------------------------------------------------------------------------

	if (imported && imported.kind) {
		log(`legacy parsed single object currently unsupported: kind=${imported.kind}`);

		return {
			isEmpty: false,
			reason: "legacy-single-object-unsupported",
			spotCandidates: [],
			workingItems: [
			makeWorkingItem({
				kind: imported.kind,
				name: imported.name ?? fileName ?? "import",
				sourceFormat,
				sourceFile: fileName,
				payload: imported,
			}),
			],
			referenceItems: [],
		};
	}

	// -------------------------------------------------------------------------
	// landFAT container
	// -------------------------------------------------------------------------

	if (imported?.type === "landFAT") {
		const alignments = Array.isArray(imported.alignments) ? imported.alignments : [];
		const profiles = Array.isArray(imported.profiles) ? imported.profiles : [];
		const cants = Array.isArray(imported.cants) ? imported.cants : [];

		if (DEBUG_IMPORT_FLOW) {
			log(
			`parsed landFAT container: ` +
			`alignments=${alignments.length} ` +
			`profiles=${profiles.length} ` +
			`cants=${cants.length}`
			);
		}

		if (!alignments.length && !profiles.length && !cants.length) {
			return {
				isEmpty: true,
				reason: "no-items-in-container",
				spotCandidates: [],
				workingItems: [],
				referenceItems: [],
			};
		}

		const sourceFile = imported?.meta?.sourceFile ?? fileName ?? null;
		const spotCandidates = [];
		const workingItems = [];

		for (const [index, alignment] of alignments.entries()) {
			const outcome = buildAlignmentImportOutcome({
				alignment,
				index,
				imported,
				sourceFormat,
				sourceFile,
				log,
			});

			if (outcome?.spotCandidate) {
				spotCandidates.push(outcome.spotCandidate);
			}

			if (outcome?.workingItem) {
				workingItems.push(outcome.workingItem);
			}
		}

		workingItems.push(
		...collectLandFatProfilesAndCants({
			alignments,
			profiles,
			cants,
			sourceFormat,
			sourceFile,
			log,
		})
		);

		return {
			isEmpty: false,
			reason: null,
			spotCandidates,
			workingItems,
			referenceItems: [],
		};
	}

	throw new Error(`Unsupported parsed result shape: ${fileName ?? "(unknown file)"}`);
}
