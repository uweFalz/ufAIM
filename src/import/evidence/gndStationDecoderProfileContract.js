export const GND_STATION_DECODER_PROFILE_SCHEMA = "ufAIM.gnd-station-decoder-profile";
export const GND_STATION_DECODER_PROFILE_VERSION = 1;

const STATION_FRAME_SCHEMA = "ufAIM.gnd-constructive-station-frame-evidence";
const STATION_FRAME_VERSION = 1;
const PROFILE_SATISFIED_BLOCKER = "GND_STATION_ENCODING_PROFILE_REQUIRED";

export function defineGndStationDecoderProfile(input = {}) {
	const profileId = requiredText(input.profileId, "profile id");
	const profileVersion = requiredText(input.profileVersion, "profile version");
	const sourceFingerprints = requiredTexts(input.sourceFingerprints, "source fingerprint");
	const referenceSystems = requiredTexts(input.referenceSystems, "reference system");
	const typeCodes = requiredFiniteNumbers(input.typeCodes, "type code");
	const addressEncoding = requiredText(input.addressEncoding, "concrete address encoding");
	const stationContextEncoding = requiredText(input.stationContextEncoding, "concrete station-context encoding");
	const evidenceReference = requiredText(input.evidenceReference, "evidence reference");
	if (addressEncoding === "source-value-uninterpreted" || stationContextEncoding === "source-value-uninterpreted") {
		throw new TypeError("A concrete address encoding is required");
	}

	return deepFreeze({
		schema: GND_STATION_DECODER_PROFILE_SCHEMA,
		version: GND_STATION_DECODER_PROFILE_VERSION,
		profileId,
		profileVersion,
		authority: "delivery-specific-evidence-backed",
		effect: "decoder-eligibility-only",
		sourceFingerprints: unique(sourceFingerprints),
		referenceSystems: unique(referenceSystems),
		typeCodes: unique(typeCodes),
		addressEncoding,
		stationContextEncoding,
		evidenceReference,
	});
}

export function assessGndStationDecoderEligibility({ frame, claimId, profile } = {}) {
	const selectedClaimId = text(claimId) || null;
	if (frame?.schema !== STATION_FRAME_SCHEMA || frame?.version !== STATION_FRAME_VERSION) {
		return result(false, profile, selectedClaimId, [], ["UNSUPPORTED_STATION_FRAME"]);
	}
	const claim = (frame.claims ?? []).find((entry) => entry?.claimId === selectedClaimId);
	if (!claim) return result(false, profile, selectedClaimId, [], ["STATION_CLAIM_NOT_FOUND"]);
	if (!isDecoderProfile(profile)) {
		return result(false, profile, selectedClaimId, unique(claim.blockers ?? []), ["UNSUPPORTED_DECODER_PROFILE"]);
	}

	const diagnostics = [];
	const profileMatches = {
		fingerprint: profile.sourceFingerprints.includes(frame?.source?.fingerprint),
		referenceSystem: profile.referenceSystems.includes(String(claim.referenceSystem ?? "")),
		typeCode: profile.typeCodes.includes(claim.typeCode),
	};
	if (!profileMatches.fingerprint) diagnostics.push("SOURCE_FINGERPRINT_NOT_PROFILED");
	if (!profileMatches.referenceSystem) diagnostics.push("REFERENCE_SYSTEM_NOT_PROFILED");
	if (!profileMatches.typeCode) diagnostics.push("TYPE_CODE_NOT_PROFILED");
	if (claim.admission !== "evidence-only") diagnostics.push("CLAIM_NOT_EVIDENCE_ONLY");
	if (claim.externalAddressClaims?.encoding !== "source-value-uninterpreted") diagnostics.push("ADDRESS_CLAIM_ALREADY_INTERPRETED");
	if (claim.externalAddressClaims?.start == null || claim.externalAddressClaims?.end == null) diagnostics.push("ADDRESS_CLAIM_INCOMPLETE");
	if (!hasUniqueContexts(claim.stationContexts)) diagnostics.push("STATION_CONTEXT_NOT_UNIQUE");
	if (hasUniqueContexts(claim.stationContexts) && !contextsCoherent(claim.stationContexts)) diagnostics.push("STATION_CONTEXT_NOT_COHERENT");
	if (!contextsUninterpreted(claim.stationContexts)) diagnostics.push("STATION_CONTEXT_ALREADY_INTERPRETED");

	const profileScopeMatches = Object.values(profileMatches).every(Boolean);
	const remainingBlockers = unique((claim.blockers ?? []).filter((blocker) => blocker !== PROFILE_SATISFIED_BLOCKER || !profileScopeMatches));
	const evidenceBlockers = remainingBlockers.filter((blocker) => blocker !== "INTRINSIC_S_BINDING_NOT_ESTABLISHED");
	if (evidenceBlockers.length) diagnostics.push("CLAIM_HAS_UNRESOLVED_EVIDENCE_BLOCKERS");
	return result(diagnostics.length === 0, profile, claim.claimId, remainingBlockers, unique(diagnostics));
}

function result(eligible, profile, claimId, remainingBlockers, diagnostics) {
	return deepFreeze({
		addressDecodingEligible: eligible,
		profileId: profile?.profileId ?? null,
		profileVersion: profile?.profileVersion ?? null,
		claimId,
		scope: "source-address-decoding-only",
		remainingBlockers,
		diagnostics,
	});
}

function hasUniqueContexts(contexts) {
	return contexts?.start?.length === 1 && contexts?.end?.length === 1;
}

function contextsUninterpreted(contexts) {
	return [contexts?.start?.[0], contexts?.end?.[0]].every((entry) => entry?.encoding === "source-value-uninterpreted");
}

function contextsCoherent(contexts) {
	const start = contexts.start[0], end = contexts.end[0];
	if ([start.route, start.directionCode, start.stationClaim, end.route, end.directionCode, end.stationClaim].some((value) => value == null)) return false;
	return Object.is(start.route, end.route) && Object.is(start.directionCode, end.directionCode);
}

function isDecoderProfile(profile) {
	return profile?.schema === GND_STATION_DECODER_PROFILE_SCHEMA
		&& profile?.version === GND_STATION_DECODER_PROFILE_VERSION
		&& profile?.authority === "delivery-specific-evidence-backed"
		&& profile?.effect === "decoder-eligibility-only"
		&& typeof profile.profileId === "string" && profile.profileId.length > 0
		&& typeof profile.profileVersion === "string" && profile.profileVersion.length > 0
		&& concreteText(profile.addressEncoding)
		&& concreteText(profile.stationContextEncoding)
		&& concreteText(profile.evidenceReference)
		&& specificTexts(profile.sourceFingerprints)
		&& specificTexts(profile.referenceSystems)
		&& Array.isArray(profile.typeCodes) && profile.typeCodes.length > 0
		&& profile.typeCodes.every((value) => typeof value === "number" && Number.isFinite(value));
}
function concreteText(value) { return typeof value === "string" && value.trim().length > 0 && value !== "*" && value !== "source-value-uninterpreted"; }
function specificTexts(values) { return Array.isArray(values) && values.length > 0 && values.every(concreteText); }

function requiredText(value, label) {
	const normalized = text(value);
	if (!normalized || normalized === "*") throw new TypeError(`A specific ${label} is required`);
	return normalized;
}

function requiredTexts(values, label) {
	if (!Array.isArray(values) || values.length === 0) throw new TypeError(`At least one specific ${label} is required`);
	return values.map((value) => requiredText(value, label));
}

function requiredFiniteNumbers(values, label) {
	if (!Array.isArray(values) || values.length === 0) throw new TypeError(`At least one specific ${label} is required`);
	return values.map((value) => {
		if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`A finite numeric ${label} is required`);
		return value;
	});
}

function text(value) { return String(value ?? "").trim(); }
function unique(values) { return [...new Set(values)]; }
function deepFreeze(value) {
	if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
	for (const child of Object.values(value)) deepFreeze(child);
	return Object.freeze(value);
}

export default assessGndStationDecoderEligibility;
