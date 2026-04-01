// src/import/domain/buildImportResultFromParsed.js

import { buildSparseFromLandFAT } from "./buildSparseFromLandFAT.js";
import { validateSparseAlignment } from "@kernel/validation/validateSparseAlignment.js";
import { classifyAlignmentForSpot } from "./classifyImportResult.js";
import { IMPORT_REASONS } from "./importReasons.js";

const DEBUG_IMPORT_DETAILS = false;

// -----------------------------------------------------------------------------

export function buildImportResultFromParsed(imported, context = {}) {
	const log = typeof context.log === "function" ? context.log : () => {};

	const fileName = context.file?.name ?? null;
	const sourceFormat = context.parserMeta?.id ?? context.parserId ?? "unknown";

	log(`buildImportResultFromParsed sourceFormat: ${sourceFormat}`);
	log(`buildImportResultFromParsed raw keys: ${Object.keys(imported ?? {}).join(",")}`);

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
	// A) legacy single object (.kind)
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
	// B) landFAT container
	// -------------------------------------------------------------------------

	if (imported?.type === "landFAT") {
		const alignments = Array.isArray(imported.alignments) ? imported.alignments : [];
		const profiles = Array.isArray(imported.profiles) ? imported.profiles : [];
		const cants = Array.isArray(imported.cants) ? imported.cants : [];

		log(
			`parsed landFAT container: ` +
			`alignments=${alignments.length} ` +
			`profiles=${profiles.length} ` +
			`cants=${cants.length}`
		);

		if (!alignments.length && !profiles.length && !cants.length) {
			return {
				isEmpty: true,
				reason: "no-items-in-container",
				spotCandidates: [],
				workingItems: [],
				referenceItems: [],
			};
		}

		const spotCandidates = [];
		const workingItems = [];
		const sourceFile = imported?.meta?.sourceFile ?? fileName ?? null;

		const seenProfiles = new Set();
		const seenCants = new Set();

		// ---------------------------------------------------------------------
		// B1) alignments
		// ---------------------------------------------------------------------

		for (const [index, alignment] of alignments.entries()) {
			const name = alignment?.name ?? `alignment_${index + 1}`;

			log(`CHECK alignment.name = ${name}`);

			let sparseValidation = null;

			// -------------------------------------------------------------
			// B1.1 existing sparseAlignment validate
			// -------------------------------------------------------------

			if (alignment?.sparseAlignment) {
				sparseValidation = validateSparse(alignment.sparseAlignment);

				if (!sparseValidation?.ok) {
					log(
						`validateSparse(existing) failed for ${name}: ` +
						`${JSON.stringify(sparseValidation.errors ?? [])}`
					);
					alignment.sparseAlignment = null;
				}
			}

			// -------------------------------------------------------------
			// B1.2 build sparse if missing
			// -------------------------------------------------------------

			if (!alignment?.sparseAlignment) {
				try {
					alignment.sparseAlignment = buildSparseFromLandFAT(alignment);

					if (alignment?.sparseAlignment) {
						sparseValidation = validateSparse(alignment.sparseAlignment);

						if (!sparseValidation?.ok) {
							log(
								`validateSparse(built) failed for ${name}: ` +
								`${JSON.stringify(sparseValidation.errors ?? [])}`
							);
							alignment.sparseAlignment = null;
						}
					}

					if (DEBUG_IMPORT_DETAILS) {
						log(
							`CHECK sparse.startPose = ${
								JSON.stringify(alignment?.sparseAlignment?.startPose ?? null)
							}`
						);
						log(
							`CHECK sparse.count = ${
								Array.isArray(alignment?.sparseAlignment?.sparse)
									? alignment.sparseAlignment.sparse.length
									: null
							}`
						);
					}
				} catch (err) {
					log(`buildSparseFromLandFAT failed for ${name}: ${String(err?.message ?? err)}`);
					log(
						`CHECK FAT.coordGeom.count = ${
							Array.isArray(alignment?.coordGeom?.elements)
								? alignment.coordGeom.elements.length
								: 0
						}`
					);
					alignment.sparseAlignment = null;
				}
			}

			// -------------------------------------------------------------
			// B1.3 classify
			// -------------------------------------------------------------

			const verdict = classifyAlignmentForSpot(alignment, { imported });

			const sparseOk =
				!!alignment?.sparseAlignment &&
				!!alignment?.sparseAlignment?.startPose &&
				Array.isArray(alignment?.sparseAlignment?.sparse) &&
				alignment.sparseAlignment.sparse.length > 0;

			if (sparseOk && verdict?.code === IMPORT_REASONS.SPARSE_BUILD_FAILED) {
				log(`OVERRIDE inconsistent verdict for ${name}: sparse exists`);
				verdict.ok = true;
				verdict.code = "SPARSE_READY";
			}

			const isProblemCase =
				!verdict?.validation?.ok ||
				!sparseOk ||
				verdict?.code !== "SPOT_READY";

			if (isProblemCase) {
				log(
					`alignment[${index}] validation.ok=${!!verdict?.validation?.ok} ` +
					`validation.errors=${verdict?.validation?.errors?.length ?? 0}`
				);

				if (verdict?.validation?.errors?.length) {
					log(`alignment[${index}] validation.detail=${JSON.stringify(verdict.validation.errors)}`);
				}

				log(
					`alignment[${index}] name=${name} ` +
					`sparse=${!!alignment?.sparseAlignment} ` +
					`crs=${JSON.stringify(verdict?.crs ?? null)} ` +
					`verdict=${verdict?.code ?? "UNKNOWN"}`
				);

				if (alignment?.sparseAlignment) {
					if (DEBUG_IMPORT_DETAILS) {
						log(
							`CHECK sparse.startPose = ${
								JSON.stringify(alignment?.sparseAlignment?.startPose ?? null)
							}`
						);
						log(
							`CHECK sparse.count = ${
								Array.isArray(alignment?.sparseAlignment?.sparse)
									? alignment.sparseAlignment.sparse.length
									: null
							}`
						);
					}
				} else {
					log(
						`CHECK FAT.coordGeom.count = ${
							Array.isArray(alignment?.coordGeom?.elements)
								? alignment.coordGeom.elements.length
								: 0
						}`
					);
				}
			}

			// -------------------------------------------------------------
			// B1.4 build spot candidate or working item
			// -------------------------------------------------------------

			if (verdict?.ok) {
				try {
					const candidate = buildAlignmentSpotCandidate({
						alignment,
						fileName: sourceFile,
						sourceFormat,
						fallbackName: name,
						crs: verdict.crs,
						classification: {
							roleCandidate: "unassigned",
							confidence: null,
						},
					});

					if (candidate) {
						log(
							`spotCandidate: ${candidate.kind} :: ${candidate.name}`
						);

						if (DEBUG_IMPORT_DETAILS) {
							log(
								`spotCandidate.detail ${candidate.name}: ` +
								JSON.stringify({
									sparseType: candidate?.payload?.sparseAlignment?.type ?? null,
									sparseCount: candidate?.payload?.sparseAlignment?.sparse?.length ?? 0,
									coordGeomCount: candidate?.payload?.coordGeom?.elements?.length ?? 0,
									hasGeometry: !!candidate?.payload?.geometry,
								})
							);
						}

						spotCandidates.push(candidate);
					}
				} catch (err) {
					log(`spotCandidate build failed for ${name}: ${String(err?.message ?? err)}`);
				}
			} else {
				workingItems.push(
					makeWorkingItem({
						kind: "landFATAlignment",
						name,
						sourceFormat,
						sourceFile,
						payload: alignment,
						meta: {
							alignmentName: alignment?.name ?? null,
							crs: verdict?.crs ?? { status: "needed" },
							giftCabinetReason:
								verdict?.code ?? IMPORT_REASONS.SPARSE_BUILD_FAILED,
						},
					})
				);
			}

			// -------------------------------------------------------------
			// B1a) embedded profile
			// -------------------------------------------------------------

			if (alignment?.profile) {
				const profile = alignment.profile;
				const profileKey =
					profile?.id ??
					`${alignment?.id ?? name}::profile`;

				if (!seenProfiles.has(profileKey)) {
					seenProfiles.add(profileKey);

					const profileName =
						profile?.name ??
						`${name}::profile`;

					log(`alignment[${index}] embedded profile name=${profileName}`);

					workingItems.push(
						makeWorkingItem({
							kind: "landFATProfile",
							name: profileName,
							sourceFormat,
							sourceFile,
							payload: profile,
							meta: {
								profileName: profile?.name ?? null,
								stationReference: profile?.stationReference ?? null,
								embeddedInAlignment: true,
								alignmentName: alignment?.name ?? null,
								alignmentId: alignment?.id ?? null,
							},
						})
					);
				}
			}

			// -------------------------------------------------------------
			// B1b) embedded cant
			// -------------------------------------------------------------

			if (alignment?.cant) {
				const cant = alignment.cant;
				const cantKey =
					cant?.id ??
					`${alignment?.id ?? name}::cant`;

				if (!seenCants.has(cantKey)) {
					seenCants.add(cantKey);

					const cantName =
						cant?.name ??
						`${name}::cant`;

					log(`alignment[${index}] embedded cant name=${cantName}`);

					workingItems.push(
						makeWorkingItem({
							kind: "landFATCant",
							name: cantName,
							sourceFormat,
							sourceFile,
							payload: cant,
							meta: {
								cantName: cant?.name ?? null,
								stationReference: cant?.stationReference ?? null,
								embeddedInAlignment: true,
								alignmentName: alignment?.name ?? null,
								alignmentId: alignment?.id ?? null,
							},
						})
					);
				}
			}
		}

		// ---------------------------------------------------------------------
		// B2) root profiles
		// ---------------------------------------------------------------------

		for (const [index, profile] of profiles.entries()) {
			const name = profile?.name ?? `profile_${index + 1}`;
			const profileKey = profile?.id ?? `rootProfile_${index}`;

			if (seenProfiles.has(profileKey)) continue;
			seenProfiles.add(profileKey);

			log(`profile[${index}] name=${name}`);

			workingItems.push(
				makeWorkingItem({
					kind: "landFATProfile",
					name,
					sourceFormat,
					sourceFile,
					payload: profile,
					meta: {
						profileName: profile?.name ?? null,
						stationReference: profile?.stationReference ?? null,
						embeddedInAlignment: false,
					},
				})
			);
		}

		// ---------------------------------------------------------------------
		// B3) root cants
		// ---------------------------------------------------------------------

		for (const [index, cant] of cants.entries()) {
			const name = cant?.name ?? `cant_${index + 1}`;
			const cantKey = cant?.id ?? `rootCant_${index}`;

			if (seenCants.has(cantKey)) continue;
			seenCants.add(cantKey);

			log(`cant[${index}] name=${name}`);

			workingItems.push(
				makeWorkingItem({
					kind: "landFATCant",
					name,
					sourceFormat,
					sourceFile,
					payload: cant,
					meta: {
						cantName: cant?.name ?? null,
						stationReference: cant?.stationReference ?? null,
						embeddedInAlignment: false,
					},
				})
			);
		}

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

// -----------------------------------------------------------------------------

function makeWorkingItem({
	kind,
	name,
	sourceFormat,
	sourceFile,
	payload,
	meta = {},
}) {
	return {
		id: makeId("wrk"),
		kind,
		name: name ?? "unnamed",
		source: {
			format: sourceFormat ?? "unknown",
			file: sourceFile ?? null,
		},
		payload,
		status: {
			selected: false,
			validated: false,
			assigned: false,
		},
		meta,
	};
}

function makeId(prefix) {
	return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

// -----------------------------------------------------------------------------

function buildAlignmentSpotCandidate({
	alignment,
	fileName,
	sourceFormat,
	fallbackName = "alignment",
	crs = null,
	classification = {},
}) {
	const sparseAlignment = alignment?.sparseAlignment ?? null;
	if (!sparseAlignment) return null;

	return {
		id: makeId("spot"),
		kind: "alignmentSpotCandidate",
		name: alignment?.name ?? fallbackName,
		source: {
			format: sourceFormat ?? "unknown",
			file: fileName ?? null,
		},
		payload: {
			type: "alignmentSpotCandidatePayload",

			// das eigentliche Zielobjekt
			sparseAlignment,

			// bis UI / artifact-build komplett umgestellt ist:
			coordGeom: alignment?.coordGeom ?? null,
			geometry: alignment?.geometry ?? null,

			// source-near alignment mitschleppen, damit downstream
			// nicht blind an veralteten geometry-Hacks scheitert
			alignmentSource: alignment,
		},
		meta: {
			alignmentName: alignment?.name ?? null,
			crs,
			classification,
		},
	};
}
