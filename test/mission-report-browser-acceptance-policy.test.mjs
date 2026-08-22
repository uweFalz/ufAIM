import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const policyUrl = new URL("../docs/MISSION_REPORT_POLICY.md", import.meta.url);

test("visible browser journeys are the primary gate and reload is secondary", async () => {
	const policy = await readFile(policyUrl, "utf8");
	const sectionStart = policy.indexOf("### Visible user-journey gate");
	const primaryGate = policy.indexOf("The primary gate must exercise", sectionStart);
	const durabilityGate = policy.indexOf("secondary durability", primaryGate);

	assert.notEqual(sectionStart, -1);
	assert.ok(primaryGate > sectionStart);
	assert.ok(durabilityGate > primaryGate);
	assert.match(policy.slice(sectionStart), /reload[\s\S]{0,200}cannot substitute/i);
	assert.match(policy.slice(sectionStart), /normal-start file-picker or drop\s+surface/);
	assert.match(policy.slice(sectionStart), /persistent busy\/progress indication/);
	assert.match(policy.slice(sectionStart), /passing durability gate never\s+upgrades/i);
});
