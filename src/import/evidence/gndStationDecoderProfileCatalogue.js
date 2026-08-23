import {
	GND_STATION_DECODER_PROFILE_SCHEMA,
	GND_STATION_DECODER_PROFILE_VERSION,
	defineGndStationDecoderProfile,
} from "./gndStationDecoderProfileContract.js";

export const GND_STATION_DECODER_PROFILE_CATALOGUE_SCHEMA = "ufAIM.gnd-station-decoder-profile-catalogue";
export const GND_STATION_DECODER_PROFILE_CATALOGUE_VERSION = 1;
export const GND_STATION_DECODER_PROFILE_RECEIPT_SCHEMA = "ufAIM.gnd-station-decoder-profile-registry-receipt";
export const GND_STATION_DECODER_PROFILE_RECEIPT_VERSION = 1;

const issuedCatalogues = new WeakSet();
const issuedResolutions = new WeakSet();
const SEMANTIC_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/;

export function createGndStationDecoderProfileCatalogue(input = {}) {
	const registryId = requiredText(input.registryId, "registry id");
	const rootDigest = requiredText(input.rootDigest, "registry root digest").toLowerCase();
	if (!SHA256_DIGEST.test(rootDigest)) throw new TypeError("Registry root digest must be sha256:<64 lowercase hex>");
	const catalogueVersion = semanticVersion(input.catalogueVersion, "catalogue version");
	if (!Array.isArray(input.entries)) throw new TypeError("Catalogue entries must be an array");
	const identities = new Set();
	const entries = input.entries.map((entry, index) => normalizeEntry(entry, index, identities));
	const catalogue = deepFreeze({
		schema: GND_STATION_DECODER_PROFILE_CATALOGUE_SCHEMA,
		version: GND_STATION_DECODER_PROFILE_CATALOGUE_VERSION,
		registryId,
		rootDigest,
		catalogueVersion,
		entries,
	});
	issuedCatalogues.add(catalogue);
	return catalogue;
}

export async function resolveGndStationDecoderProfile(catalogue, selection = {}) {
	if (!issuedCatalogues.has(catalogue)) throw new TypeError("A registry-issued catalogue is required");
	const profileId = requiredText(selection.profileId, "profile id");
	const profileVersion = semanticVersion(selection.profileVersion, "profile version");
	const entry = catalogue.entries.find((candidate) =>
		candidate.profile.profileId === profileId && candidate.profile.profileVersion === profileVersion);
	if (!entry || (entry.status === "candidate" && selection.includeCandidate !== true) || (entry.status === "revoked" && selection.includeRevoked !== true)) return null;

	const profileContentDigest = await digest(entry.profile);
	const receiptId = await digest({ registryId: catalogue.registryId, registryVersion: catalogue.catalogueVersion, registryRootDigest: catalogue.rootDigest, profileId, profileVersion, profileContentDigest });
	const receiptContent = {
		schema: GND_STATION_DECODER_PROFILE_RECEIPT_SCHEMA,
		version: GND_STATION_DECODER_PROFILE_RECEIPT_VERSION,
		receiptId,
		registryId: catalogue.registryId,
		registryVersion: catalogue.catalogueVersion,
		registryRootDigest: catalogue.rootDigest,
		catalogueVersion: catalogue.catalogueVersion,
		profileIdentity: { profileId, profileVersion },
		profileContentDigest,
		status: entry.status,
		decoder: entry.decoder,
		evidenceArtifacts: entry.evidenceArtifacts,
	};
	const resolution = deepFreeze({
		verified: true,
		profile: entry.profile,
		receipt: { ...receiptContent, receiptContentDigest: await digest(receiptContent) },
	});
	issuedResolutions.add(resolution);
	return resolution;
}

// Local in-process issuance authenticity only; it carries no cross-process proof.
export function isIssuedGndStationDecoderProfileResolution(value) {
	return issuedResolutions.has(value);
}

function normalizeEntry(entry, index, identities) {
	if (!entry || typeof entry !== "object") throw new TypeError(`Catalogue entry ${index} is required`);
	if (!["candidate", "released", "revoked"].includes(entry.status)) throw new TypeError("Profile status must be candidate, released, or revoked");
	const profile = validatedProfile(entry.profile);
	const identity = `${profile.profileId}\u0000${profile.profileVersion}`;
	if (identities.has(identity)) throw new TypeError(`Duplicate profile identity/version collision: ${profile.profileId}@${profile.profileVersion}`);
	identities.add(identity);
	const decoder = {
		id: requiredText(entry.decoder?.id, "decoder id"),
		version: semanticVersion(entry.decoder?.version, "decoder version"),
	};
	if (!Array.isArray(entry.evidenceArtifacts) || entry.evidenceArtifacts.length === 0) {
		throw new TypeError("At least one evidence artifact is required");
	}
	const evidenceArtifacts = entry.evidenceArtifacts.map((artifact) => {
		const reference = requiredText(artifact?.reference, "evidence artifact reference");
		const digestValue = requiredText(artifact?.digest, "evidence artifact digest").toLowerCase();
		if (!SHA256_DIGEST.test(digestValue)) throw new TypeError("Evidence artifact digest must be sha256:<64 lowercase hex>");
		return { reference, digest: digestValue };
	});
	if (!evidenceArtifacts.some((artifact) => artifact.reference === profile.evidenceReference)) {
		throw new TypeError("Profile evidence reference must identify a digested evidence artifact");
	}
	return { status: entry.status, profile, decoder, evidenceArtifacts };
}

function validatedProfile(input) {
	if (input?.schema !== GND_STATION_DECODER_PROFILE_SCHEMA || input?.version !== GND_STATION_DECODER_PROFILE_VERSION) {
		throw new TypeError("Unsupported decoder profile content");
	}
	let rebuilt;
	try {
		rebuilt = defineGndStationDecoderProfile({
			profileId: input.profileId,
			profileVersion: semanticVersion(input.profileVersion, "profile version"),
			sourceFingerprints: input.sourceFingerprints,
			referenceSystems: input.referenceSystems,
			typeCodes: input.typeCodes,
			addressEncoding: input.addressEncoding,
			stationContextEncoding: input.stationContextEncoding,
			evidenceReference: input.evidenceReference,
		});
	} catch (error) {
		throw new TypeError(`Invalid decoder profile content: ${error.message}`);
	}
	if (canonicalJson(rebuilt) !== canonicalJson(input)) throw new TypeError("Invalid decoder profile content");
	return rebuilt;
}

function semanticVersion(value, label) {
	const normalized = requiredText(value, label);
	if (!SEMANTIC_VERSION.test(normalized)) throw new TypeError(`A semantic ${label} is required`);
	return normalized;
}
function requiredText(value, label) {
	const normalized = String(value ?? "").trim();
	if (!normalized || normalized === "*") throw new TypeError(`A specific ${label} is required`);
	return normalized;
}
async function digest(value) {
	if (typeof globalThis.crypto?.subtle?.digest !== "function") throw new TypeError("Web Crypto SHA-256 is required");
	const bytes = new TextEncoder().encode(canonicalJson(value));
	const hash = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
	return `sha256:${[...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function canonicalJson(value) {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
	return JSON.stringify(value);
}
function deepFreeze(value) {
	if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
	for (const child of Object.values(value)) deepFreeze(child);
	return Object.freeze(value);
}

export default resolveGndStationDecoderProfile;
