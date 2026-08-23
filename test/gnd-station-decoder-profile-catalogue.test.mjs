import assert from "node:assert/strict";
import test from "node:test";
import { defineGndStationDecoderProfile } from "../src/import/evidence/gndStationDecoderProfileContract.js";
import {
	createGndStationDecoderProfileCatalogue,
	isIssuedGndStationDecoderProfileResolution,
	resolveGndStationDecoderProfile,
} from "../src/import/evidence/gndStationDecoderProfileCatalogue.js";

const profile = (profileId = "delivery-1720", profileVersion = "1.0.0") => defineGndStationDecoderProfile({
	profileId, profileVersion,
	sourceFingerprints: ["sha256:delivery-a"],
	referenceSystems: ["DB_REF"], typeCodes: [6],
	addressEncoding: "documented-delivery-integer-metres/v1",
	stationContextEncoding: "documented-delivery-integer-metres/v1",
	evidenceReference: "research:GND-1720-001",
});

const entry = (overrides = {}) => ({
	status: "released",
	profile: profile(),
	decoder: { id: "gnd-explicit-integer-metres", version: "1.1.0" },
	evidenceArtifacts: [{ reference: "research:GND-1720-001", digest: `sha256:${"a".repeat(64)}` }],
	...overrides,
});
const rootDigest = `sha256:${"b".repeat(64)}`;
const makeCatalogue = (input = {}) => createGndStationDecoderProfileCatalogue({ registryId: "test-profile-registry", rootDigest, ...input });

test("catalogue issues immutable, deterministic receipts for released profiles", async () => {
	const catalogue = makeCatalogue({ catalogueVersion: "1.0.0", entries: [entry()] });
	const one = await resolveGndStationDecoderProfile(catalogue, { profileId: "delivery-1720", profileVersion: "1.0.0" });
	const two = await resolveGndStationDecoderProfile(catalogue, { profileId: "delivery-1720", profileVersion: "1.0.0" });
	assert.equal(one.profile.profileId, "delivery-1720");
	assert.equal(one.verified, true);
	assert.equal(one.receipt.registryId, "test-profile-registry");
	assert.equal(one.receipt.registryVersion, "1.0.0");
	assert.equal(one.receipt.registryRootDigest, rootDigest);
	assert.match(one.receipt.receiptId, /^sha256:[a-f0-9]{64}$/);
	assert.equal(isIssuedGndStationDecoderProfileResolution(one), true);
	assert.equal(isIssuedGndStationDecoderProfileResolution(structuredClone(one)), false);
	assert.deepEqual(one.receipt, two.receipt);
	assert.equal(one.receipt.catalogueVersion, "1.0.0");
	assert.deepEqual(one.receipt.profileIdentity, { profileId: "delivery-1720", profileVersion: "1.0.0" });
	assert.match(one.receipt.profileContentDigest, /^sha256:[a-f0-9]{64}$/);
	assert.deepEqual(one.receipt.decoder, { id: "gnd-explicit-integer-metres", version: "1.1.0" });
	assert.deepEqual(one.receipt.evidenceArtifacts, entry().evidenceArtifacts);
	assert.match(one.receipt.receiptContentDigest, /^sha256:[a-f0-9]{64}$/);
	assert.ok(Object.isFrozen(catalogue));
	assert.ok(Object.isFrozen(one));
	assert.ok(Object.isFrozen(one.receipt.evidenceArtifacts));
});

test("candidate profiles are fail-closed unless explicitly requested", async () => {
	const catalogue = makeCatalogue({ catalogueVersion: "1.0.0", entries: [entry({ status: "candidate" })] });
	assert.equal(await resolveGndStationDecoderProfile(catalogue, { profileId: "delivery-1720", profileVersion: "1.0.0" }), null);
	const selected = await resolveGndStationDecoderProfile(catalogue, { profileId: "delivery-1720", profileVersion: "1.0.0", includeCandidate: true });
	assert.equal(selected.receipt.status, "candidate");
});

test("rejects duplicate identities, malformed status, universal content, and missing evidence", () => {
	assert.throws(() => makeCatalogue({ catalogueVersion: "1.0.0", entries: [entry(), entry()] }), /Duplicate profile identity/);
	assert.throws(() => makeCatalogue({ catalogueVersion: "1.0.0", entries: [entry({ status: "trusted" })] }), /status/);
	assert.throws(() => makeCatalogue({ catalogueVersion: "1.0.0", entries: [entry({ evidenceArtifacts: [] })] }), /evidence artifact/);
	assert.throws(() => makeCatalogue({ catalogueVersion: "1.0.0", entries: [entry({ evidenceArtifacts: [{ reference: "x", digest: "not-a-digest" }] })] }), /digest/);
	assert.throws(() => makeCatalogue({ catalogueVersion: "1.0.0", entries: [entry({ profile: { ...profile(), sourceFingerprints: ["*"] } })] }), /profile content/);
});

test("supports separately versioned profiles and rejects malformed decoder/catalogue versions", async () => {
	const next = entry({ profile: profile("delivery-1720", "2.0.0") });
	const catalogue = makeCatalogue({ catalogueVersion: "1.0.0", entries: [entry(), next] });
	assert.equal((await resolveGndStationDecoderProfile(catalogue, { profileId: "delivery-1720", profileVersion: "2.0.0" })).profile.profileVersion, "2.0.0");
	assert.throws(() => makeCatalogue({ catalogueVersion: "latest", entries: [entry()] }), /catalogue version/);
	assert.throws(() => makeCatalogue({ catalogueVersion: "1.0.0", entries: [entry({ decoder: { id: "decoder", version: "vNext" } })] }), /decoder version/);
});

test("resolution requires an exact identity and refuses catalogue-shaped forgeries", async () => {
	const catalogue = makeCatalogue({ catalogueVersion: "1.0.0", entries: [entry()] });
	assert.equal(await resolveGndStationDecoderProfile(catalogue, { profileId: "delivery-1720", profileVersion: "2.0.0" }), null);
	await assert.rejects(() => resolveGndStationDecoderProfile({ ...catalogue, catalogueVersion: "9.9.9" }, { profileId: "delivery-1720", profileVersion: "1.0.0" }), /registry-issued catalogue/);
});
