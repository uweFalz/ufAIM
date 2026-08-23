import assert from "node:assert/strict";
import test from "node:test";
import { buildGndConstructiveStationFrameEvidence } from "../src/import/evidence/buildGndConstructiveStationFrameEvidence.js";
import {
	positiveType6Jump,
	ppCode4LocalPreserveOnly,
	ppCode5UnknownFailClosed,
	rawDeltaIndependentOfEkpar1,
} from "./fixtures/gnd-station-frame/publicSyntheticStationCases.mjs";

const frameFor = (fixture) => buildGndConstructiveStationFrameEvidence({
	evidenceId: `fixture:${fixture.name}`,
	sourceEnvelope: fixture.sourceEnvelope,
});

test("public positive type-6 fixture remains a source jump claim, not a decoded mapping", () => {
	const frame = frameFor(positiveType6Jump);
	const claim = frame.claims[0];

	assert.equal(claim.typeCode, 6);
	assert.equal(claim.claimKind, "kilometre-jump-candidate");
	assert.deepEqual(claim.externalAddressClaims, {
		start: 596000,
		end: 596187,
		encoding: "source-value-uninterpreted",
	});
	assert.equal(claim.admission, "evidence-only");
	assert.equal(Object.hasOwn(claim, "mapping"), false);
});

test("raw type-6 address delta and EKPAR1 stay independent source observations", () => {
	const claim = frameFor(rawDeltaIndependentOfEkpar1).claims[0];
	const rawDelta = claim.externalAddressClaims.end - claim.externalAddressClaims.start;

	assert.equal(rawDelta, -187);
	assert.equal(claim.parameters.EKPAR1, -200);
	assert.notEqual(rawDelta, claim.parameters.EKPAR1);
	assert.equal(claim.externalAddressClaims.encoding, "source-value-uninterpreted");
	assert.equal(Object.hasOwn(claim, "direction"), false);
	assert.equal(Object.hasOwn(claim, "length"), false);
});

test("PP code 4 is preserved locally and is not promoted to chainage direction", () => {
	const claim = frameFor(ppCode4LocalPreserveOnly).claims[0];

	assert.equal(claim.stationContexts.start[0].directionCode, 4);
	assert.equal(claim.stationContexts.end[0].directionCode, 4);
	assert.equal(claim.stationContexts.start[0].sourceCells.PSTRRIKZ.rawValue, 4);
	assert.equal(claim.stationContexts.start[0].encoding, "source-value-uninterpreted");
	assert.equal(Object.hasOwn(claim.stationContexts.start[0], "direction"), false);
	assert.equal(claim.admission, "evidence-only");
});

test("unknown PP code 5 fails closed as uninterpreted evidence", () => {
	const frame = frameFor(ppCode5UnknownFailClosed);
	const claim = frame.claims[0];

	assert.equal(claim.stationContexts.start[0].directionCode, 5);
	assert.equal(claim.stationContexts.end[0].directionCode, 5);
	assert.equal(claim.stationContexts.start[0].encoding, "source-value-uninterpreted");
	assert.equal(frame.constructiveAdmission, "not-performed");
	assert.equal(claim.admission, "evidence-only");
	assert.ok(claim.blockers.includes("GND_STATION_ENCODING_PROFILE_REQUIRED"));
	assert.ok(claim.blockers.includes("INTRINSIC_S_BINDING_NOT_ESTABLISHED"));
	assert.equal(Object.hasOwn(claim, "mapping"), false);
});
