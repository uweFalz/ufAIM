import {
	assessGndStationDecoderEligibility,
} from "../../import/evidence/gndStationDecoderProfileContract.js";
import { isIssuedGndStationDecoderProfileResolution } from "../../import/evidence/gndStationDecoderProfileCatalogue.js";
import {
	appendChainageSegment,
	createChainageMapping,
} from "../../aim-core/alignment/profile/ChainageMapping.js";

const REVIEW_STATUS = "unreviewed-import-candidate";
export const GND_STATION_FRAME_CHAINAGE_CANDIDATE_RESULT_VERSION = "app-service/gnd-station-frame-chainage-candidate-result/0.1";

export class GndStationFrameChainageCandidateService {
	#decoder;
	#intrinsicBindingProvider;
	#profileRegistry;

	constructor({ decoder, intrinsicBindingProvider, profileRegistry } = {}) {
		if (typeof decoder?.decode !== "function" || !nonEmptyText(decoder?.decoderId) || !nonEmptyText(decoder?.decoderVersion) || !nonEmptyText(decoder?.profileDigest)) {
			throw new TypeError("A delivery-specific GND station decoder is required");
		}
		if (typeof intrinsicBindingProvider?.bind !== "function" || !nonEmptyText(intrinsicBindingProvider?.providerId) || !nonEmptyText(intrinsicBindingProvider?.providerVersion)) {
			throw new TypeError("An intrinsic binding provider is required");
		}
		if (typeof profileRegistry?.resolveReceipt !== "function" || !nonEmptyText(profileRegistry?.registryId) || !nonEmptyText(profileRegistry?.version) || !nonEmptyText(profileRegistry?.rootDigest)) {
			throw new TypeError("A trusted profile registry is required");
		}
		this.#decoder = decoder;
		this.#intrinsicBindingProvider = intrinsicBindingProvider;
		this.#profileRegistry = profileRegistry;
	}

	async buildCandidate({ frame, claimId, receiptId } = {}) {
		const unresolved = assessGndStationDecoderEligibility({ frame, claimId });
		if (!nonEmptyText(receiptId)) return ineligible(unresolved, ["PROFILE_RECEIPT_UNKNOWN"]);
		let resolution;
		try {
			resolution = await this.#profileRegistry.resolveReceipt(receiptId);
		} catch {
			return ineligible(unresolved, ["PROFILE_RECEIPT_UNVERIFIED"]);
		}
		const receiptProblem = validateReceiptResolution(resolution, receiptId, this.#profileRegistry);
		if (receiptProblem) return ineligible(unresolved, [receiptProblem]);
		const { profile, receipt } = resolution;
		const eligibility = assessGndStationDecoderEligibility({ frame, claimId, profile });
		if (!eligibility.addressDecodingEligible) return ineligible(eligibility, eligibility.diagnostics);
		if (!decoderMatchesReceipt(this.#decoder, profile, receipt)) return ineligible(eligibility, ["DECODER_PROFILE_MISMATCH"]);

		const claim = (frame.claims ?? []).find((entry) => entry?.claimId === eligibility.claimId);
		let decoded;
		try {
			decoded = await this.#decoder.decode({ frame, claim, profile, eligibility });
		} catch {
			return ineligible(eligibility, ["DELIVERY_DECODER_FAILED"]);
		}
		const decodedProblem = validateDecoded(decoded);
		if (decodedProblem) return ineligible(eligibility, [decodedProblem]);

		let binding;
		try {
			binding = await this.#intrinsicBindingProvider.bind({ frame, claim, profile, decoded, eligibility });
		} catch {
			return ineligible(eligibility, ["INTRINSIC_BINDING_FAILED"]);
		}
		const bindingProblem = validateBinding(binding, decoded.segments, eligibility);
		if (bindingProblem) return ineligible(eligibility, [bindingProblem]);

		let mapping;
		try {
			mapping = createChainageMapping({
				id: decoded.mappingId,
				alignmentId: binding.alignmentId,
				schemeId: decoded.schemeId,
				schemeVersion: decoded.schemeVersion,
			});
			const bindings = new Map(binding.segments.map((segment) => [segment.id, segment]));
			for (const segment of decoded.segments) {
				const intrinsic = bindings.get(segment.id);
				mapping = appendChainageSegment(mapping, {
					id: segment.id,
					startS: intrinsic.startS,
					endS: intrinsic.endS,
					startAddress: segment.startAddress,
					direction: segment.direction,
				});
			}
		} catch {
			return ineligible(eligibility, ["CHAINAGE_MAPPING_CONSTRUCTION_FAILED"]);
		}

		return deepFreeze({
			contractVersion: GND_STATION_FRAME_CHAINAGE_CANDIDATE_RESULT_VERSION,
			eligible: true,
			status: "eligible",
			authoritative: false,
			reviewStatus: REVIEW_STATUS,
			claimId: eligibility.claimId,
			profileId: eligibility.profileId,
			profileVersion: eligibility.profileVersion,
			mapping,
			diagnostics: [],
			provenance: provenance({ frame, eligibility, decoder: this.#decoder, bindingProvider: this.#intrinsicBindingProvider, binding, registry: this.#profileRegistry, receipt }),
		});
	}
}

function validateDecoded(decoded) {
	if (!object(decoded)) return "DELIVERY_DECODER_RESULT_INVALID";
	if (![decoded.mappingId, decoded.schemeId, decoded.schemeVersion].every(nonEmptyText)) {
		return "DELIVERY_DECODER_RESULT_INVALID";
	}
	if (!Array.isArray(decoded.segments) || decoded.segments.length === 0) {
		return "DELIVERY_DECODER_RESULT_INVALID";
	}
	const ids = new Set();
	for (const segment of decoded.segments) {
		if (!object(segment) || !nonEmptyText(segment.id) || ids.has(segment.id) ||
			typeof segment.startAddress !== "number" || !Number.isFinite(segment.startAddress) ||
			(segment.direction !== 1 && segment.direction !== -1)) {
			return "DELIVERY_DECODER_RESULT_AMBIGUOUS";
		}
		ids.add(segment.id);
	}
	return null;
}

function validateBinding(binding, decodedSegments, eligibility) {
	if (!object(binding) || !nonEmptyText(binding.alignmentId) || !Array.isArray(binding.segments)) {
		return "INTRINSIC_BINDING_INVALID";
	}
	if (binding.claimId !== eligibility.claimId || binding.profileId !== eligibility.profileId || binding.profileVersion !== eligibility.profileVersion || !nonEmptyText(binding.evidenceReference) || (typeof binding.alignmentRevision !== "number" && !nonEmptyText(binding.alignmentRevision))) return "INTRINSIC_BINDING_UNACCOUNTABLE";
	if (binding.segments.length !== decodedSegments.length) return "INTRINSIC_BINDING_AMBIGUOUS";
	const expected = new Set(decodedSegments.map((segment) => segment.id));
	const seen = new Set();
	for (const segment of binding.segments) {
		if (!object(segment) || !expected.has(segment.id) || seen.has(segment.id) ||
			typeof segment.startS !== "number" || !Number.isFinite(segment.startS) ||
			typeof segment.endS !== "number" || !Number.isFinite(segment.endS)) {
			return "INTRINSIC_BINDING_AMBIGUOUS";
		}
		seen.add(segment.id);
	}
	return seen.size === expected.size ? null : "INTRINSIC_BINDING_AMBIGUOUS";
}

function ineligible(eligibility, diagnostics) {
	return deepFreeze({
		contractVersion: GND_STATION_FRAME_CHAINAGE_CANDIDATE_RESULT_VERSION,
		eligible: false,
		status: "ineligible",
		authoritative: false,
		reviewStatus: REVIEW_STATUS,
		claimId: eligibility.claimId,
		profileId: eligibility.profileId,
		profileVersion: eligibility.profileVersion,
		mapping: null,
		diagnostics: [...new Set(diagnostics)],
	});
}

function validateReceiptResolution(resolution, receiptId, registry) {
	if (resolution == null) return "PROFILE_RECEIPT_UNKNOWN";
	if (!isIssuedGndStationDecoderProfileResolution(resolution) || !object(resolution) || resolution.verified !== true || !object(resolution.profile) || !object(resolution.receipt)) return "PROFILE_RECEIPT_UNVERIFIED";
	const { profile, receipt } = resolution;
	if (receipt.status === "revoked") return "PROFILE_RECEIPT_REVOKED";
	if (receipt.status !== "released") return "PROFILE_RECEIPT_NOT_RELEASED";
	if (receipt.receiptId !== receiptId || receipt.registryId !== registry.registryId || receipt.registryVersion !== registry.version || receipt.registryRootDigest !== registry.rootDigest ||
		receipt.profileIdentity?.profileId !== profile.profileId || receipt.profileIdentity?.profileVersion !== profile.profileVersion ||
		!nonEmptyText(receipt.profileContentDigest) || !nonEmptyText(receipt.receiptContentDigest)) return "PROFILE_RECEIPT_MISMATCH";
	return null;
}
function decoderMatchesReceipt(decoder, profile, receipt) {
	return decoder.profileDigest === receipt.profileContentDigest && decoder.profileId === profile.profileId && decoder.profileVersion === profile.profileVersion &&
		decoder.addressEncoding === profile.addressEncoding && decoder.stationContextEncoding === profile.stationContextEncoding &&
		decoder.decoderId === receipt.decoder?.id && decoder.decoderVersion === receipt.decoder?.version;
}
function provenance({ frame, eligibility, decoder, bindingProvider, binding, registry, receipt }) {
	return {
		evidenceId: frame?.evidenceId ?? null,
		sourceFingerprint: frame?.source?.fingerprint ?? null,
		claimId: eligibility.claimId,
		registry: { id: registry.registryId, version: registry.version, rootDigest: registry.rootDigest },
		receipt: { id: receipt.receiptId, digest: receipt.receiptContentDigest, profileDigest: receipt.profileContentDigest },
		decoder: { id: decoder.decoderId, version: decoder.decoderVersion, profileId: decoder.profileId, profileVersion: decoder.profileVersion, profileDigest: decoder.profileDigest },
		binding: { providerId: bindingProvider.providerId, providerVersion: bindingProvider.providerVersion, evidenceReference: binding.evidenceReference, alignmentId: binding.alignmentId, alignmentRevision: binding.alignmentRevision },
	};
}

function object(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
function nonEmptyText(value) { return typeof value === "string" && value.trim().length > 0; }
function deepFreeze(value) {
	if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
	for (const child of Object.values(value)) deepFreeze(child);
	return Object.freeze(value);
}

export default GndStationFrameChainageCandidateService;
