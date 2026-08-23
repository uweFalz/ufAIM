import assert from "node:assert/strict";
import test from "node:test";
import { defineGndStationDecoderProfile } from "../../../src/import/evidence/gndStationDecoderProfileContract.js";
import { createGndStationDecoderProfileCatalogue, resolveGndStationDecoderProfile } from "../../../src/import/evidence/gndStationDecoderProfileCatalogue.js";
import { GndStationFrameChainageCandidateService } from "../../../src/services/alignment/GndStationFrameChainageCandidateService.js";

const profile = defineGndStationDecoderProfile({
	profileId: "delivery-1720/v1", profileVersion: "1.0.0",
	sourceFingerprints: ["sha256:delivery-a"], referenceSystems: ["DB_REF"], typeCodes: [6],
	addressEncoding: "integer-metres/v1", stationContextEncoding: "integer-metres/v1",
	evidenceReference: "research:GND-1720-001",
});
const rootDigest = `sha256:${"b".repeat(64)}`;
const evidenceDigest = `sha256:${"a".repeat(64)}`;
const catalogueFor = (status = "released") => createGndStationDecoderProfileCatalogue({ registryId: "test-profile-registry", rootDigest, catalogueVersion: "1.0.0", entries: [{ status, profile, decoder: { id: "decoder-1720", version: "1.0.0" }, evidenceArtifacts: [{ reference: profile.evidenceReference, digest: evidenceDigest }] }] });
const issuedResolution = await resolveGndStationDecoderProfile(catalogueFor(), { profileId: profile.profileId, profileVersion: profile.profileVersion });
const profileDigest = issuedResolution.receipt.profileContentDigest;
const receiptDigest = issuedResolution.receipt.receiptContentDigest;
const receiptId = issuedResolution.receipt.receiptId;

function registry(overrides = {}) {
	const defaultResolution = issuedResolution;
	const resolution = Object.hasOwn(overrides, "resolution") ? overrides.resolution : defaultResolution;
	return { registryId: "test-profile-registry", version: "1.0.0", rootDigest, resolveReceipt: async () => resolution, ...overrides };
}

function frame(overrides = {}) {
	return {
		schema: "ufAIM.gnd-constructive-station-frame-evidence", version: 1,
		source: { fingerprint: "sha256:delivery-a" },
		claims: [{
			claimId: "claim-7", referenceSystem: "DB_REF", typeCode: 6, admission: "evidence-only",
			externalAddressClaims: { start: 596187, end: 596000, encoding: "source-value-uninterpreted" },
			stationContexts: {
				start: [{ route: 1720, directionCode: 1, stationClaim: 59123, encoding: "source-value-uninterpreted" }],
				end: [{ route: 1720, directionCode: 1, stationClaim: 59123, encoding: "source-value-uninterpreted" }],
			},
			blockers: ["GND_STATION_ENCODING_PROFILE_REQUIRED", "INTRINSIC_S_BINDING_NOT_ESTABLISHED"],
			...overrides,
		}],
	};
}

function service(decoded, binding) {
	return new GndStationFrameChainageCandidateService({
		decoder: { decoderId: "decoder-1720", decoderVersion: "1.0.0", profileDigest, profileId: profile.profileId, profileVersion: profile.profileVersion, addressEncoding: profile.addressEncoding, stationContextEncoding: profile.stationContextEncoding, decode: async () => decoded },
		intrinsicBindingProvider: { providerId: "binding-review", providerVersion: "1.0.0", bind: async () => ({ claimId: "claim-7", profileId: profile.profileId, profileVersion: profile.profileVersion, evidenceReference: "review:BIND-1", alignmentRevision: 4, ...binding }) },
		profileRegistry: registry(),
	});
}

test("builds a deeply immutable, non-authoritative increasing candidate", async () => {
	const result = await service(
		{ mappingId: "M1", schemeId: "DB", schemeVersion: "1", segments: [{ id: "S1", startAddress: 100, direction: 1 }] },
		{ alignmentId: "A1", segments: [{ id: "S1", startS: 0, endS: 25 }] },
	).buildCandidate({ frame: frame(), claimId: "claim-7", receiptId });
	assert.equal(result.eligible, true);
	assert.equal(result.status, "eligible");
	assert.equal(result.authoritative, false);
	assert.equal(result.reviewStatus, "unreviewed-import-candidate");
	assert.equal(result.contractVersion, "app-service/gnd-station-frame-chainage-candidate-result/0.1");
	assert.equal(result.provenance.binding.alignmentRevision, 4);
	assert.deepEqual(result.provenance.registry, { id: "test-profile-registry", version: "1.0.0", rootDigest });
	assert.deepEqual(result.provenance.receipt, { id: receiptId, digest: receiptDigest, profileDigest });
	assert.deepEqual(result.mapping.segments[0], { id: "S1", startS: 0, endS: 25, startAddress: 100, direction: 1 });
	assert.ok(Object.isFrozen(result));
	assert.ok(Object.isFrozen(result.mapping.segments[0]));
});

test("preserves a decreasing decoded direction", async () => {
	const result = await service(
		{ mappingId: "M2", schemeId: "DB", schemeVersion: "1", segments: [{ id: "S1", startAddress: 200, direction: -1 }] },
		{ alignmentId: "A1", segments: [{ id: "S1", startS: 10, endS: 30 }] },
	).buildCandidate({ frame: frame(), claimId: "claim-7", receiptId });
	assert.equal(result.eligible, true);
	assert.equal(result.mapping.segments[0].direction, -1);
});

test("constructs a touching-domain kilometre jump without closing the discontinuity", async () => {
	const result = await service(
		{ mappingId: "M3", schemeId: "DB", schemeVersion: "1", segments: [
			{ id: "before", startAddress: 90, direction: 1 },
			{ id: "after", startAddress: 500, direction: 1 },
		] },
		{ alignmentId: "A1", segments: [
			{ id: "before", startS: 0, endS: 10 },
			{ id: "after", startS: 10, endS: 20 },
		] },
	).buildCandidate({ frame: frame(), claimId: "claim-7", receiptId });
	assert.equal(result.eligible, true);
	assert.equal(result.mapping.segments[0].endS, result.mapping.segments[1].startS);
	assert.equal(result.mapping.segments[1].startAddress, 500);
});

test("fails closed on ambiguous decode or binding and never returns a partial mapping", async () => {
	const duplicateDecode = await service(
		{ mappingId: "M", schemeId: "DB", schemeVersion: "1", segments: [
			{ id: "same", startAddress: 1, direction: 1 }, { id: "same", startAddress: 2, direction: 1 },
		] },
		{ alignmentId: "A", segments: [] },
	).buildCandidate({ frame: frame(), claimId: "claim-7", receiptId });
	assert.equal(duplicateDecode.eligible, false);
	assert.equal(duplicateDecode.status, "ineligible");
	assert.equal(duplicateDecode.mapping, null);
	assert.deepEqual(duplicateDecode.diagnostics, ["DELIVERY_DECODER_RESULT_AMBIGUOUS"]);

	const incompleteBinding = await service(
		{ mappingId: "M", schemeId: "DB", schemeVersion: "1", segments: [
			{ id: "one", startAddress: 1, direction: 1 }, { id: "two", startAddress: 2, direction: 1 },
		] },
		{ alignmentId: "A", segments: [{ id: "one", startS: 0, endS: 1 }] },
	).buildCandidate({ frame: frame(), claimId: "claim-7", receiptId });
	assert.equal(incompleteBinding.eligible, false);
	assert.equal(incompleteBinding.mapping, null);
	assert.deepEqual(incompleteBinding.diagnostics, ["INTRINSIC_BINDING_AMBIGUOUS"]);
});

test("profile rejection prevents decoder and binding execution", async () => {
	let calls = 0;
	const candidateService = new GndStationFrameChainageCandidateService({
		decoder: { decoderId: "decoder-1720", decoderVersion: "1.0.0", profileDigest, profileId: profile.profileId, profileVersion: profile.profileVersion, addressEncoding: profile.addressEncoding, stationContextEncoding: profile.stationContextEncoding, decode: async () => { calls += 1; } },
		intrinsicBindingProvider: { providerId: "b", providerVersion: "1", bind: async () => { calls += 1; } },
		profileRegistry: registry(),
	});
	const result = await candidateService.buildCandidate({
		frame: frame({ referenceSystem: "OTHER" }), claimId: "claim-7", receiptId,
	});
	assert.equal(result.eligible, false);
	assert.equal(result.mapping, null);
	assert.ok(result.diagnostics.includes("REFERENCE_SYSTEM_NOT_PROFILED"));
	assert.equal(calls, 0);
});

test("constructor requires both delivery-specific collaborators", () => {
	assert.throws(() => new GndStationFrameChainageCandidateService(), /decoder/);
	const decoder = { decoderId: "d", decoderVersion: "1", profileDigest, decode() {} };
	assert.throws(() => new GndStationFrameChainageCandidateService({ decoder }), /binding provider/);
	assert.throws(() => new GndStationFrameChainageCandidateService({ decoder, intrinsicBindingProvider: { providerId: "b", providerVersion: "1", bind() {} } }), /trusted profile registry/);
});

test("decoder profile mismatch and unaccountable binding fail closed", async () => {
	const wrongDecoder = new GndStationFrameChainageCandidateService({ decoder: { decoderId: "decoder-1720", decoderVersion: "1.0.0", profileDigest: `sha256:${"d".repeat(64)}`, profileId: "other", profileVersion: "1", addressEncoding: profile.addressEncoding, stationContextEncoding: profile.stationContextEncoding, decode() {} }, intrinsicBindingProvider: { providerId: "b", providerVersion: "1", bind() {} }, profileRegistry: registry() });
	const mismatch = await wrongDecoder.buildCandidate({ frame: frame(), claimId: "claim-7", receiptId });
	assert.deepEqual(mismatch.diagnostics, ["DECODER_PROFILE_MISMATCH"]);
	const badBinding = await service({ mappingId: "M", schemeId: "DB", schemeVersion: "1", segments: [{ id: "S", startAddress: 1, direction: 1 }] }, { evidenceReference: "", alignmentId: "A", segments: [{ id: "S", startS: 0, endS: 1 }] }).buildCandidate({ frame: frame(), claimId: "claim-7", receiptId });
	assert.deepEqual(badBinding.diagnostics, ["INTRINSIC_BINDING_UNACCOUNTABLE"]);
});

test("accepts only verified released receipts from the configured registry", async () => {
	let calls = 0;
	const decoder = { decoderId: "decoder-1720", decoderVersion: "1.0.0", profileDigest, profileId: profile.profileId, profileVersion: profile.profileVersion, addressEncoding: profile.addressEncoding, stationContextEncoding: profile.stationContextEncoding, decode() { calls += 1; } };
	const binding = { providerId: "b", providerVersion: "1", bind() { calls += 1; } };
	const run = async (resolution) => new GndStationFrameChainageCandidateService({ decoder, intrinsicBindingProvider: binding, profileRegistry: registry({ resolution }) }).buildCandidate({ frame: frame(), claimId: "claim-7", receiptId });
	assert.deepEqual((await run(null)).diagnostics, ["PROFILE_RECEIPT_UNKNOWN"]);
	assert.deepEqual((await run({ verified: false, profile, receipt: {} })).diagnostics, ["PROFILE_RECEIPT_UNVERIFIED"]);
	assert.deepEqual((await run(structuredClone(issuedResolution))).diagnostics, ["PROFILE_RECEIPT_UNVERIFIED"]);
	const candidate = await resolveGndStationDecoderProfile(catalogueFor("candidate"), { profileId: profile.profileId, profileVersion: profile.profileVersion, includeCandidate: true });
	assert.deepEqual((await run(candidate)).diagnostics, ["PROFILE_RECEIPT_NOT_RELEASED"]);
	const revoked = await resolveGndStationDecoderProfile(catalogueFor("revoked"), { profileId: profile.profileId, profileVersion: profile.profileVersion, includeRevoked: true });
	assert.deepEqual((await run(revoked)).diagnostics, ["PROFILE_RECEIPT_REVOKED"]);
	const mismatchedRegistry = new GndStationFrameChainageCandidateService({ decoder, intrinsicBindingProvider: binding, profileRegistry: registry({ rootDigest: `sha256:${"e".repeat(64)}` }) });
	assert.deepEqual((await mismatchedRegistry.buildCandidate({ frame: frame(), claimId: "claim-7", receiptId })).diagnostics, ["PROFILE_RECEIPT_MISMATCH"]);
	assert.equal(calls, 0);
});
