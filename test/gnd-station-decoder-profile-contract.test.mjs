import assert from "node:assert/strict";
import test from "node:test";
import {
	GND_STATION_DECODER_PROFILE_SCHEMA,
	GND_STATION_DECODER_PROFILE_VERSION,
	assessGndStationDecoderEligibility,
	defineGndStationDecoderProfile,
} from "../src/import/evidence/gndStationDecoderProfileContract.js";

const profileInput = (overrides = {}) => ({
	profileId: "delivery-1720/v1",
	profileVersion: "1.0.0",
	sourceFingerprints: ["sha256:delivery-a"],
	referenceSystems: ["DB_REF"],
	typeCodes: [6],
	addressEncoding: "gnd-delivery-integer-metres/v1",
	stationContextEncoding: "gnd-delivery-integer-metres/v1",
	evidenceReference: "research:GND-1720-001",
	...overrides,
});

const frame = (claimOverrides = {}, frameOverrides = {}) => ({
	schema: "ufAIM.gnd-constructive-station-frame-evidence",
	version: 1,
	source: { fingerprint: "sha256:delivery-a" },
	claims: [{
		claimId: "claim-7",
		referenceSystem: "DB_REF",
		typeCode: 6,
		admission: "evidence-only",
		externalAddressClaims: { start: 596187, end: 596000, encoding: "source-value-uninterpreted" },
		stationContexts: {
			start: [{ route: 1720, directionCode: 1, stationClaim: 59123, encoding: "source-value-uninterpreted" }],
			end: [{ route: 1720, directionCode: 1, stationClaim: 59123, encoding: "source-value-uninterpreted" }],
		},
		blockers: ["GND_STATION_ENCODING_PROFILE_REQUIRED", "INTRINSIC_S_BINDING_NOT_ESTABLISHED"],
		...claimOverrides,
	}],
	...frameOverrides,
});

test("defines an immutable, explicitly scoped versioned decoder profile", () => {
	const profile = defineGndStationDecoderProfile(profileInput());
	assert.equal(profile.schema, GND_STATION_DECODER_PROFILE_SCHEMA);
	assert.equal(profile.version, GND_STATION_DECODER_PROFILE_VERSION);
	assert.equal(profile.authority, "delivery-specific-evidence-backed");
	assert.equal(profile.profileVersion, "1.0.0");
	assert.equal(profile.effect, "decoder-eligibility-only");
	assert.ok(Object.isFrozen(profile));
	assert.ok(Object.isFrozen(profile.sourceFingerprints));
});

test("eligible claim remains evidence-only and intrinsically unbound", () => {
	const result = assessGndStationDecoderEligibility({
		frame: frame(),
		claimId: "claim-7",
		profile: defineGndStationDecoderProfile(profileInput()),
	});
	assert.deepEqual(result, {
		addressDecodingEligible: true,
		profileId: "delivery-1720/v1",
		profileVersion: "1.0.0",
		claimId: "claim-7",
		scope: "source-address-decoding-only",
		remainingBlockers: ["INTRINSIC_S_BINDING_NOT_ESTABLISHED"],
		diagnostics: [],
	});
});

test("rejects fingerprints and reference systems outside the profile scope", () => {
	const profile = defineGndStationDecoderProfile(profileInput());
	const result = assessGndStationDecoderEligibility({ frame: frame({}, {
		source: { fingerprint: "sha256:other" },
	}), claimId: "claim-7", profile });
	assert.equal(result.addressDecodingEligible, false);
	assert.ok(result.diagnostics.includes("SOURCE_FINGERPRINT_NOT_PROFILED"));

	const referenceMismatch = assessGndStationDecoderEligibility({
		frame: frame({ referenceSystem: "UNKNOWN" }), claimId: "claim-7", profile,
	});
	assert.ok(referenceMismatch.diagnostics.includes("REFERENCE_SYSTEM_NOT_PROFILED"));
});

test("rejects ambiguous context, incomplete addresses, and unsupported frame versions", () => {
	const profile = defineGndStationDecoderProfile(profileInput());
	const ambiguous = assessGndStationDecoderEligibility({
		frame: frame({
			stationContexts: { start: [{}, {}], end: [{}] },
			externalAddressClaims: { start: null, end: 2, encoding: "source-value-uninterpreted" },
		}),
		claimId: "claim-7",
		profile,
	});
	assert.equal(ambiguous.addressDecodingEligible, false);
	assert.ok(ambiguous.diagnostics.includes("STATION_CONTEXT_NOT_UNIQUE"));
	assert.ok(ambiguous.diagnostics.includes("ADDRESS_CLAIM_INCOMPLETE"));

	const unsupported = assessGndStationDecoderEligibility({
		frame: frame({}, { version: 2 }), claimId: "claim-7", profile,
	});
	assert.deepEqual(unsupported.diagnostics, ["UNSUPPORTED_STATION_FRAME"]);
});

test("rejects incoherent endpoint contexts and retains the profile blocker on scope mismatch", () => {
	const profile = defineGndStationDecoderProfile(profileInput());
	const incoherent = assessGndStationDecoderEligibility({ frame: frame({ stationContexts: {
		start: [{ route: 1720, directionCode: 1, stationClaim: 10, encoding: "source-value-uninterpreted" }],
		end: [{ route: 1730, directionCode: 2, stationClaim: 20, encoding: "source-value-uninterpreted" }],
	} }), claimId: "claim-7", profile });
	assert.equal(incoherent.addressDecodingEligible, false);
	assert.ok(incoherent.diagnostics.includes("STATION_CONTEXT_NOT_COHERENT"));
	const mismatch = assessGndStationDecoderEligibility({ frame: frame({ referenceSystem: "OTHER" }), claimId: "claim-7", profile });
	assert.ok(mismatch.remainingBlockers.includes("GND_STATION_ENCODING_PROFILE_REQUIRED"));
});

test("malformed persisted profiles fail closed without throwing", () => {
	const malformed = { schema: GND_STATION_DECODER_PROFILE_SCHEMA, version: GND_STATION_DECODER_PROFILE_VERSION, profileId: "x", profileVersion: "1" };
	const result = assessGndStationDecoderEligibility({ frame: frame(), claimId: "claim-7", profile: malformed });
	assert.equal(result.addressDecodingEligible, false);
	assert.deepEqual(result.diagnostics, ["UNSUPPORTED_DECODER_PROFILE"]);
});

test("schema-shaped but incomplete persisted profiles cannot satisfy encoding eligibility", () => {
	const valid = defineGndStationDecoderProfile(profileInput());
	const incomplete = { ...valid, addressEncoding: undefined, evidenceReference: undefined };
	const result = assessGndStationDecoderEligibility({ frame: frame(), claimId: "claim-7", profile: incomplete });
	assert.equal(result.addressDecodingEligible, false);
	assert.ok(result.remainingBlockers.includes("GND_STATION_ENCODING_PROFILE_REQUIRED"));
	assert.deepEqual(result.diagnostics, ["UNSUPPORTED_DECODER_PROFILE"]);
});

test("invalid or universal profiles fail closed", () => {
	assert.throws(() => defineGndStationDecoderProfile(profileInput({ sourceFingerprints: [] })), /source fingerprint/);
	assert.throws(() => defineGndStationDecoderProfile(profileInput({ evidenceReference: "" })), /evidence reference/);
	assert.throws(() => defineGndStationDecoderProfile(profileInput({ profileVersion: "" })), /profile version/);
	assert.throws(() => defineGndStationDecoderProfile(profileInput({ typeCodes: ["*"] })), /type code/);
	assert.throws(() => defineGndStationDecoderProfile(profileInput({ addressEncoding: "source-value-uninterpreted" })), /concrete address encoding/);
});
