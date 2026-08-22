// src/import/build/collectLandFatProfilesAndCants.js
//
// Collect profile/cant working items from a landFAT container.
//
// Responsibilities:
// - collect embedded profile/cant from alignments
// - collect root profiles/cants
// - dedupe by id/fallback key
//
// deliberately NO:
// - sparse logic
// - alignment classification
// - parser logic
//
// @baustelle [DATASET_MODEL]
// This collector is an interim step toward a broader dataset-based import model.
// Future scope should likely include:
// - profile
// - cant
// - staEq
// - relation candidates
//
// @baustelle [NAMING]
// Current filename is historical. Long-term target should be closer to:
// collectLandFatDatasets.js

import { makeWorkingItem } from "./importItemFactories.js";

// -----------------------------------------------------------------------------
// public
// -----------------------------------------------------------------------------

export function collectLandFatProfilesAndCants({
	alignments = [],
	profiles = [],
	cants = [],
	sourceFormat = "unknown",
	sourceFile = null,
	log = () => {},
} = {}) {
	const workingItems = [];
	const seenProfiles = new Set();
	const seenCants = new Set();

	// -------------------------------------------------------------------------
	// embedded profiles / cants
	// -------------------------------------------------------------------------

	for (const [index, alignment] of asArray(alignments).entries()) {
		const alignmentName = alignment?.name ?? `alignment_${index + 1}`;
		const alignmentId = alignment?.id ?? null;

		const embeddedProfile = normalizeEmbeddedProfile(alignment?.profile);
		if (embeddedProfile) {
			const profileKey = deriveDatasetKey(
				"profile",
				embeddedProfile,
				`${alignmentId ?? alignmentName}::profile`
			);

			if (!seenProfiles.has(profileKey)) {
				seenProfiles.add(profileKey);

				const profileName =
					embeddedProfile?.name ??
					`${alignmentName}::profile`;

				workingItems.push(
					makeWorkingItem({
						kind: "landFATProfile",
						name: profileName,
						sourceFormat,
						sourceFile,
						payload: embeddedProfile,
						meta: {
							datasetType: "profile",
							profileName: embeddedProfile?.name ?? null,
							stationReference:
								embeddedProfile?.stationReference ??
								embeddedProfile?.ref ??
								null,
							embeddedInAlignment: true,
							alignmentName: alignment?.name ?? null,
							alignmentId,
						},
					})
				);

				safeLog(
					log,
					`collectLandFatProfilesAndCants: embedded profile "${profileName}"`
				);
			}
		}

		const embeddedCant = normalizeEmbeddedCant(alignment?.cant);
		if (embeddedCant) {
			const cantKey = deriveDatasetKey(
				"cant",
				embeddedCant,
				`${alignmentId ?? alignmentName}::cant`
			);

			if (!seenCants.has(cantKey)) {
				seenCants.add(cantKey);

				const cantName =
					embeddedCant?.name ??
					`${alignmentName}::cant`;

				workingItems.push(
					makeWorkingItem({
						kind: "landFATCant",
						name: cantName,
						sourceFormat,
						sourceFile,
						payload: embeddedCant,
						meta: {
							datasetType: "cant",
							cantName: embeddedCant?.name ?? null,
							stationReference:
								embeddedCant?.stationReference ??
								embeddedCant?.ref ??
								null,
							embeddedInAlignment: true,
							alignmentName: alignment?.name ?? null,
							alignmentId,
						},
					})
				);

				safeLog(
					log,
					`collectLandFatProfilesAndCants: embedded cant "${cantName}"`
				);
			}
		}
	}

	// -------------------------------------------------------------------------
	// root profiles
	// -------------------------------------------------------------------------

	for (const [index, profileRaw] of asArray(profiles).entries()) {
		const profile = normalizeRootProfile(profileRaw);
		if (!profile) continue;

		const name = profile?.name ?? `profile_${index + 1}`;
		const profileKey = deriveDatasetKey("profile", profile, `rootProfile_${index}`);

		if (seenProfiles.has(profileKey)) continue;
		seenProfiles.add(profileKey);

		workingItems.push(
			makeWorkingItem({
				kind: "landFATProfile",
				name,
				sourceFormat,
				sourceFile,
				payload: profile,
				meta: {
					datasetType: "profile",
					profileName: profile?.name ?? null,
					stationReference:
						profile?.stationReference ??
						profile?.ref ??
						null,
					embeddedInAlignment: false,
				},
			})
		);

		safeLog(
			log,
			`collectLandFatProfilesAndCants: root profile "${name}"`
		);
	}

	// -------------------------------------------------------------------------
	// root cants
	// -------------------------------------------------------------------------

	for (const [index, cantRaw] of asArray(cants).entries()) {
		const cant = normalizeRootCant(cantRaw);
		if (!cant) continue;

		const name = cant?.name ?? `cant_${index + 1}`;
		const cantKey = deriveDatasetKey("cant", cant, `rootCant_${index}`);

		if (seenCants.has(cantKey)) continue;
		seenCants.add(cantKey);

		workingItems.push(
			makeWorkingItem({
				kind: "landFATCant",
				name,
				sourceFormat,
				sourceFile,
				payload: cant,
				meta: {
					datasetType: "cant",
					cantName: cant?.name ?? null,
					stationReference:
						cant?.stationReference ??
						cant?.ref ??
						null,
					embeddedInAlignment: false,
				},
			})
		);

		safeLog(
			log,
			`collectLandFatProfilesAndCants: root cant "${name}"`
		);
	}

	return workingItems;
}

// -----------------------------------------------------------------------------
// normalization helpers
// -----------------------------------------------------------------------------

function normalizeEmbeddedProfile(profile) {
	if (!isObject(profile)) return null;
	return profile;
}

function normalizeRootProfile(profile) {
	if (!isObject(profile)) return null;
	return profile;
}

function normalizeEmbeddedCant(cant) {
	if (isObject(cant)) return cant;

	// allow array-like cant datasets from some parser outputs
	if (Array.isArray(cant) && cant.length > 0) {
		return {
			name: inferArrayDatasetName(cant, "cant"),
			points: cant,
		};
	}

	return null;
}

function normalizeRootCant(cant) {
	if (isObject(cant)) return cant;

	if (Array.isArray(cant) && cant.length > 0) {
		return {
			name: inferArrayDatasetName(cant, "cant"),
			points: cant,
		};
	}

	return null;
}

// -----------------------------------------------------------------------------
// keys / logging
// -----------------------------------------------------------------------------

function deriveDatasetKey(kind, dataset, fallback) {
	return (
		dataset?.id ??
		dataset?.name ??
		(isNonEmptyString(fallback) ? fallback : `${kind}_unnamed`)
	);
}

function inferArrayDatasetName(arr, fallbackPrefix) {
	const first = arr[0];
	if (isObject(first)) {
		return first.name ?? first.id ?? `${fallbackPrefix}_embedded`;
	}
	return `${fallbackPrefix}_embedded`;
}

function safeLog(log, message) {
	if (typeof log === "function") {
		try {
			log(message);
		} catch {
			// ignore logging errors
		}
	}
}

// -----------------------------------------------------------------------------
// generic helpers
// -----------------------------------------------------------------------------

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

function isNonEmptyString(x) {
	return typeof x === "string" && x.trim().length > 0;
}
