import assert from "node:assert/strict";
import test from "node:test";

const BASE = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const {
	createAlignmentDesignProfile,
	AlignmentDesignProfileError,
	PROFILE_STATUSES,
	GRAVITY,
	STANDARD_DYNAMIC_GAUGE,
} = await import(new URL("AlignmentDesignProfile.js", BASE));
const { hauptbahn, DECLARED_PROFILES, kmh, mm } =
	await import(new URL("profiles/index.js", BASE));
const { createAlignmentConstraintBuilder, EVIDENCE_ONLY } =
	await import(new URL("AlignmentConstraintBuilder.js", BASE));

const sourced = (value, source = "test") => ({ value, source });

const minimal = (overrides = {}) => createAlignmentDesignProfile({
	id: "t",
	source: "test",
	speed: sourced(kmh(100)),
	maximumCant: sourced(mm(150)),
	maximumCantDeficiency: sourced(mm(100)),
	...overrides,
});

// ---------------------------------------------------------------- provenance

test("a limit without a source is refused, and so is the profile", () => {
	// A limit nobody can trace cannot be reviewed, and will be copied into the
	// next project by someone who assumes it was.
	assert.throws(
		() => createAlignmentDesignProfile({
			id: "t", source: "test",
			speed: 27.8,                             // a bare number, not a declaration
			maximumCant: sourced(mm(150)), maximumCantDeficiency: sourced(mm(100)),
		}),
		(e) => e instanceof AlignmentDesignProfileError && e.code === "MISSING_PROVENANCE"
	);
	assert.throws(
		() => minimal({ maximumCant: { value: mm(150), source: "   " } }),
		(e) => e.code === "MISSING_PROVENANCE"
	);
	assert.throws(
		() => createAlignmentDesignProfile({
			id: "t",
			speed: sourced(kmh(100)),
			maximumCant: sourced(mm(150)), maximumCantDeficiency: sourced(mm(100)),
		}),
		(e) => e.code === "MISSING_PROVENANCE" && /where it comes from/.test(e.message)
	);
	assert.throws(() => minimal({ id: "  " }), (e) => e.code === "MISSING_ID");
});

test("a profile says whether its numbers have been checked", () => {
	assert.deepEqual([...PROFILE_STATUSES], ["candidate", "confirmed"]);
	assert.equal(minimal().status, "candidate", "unread is the default, not confirmed");
	assert.throws(() => minimal({ status: "probably fine" }), (e) => e.code === "UNKNOWN_STATUS");
	// claiming "confirmed" is a separate matter and is not free: see the test
	// that follows on what it costs
});

// ---------------------------------------------------------------- kinematics

test("the smallest radius is the cant relation, not a table", () => {
	// R = s V^2 / (g (u + u_f)), the equilibrium-cant relation rearranged
	const V = kmh(160);
	const profile = createAlignmentDesignProfile({
		id: "t", source: "test",
		speed: sourced(V), maximumCant: sourced(mm(160)), maximumCantDeficiency: sourced(mm(100)),
	});
	const expected = (STANDARD_DYNAMIC_GAUGE * V * V) / (GRAVITY * (0.16 + 0.10));
	assert.ok(Math.abs(profile.minimumRadius - expected) < 1e-9, `${profile.minimumRadius} vs ${expected}`);
	assert.ok(Math.abs(profile.maximumCurvature - 1 / expected) < 1e-15);
	assert.equal(profile.radiusBinding, "kinematics");

	// and it names what it used, so the number can be argued with
	const derivation = profile.derivations.find((d) => d.quantity === "minimumRadius");
	assert.equal(derivation.formula, "s V^2 / (g (u + u_f))");
	assert.equal(derivation.from.length, 3);

	// more speed needs more radius; more cant allows less
	assert.ok(minimal({ speed: sourced(kmh(200)) }).minimumRadius > minimal().minimumRadius);
	assert.ok(minimal({ maximumCant: sourced(mm(180)) }).minimumRadius < minimal().minimumRadius);
});

test("a rule-book floor is not a competing derivation but a floor", () => {
	// At 40 km/h the kinematics allows a very tight curve; the regulation does
	// not, and the regulation wins. It cannot work the other way: a floor below
	// what the kinematics needs changes nothing.
	const slow = minimal({
		speed: sourced(kmh(40)),
		absoluteMinimumRadius: sourced(300, "EBO § 6"),
	});
	assert.equal(slow.minimumRadius, 300);
	assert.equal(slow.radiusBinding, "absolute-minimum");
	assert.ok(slow.kinematicRadius < 300, "and it still records what the kinematics said");

	const fast = minimal({
		speed: sourced(kmh(160)),
		absoluteMinimumRadius: sourced(300, "EBO § 6"),
	});
	assert.equal(fast.radiusBinding, "kinematics");
	assert.ok(fast.minimumRadius > 300);
});

test("the ramp length is the gradient, not a rate", () => {
	// L = m du. Ril 800.0110 Tab. 7 sets m; du is the cant change across the ramp
	// and is bounded here by the largest cant the profile admits, because the
	// solver carries neither that coupling nor a general inequality.
	const profile = createAlignmentDesignProfile({
		id: "t", source: "test",
		speed: sourced(kmh(100)), maximumCant: sourced(mm(150)),
		maximumCantDeficiency: sourced(mm(100)), cantGradient: sourced(600),
	});
	assert.ok(Math.abs(profile.minimumTransitionLength - 600 * 0.15) < 1e-9);
	assert.equal(profile.transitionBinding, "m du");

	// with no gradient declared there is no transition length to derive, and the
	// module says so rather than inventing one
	assert.equal(minimal().minimumTransitionLength, null);
	assert.equal(minimal().minimumLengthFor("transition"), 0);

	// a declared length raises the derived one where it is stricter
	const declaredLonger = createAlignmentDesignProfile({
		id: "t", source: "test",
		speed: sourced(kmh(100)), maximumCant: sourced(mm(100)),
		maximumCantDeficiency: sourced(mm(130)), cantGradient: sourced(600),
		minimumLength: { transition: sourced(90) },
	});
	assert.equal(declaredLonger.minimumLengthFor("transition"), 90, "60 m derived, 90 m declared");
});

test("a ramp steeper than the regulation is refused, whatever the design rules allow", () => {
	// EBO § 6 (4) caps the ramp at 1:400. Steeper means a smaller m, so a gradient
	// below the declared limit is an error, the same way a cant above its cap is.
	assert.throws(
		() => minimal({ cantGradient: sourced(250), regulatoryGradientLimit: sourced(400, "EBO § 6 (4)") }),
		(e) => {
			assert.equal(e.code, "RAMP_STEEPER_THAN_REGULATION");
			assert.match(e.message, /1:250/);
			assert.match(e.message, /1:400/);
			return true;
		}
	);
	assert.doesNotThrow(() => minimal({
		cantGradient: sourced(600), regulatoryGradientLimit: sourced(400, "EBO § 6 (4)"),
	}), "flatter than the limit is what a planning value is");
});

test("the gauge constant reproduces the factor the literature quotes", () => {
	// The one number in the radius derivation that is not a declared limit. It is
	// geometry of the vehicle-track pair, and the check on it is that it gives
	// u0 = 11.8 V^2 / R with V in km/h.
	assert.ok(Math.abs(STANDARD_DYNAMIC_GAUGE / (3.6 ** 2 * GRAVITY) * 1000 - 11.8) < 0.01);
});

// ---------------------------------------------------------------- exceptions

test("a local departure is declared per element, with its own reason", () => {
	const profile = minimal({
		speed: sourced(kmh(160)),
		cantGradient: sourced(600),
		exceptions: {
			E2: { minimumRadius: 400, source: "existing curve retained, approved 2019" },
			E5: { minimumLength: 40, source: "station throat" },
		},
	});
	assert.deepEqual([...profile.exceptionIds], ["E2", "E5"]);
	assert.ok(Math.abs(profile.maximumCurvatureFor("E2") - 1 / 400) < 1e-15);
	assert.ok(
		profile.maximumCurvatureFor("E6") < profile.maximumCurvatureFor("E2"),
		"an element without an exception keeps the profile's own limit"
	);
	assert.equal(profile.minimumLengthFor("transition", "E5"), 40);
	assert.ok(profile.minimumLengthFor("transition", "E9") > 40, "and E9 does not inherit it");

	assert.throws(
		() => minimal({ exceptions: { E2: { minimumRadius: 400 } } }),
		(e) => e.code === "MISSING_PROVENANCE" && /cannot say why/.test(e.message)
	);
});

// ---------------------------------------------------------------- declared profiles

test("a profile cannot call itself confirmed while a limit is unread", () => {
	// "confirmed" is a claim about every number in the profile. A profile marked
	// so is one nobody will check again, which is exactly why the claim may not
	// be made loosely.
	assert.throws(
		() => minimal({ status: "confirmed" }),
		(e) => {
			assert.equal(e.code, "UNVERIFIED_LIMITS");
			assert.ok(e.detail.unverified.includes("maximumCant"));
			return true;
		}
	);
	const read = createAlignmentDesignProfile({
		id: "t", source: "test",
		speed: { value: kmh(100), source: "read", verified: true },
		maximumCant: { value: mm(150), source: "read", verified: true },
		maximumCantDeficiency: { value: mm(100), source: "read", verified: true },
		status: "confirmed",
	});
	assert.equal(read.status, "confirmed");
	assert.deepEqual([...read.unverified], [], "confirmed means nothing is left unread");

	// and unread limits are named even while the profile stays a candidate
	assert.ok(minimal().unverified.includes("maximumCantDeficiency"));
});

test("a cant above the regulation is refused, whatever the design rules allow", () => {
	// EBO § 6 (3) caps the cant at 180 mm. An operator's design rule cannot lift
	// a regulation, so a declared cant above the declared cap is an error rather
	// than a preference.
	assert.throws(
		() => minimal({
			maximumCant: sourced(mm(200)),
			regulatoryCantLimit: sourced(mm(180), "EBO § 6 (3)"),
		}),
		(e) => {
			assert.equal(e.code, "CANT_ABOVE_REGULATION");
			assert.ok(/200 mm/.test(e.message) && /180 mm/.test(e.message));
			return true;
		}
	);
	assert.doesNotThrow(() => minimal({
		maximumCant: sourced(mm(180)),
		regulatoryCantLimit: sourced(mm(180), "EBO § 6 (3)"),
	}), "the cap itself is admissible");
});

test("each limit is cited to the document that actually contains it", () => {
	// EBO § 6 read at gesetze-im-internet.de and cross-checked at buzer.de;
	// Ril 800.0110 read in version 3.0, valid from 2021-02-01. Between them every
	// limit has a source someone has looked at, which is what "confirmed" means.
	const declared = DECLARED_PROFILES["hauptbahn-V160"]().declared;

	assert.equal(declared.absoluteMinimumRadius.value, 300, "EBO § 6 (1)");
	assert.equal(declared.regulatoryCantLimit.value, 0.18, "EBO § 6 (3)");
	assert.equal(declared.regulatoryGradientLimit.value, 400, "EBO § 6 (4)");
	for (const name of ["absoluteMinimumRadius", "regulatoryCantLimit", "regulatoryGradientLimit"]) {
		assert.match(declared[name].source, /EBO § 6/);
	}

	assert.equal(declared.maximumCant.value, 0.16, "Ril Tab. 4, ballasted track");
	assert.equal(declared.maximumCantDeficiency.value, 0.13, "Ril Tab. 5, r >= 650 m");
	assert.equal(declared.cantGradient.value, 600, "Ril Tab. 7, Regelwert");
	for (const name of ["maximumCant", "maximumCantDeficiency", "cantGradient"]) {
		assert.match(declared[name].source, /Ril 800\.0110/);
	}

	for (const limit of Object.values(declared)) {
		if (limit === null || typeof limit.source !== "string") continue;
		assert.equal(limit.verified, true, `unread: ${limit.source}`);
		assert.doesNotMatch(limit.source, /CHECK/);
	}
});

test("the rate limits are gone, along with the rule that needed them", () => {
	// Reading Ril produced the finding that retired them: it governs the
	// transition through the ramp gradient and states no rate over time anywhere.
	// A limit the governing rule book does not contain could never be confirmed
	// against it, so the rule was changed to the one the rule book uses rather
	// than the limits re-sourced to another document.
	const profile = DECLARED_PROFILES["hauptbahn-V160"]();
	assert.equal("maximumCantRate" in profile.declared, false);
	assert.equal("maximumDeficiencyRate" in profile.declared, false);
	assert.equal(profile.transitionBinding, "m du");
});

test("the shipped profiles are confirmed, and nothing in them is unread", () => {
	const names = Object.keys(DECLARED_PROFILES);
	assert.ok(names.length >= 2);
	for (const name of names) {
		const profile = DECLARED_PROFILES[name]();
		assert.equal(profile.status, "confirmed", `${name} still has something unread`);
		assert.deepEqual([...profile.unverified], [], `${name}: ${profile.unverified.join(", ")}`);
		assert.ok(profile.minimumRadius > 0);
		assert.ok(profile.minimumTransitionLength > 0);
	}

	// Faster line, larger radius - the cheapest check that these are derived and
	// not typed in. The transition does NOT follow speed: the Ril rule is gradient
	// times cant change, and neither of those is a speed.
	const [slow, fast] = [DECLARED_PROFILES["hauptbahn-V100"](), DECLARED_PROFILES["hauptbahn-V200"]()];
	assert.ok(fast.minimumRadius > slow.minimumRadius);
	assert.equal(fast.minimumTransitionLength, slow.minimumTransitionLength);
});

// ---------------------------------------------------------------- into the constraints

test("a profile reaches the constraint builder with its provenance intact", () => {
	const profile = hauptbahn({
		speedKmh: 100,
		cantMm: 130,
		exceptions: { E1: { minimumRadius: 400, source: "existing curve retained" } },
	});
	const built = createAlignmentConstraintBuilder({
		endPose: { x: 1000, y: 250, theta: 0.3 },
		elementSequence: ["E0", "E1", "E2"],
		minimumElementLength: 20,
		elementKinds: { E0: "straight", E1: "arc", E2: "transition" },
		design: profile,
	});
	// No admitUnconfirmedDesign: the shipped profiles are confirmed now, so they
	// need no word and the answer built on them is admissible.
	assert.equal(built.admission, "confirmed");
	assert.equal(built.admissible, true);

	assert.equal(built.design.id, "hauptbahn-V100");
	assert.equal(built.design.status, "confirmed");
	assert.ok(built.design.derivations.length >= 2, "the derivations travel with it");
	assert.deepEqual([...built.design.exceptions], ["E1"]);

	// the exception reaches the bound, and says it is one
	const [curvature] = built.designBounds;
	assert.equal(curvature.elementId, "E1");
	assert.equal(curvature.reason, "exception");
	assert.ok(Math.abs(curvature.maximum - 1 / 400) < 1e-15);
	assert.ok(Math.abs(curvature.minimum + 1 / 400) < 1e-15);

	// and the transition's length floor comes from the profile, not from the
	// sequence bound it exceeds
	const transition = built.bounds.find((bound) => bound.elementId === "E2");
	assert.equal(transition.binding, "design");
	assert.ok(Math.abs(transition.minimum - profile.minimumTransitionLength) < 1e-9);
	assert.equal(transition.sequenceMinimum, 20);
});
