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

test("a transition is as long as the strictest of its rate limits", () => {
	// L >= V u / (du/dt), L >= n u, L >= V u_f / (du_f/dt): all three apply, so
	// the longest binds, and the others are still reported.
	const V = kmh(100);
	const profile = createAlignmentDesignProfile({
		id: "t", source: "test",
		speed: sourced(V), maximumCant: sourced(mm(150)), maximumCantDeficiency: sourced(mm(100)),
		maximumCantRate: sourced(mm(50)),
		cantGradient: sourced(400),
		maximumDeficiencyRate: sourced(mm(55)),
	});
	const byRate = (V * 0.15) / 0.05;
	const byGradient = 400 * 0.15;
	const byDeficiency = (V * 0.10) / 0.055;
	assert.ok(Math.abs(profile.minimumTransitionLength - Math.max(byRate, byGradient, byDeficiency)) < 1e-9);
	assert.equal(profile.transitionBinding, "V u / (du/dt)");
	assert.equal(
		profile.derivations.filter((d) => d.quantity === "minimumTransitionLength").length, 3,
		"the rules that did not bind are still on the record"
	);

	// with no rate declared there is no transition length to derive, and the
	// module says so rather than inventing one
	assert.equal(minimal().minimumTransitionLength, null);
	assert.equal(minimal().minimumLengthFor("transition"), 0);
});

// ---------------------------------------------------------------- exceptions

test("a local departure is declared per element, with its own reason", () => {
	const profile = minimal({
		speed: sourced(kmh(160)),
		maximumCantRate: sourced(mm(50)),
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
	// Ril 800.0110 read in version 3.0, valid from 2021-02-01. Between them they
	// settle four of the six limits, and they settle which document each belongs
	// to - which is where this file had been wrong twice.
	const profile = DECLARED_PROFILES["hauptbahn-V160"]();
	const declared = profile.declared;

	// EBO: the 300 m floor (§ 6 (1)) and the 180 mm cant cap (§ 6 (3))
	for (const name of ["absoluteMinimumRadius", "regulatoryCantLimit"]) {
		assert.equal(declared[name].verified, true);
		assert.match(declared[name].source, /EBO § 6/);
	}
	assert.equal(declared.absoluteMinimumRadius.value, 300);
	assert.equal(declared.regulatoryCantLimit.value, 0.18);

	// Ril: the cant and the deficiency
	assert.equal(declared.maximumCant.verified, true);
	assert.equal(declared.maximumCant.value, 0.16, "Tab. 4, ballasted track");
	assert.match(declared.maximumCant.source, /Ril 800\.0110/);
	assert.equal(declared.maximumCantDeficiency.verified, true);
	assert.equal(declared.maximumCantDeficiency.value, 0.13, "Tab. 5, r >= 650 m");

	// The ramp gradient is in both, and 1:400 is the outer bound rather than the
	// planning value for every category - Ril names flatter ones.
	assert.equal(declared.cantGradient.verified, true);
	assert.match(declared.cantGradient.source, /EBO § 6 \(4\)/);
	assert.match(declared.cantGradient.source, /1:600/, "and that Ril goes flatter");
});

test("the two rate limits are not Ril quantities, and say so", () => {
	// The finding that reading the primary source produced. Ril 800.0110 governs
	// the transition through the ramp gradient and the ramp length; it contains
	// no rate over time anywhere - not "mm/s", not "Änderungsgeschwindigkeit",
	// not once in 31 pages. Both rates had been attributed to it. They are the
	// EN 13803 way of stating the same requirement, and reading Ril cannot
	// confirm them, however carefully it is read.
	const profile = DECLARED_PROFILES["hauptbahn-V160"]();
	for (const name of ["maximumCantRate", "maximumDeficiencyRate"]) {
		const limit = profile.declared[name];
		assert.equal(limit.verified, false, `${name} cannot be verified against Ril`);
		assert.match(limit.source, /CHECK/);
		assert.match(limit.source, /NOT in Ril 800\.0110/, `${name} must not claim to be Ril`);
		assert.match(limit.source, /EN 13803/, "and must name where it does come from");
	}
	assert.ok(profile.unverified.includes("maximumCantRate"));
	assert.ok(profile.unverified.includes("maximumDeficiencyRate"));
});

test("the shipped profiles are candidates, and every one of them says so", () => {
	const names = Object.keys(DECLARED_PROFILES);
	assert.ok(names.length >= 2);
	for (const name of names) {
		const profile = DECLARED_PROFILES[name]();
		assert.equal(profile.status, "candidate", `${name} claims to be confirmed`);
		assert.ok(profile.unverified.length > 0, `${name} is a candidate with nothing unread?`);
		assert.ok(profile.minimumRadius > 0);
		assert.ok(profile.minimumTransitionLength > 0);
		// every declared limit carries a source
		for (const [key, entry] of Object.entries(profile.declared)) {
			if (entry === null || key === "minimumLength") continue;
			assert.ok(entry.source && entry.source.trim(), `${name}.${key} has no source`);
		}
	}

	// faster line, larger radius and longer transitions - the ordering the
	// physics demands, which is the cheapest check that these are derived and
	// not typed in
	const [slow, fast] = [DECLARED_PROFILES["hauptbahn-V100"](), DECLARED_PROFILES["hauptbahn-V200"]()];
	assert.ok(fast.minimumRadius > slow.minimumRadius);
	assert.ok(fast.minimumTransitionLength > slow.minimumTransitionLength);
});

// ---------------------------------------------------------------- into the constraints

test("a profile reaches the constraint builder with its provenance intact", () => {
	const profile = hauptbahn({
		speedKmh: 100,
		cantMm: 140,
		exceptions: { E1: { minimumRadius: 400, source: "existing curve retained" } },
	});
	const built = createAlignmentConstraintBuilder({
		endPose: { x: 1000, y: 250, theta: 0.3 },
		elementSequence: ["E0", "E1", "E2"],
		minimumElementLength: 20,
		elementKinds: { E0: "straight", E1: "arc", E2: "transition" },
		design: profile,
		admitUnconfirmedDesign: EVIDENCE_ONLY,
	});
	assert.equal(built.admission, EVIDENCE_ONLY);
	assert.equal(built.admissible, false, "a candidate profile cannot yield an admissible answer");

	assert.equal(built.design.id, "hauptbahn-V100");
	assert.equal(built.design.status, "candidate");
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
