// src/import/domain/collectLandFatProfilesAndCants.js
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

import { makeWorkingItem } from "./importItemFactories.js";

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

	for (const [index, alignment] of alignments.entries()) {
		const alignmentName = alignment?.name ?? `alignment_${index + 1}`;

		if (alignment?.profile) {
			const profile = alignment.profile;
			const profileKey =
				profile?.id ??
				`${alignment?.id ?? alignmentName}::profile`;

			if (!seenProfiles.has(profileKey)) {
				seenProfiles.add(profileKey);

				const profileName =
					profile?.name ??
					`${alignmentName}::profile`;

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

		if (alignment?.cant) {
			const cant = alignment.cant;
			const cantKey =
				cant?.id ??
				`${alignment?.id ?? alignmentName}::cant`;

			if (!seenCants.has(cantKey)) {
				seenCants.add(cantKey);

				const cantName =
					cant?.name ??
					`${alignmentName}::cant`;

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

	// -------------------------------------------------------------------------
	// root profiles
	// -------------------------------------------------------------------------

	for (const [index, profile] of profiles.entries()) {
		const name = profile?.name ?? `profile_${index + 1}`;
		const profileKey = profile?.id ?? `rootProfile_${index}`;

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
					profileName: profile?.name ?? null,
					stationReference: profile?.stationReference ?? null,
					embeddedInAlignment: false,
				},
			})
		);
	}

	// -------------------------------------------------------------------------
	// root cants
	// -------------------------------------------------------------------------

	for (const [index, cant] of cants.entries()) {
		const name = cant?.name ?? `cant_${index + 1}`;
		const cantKey = cant?.id ?? `rootCant_${index}`;

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
					cantName: cant?.name ?? null,
					stationReference: cant?.stationReference ?? null,
					embeddedInAlignment: false,
				},
			})
		);
	}

	return workingItems;
}
