import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildGndSevenLineRoleAssembly } from "../../../app/domain/workspace/buildGndSevenLineRoleAssembly.js";

test("mixed routes, open associations and missing PP remain unassigned", () => {
	const mixed = buildGndSevenLineRoleAssembly({ assignments: [{ family: "EL", route: "1", directionCode: "1", sourceIds: ["a"] }, { family: "EL", route: "2", directionCode: "2", sourceIds: ["b"] }] });
	assert.ok(mixed.rows.every((row) => row.status === "unassigned"));
	const open = buildGndSevenLineRoleAssembly({ assignments: [{ family: "EH", route: "1", directionCode: "1", sourceIds: ["eh"] }], relationEvidence: { status: "open-candidates", candidates: [] } }, { targetItemId: "A" });
	assert.equal(open.rows[0].status, "unassigned");
});

test("role assembly has no filename order proximity or constructive EH/EU inference", async () => {
	const source = await readFile(new URL("../../../app/domain/workspace/buildGndSevenLineRoleAssembly.js", import.meta.url), "utf8");
	assert.doesNotMatch(source, /fileName|dropOrder|proximity|PSTRRIKZ\s*===\s*["']0["'].*right/i);
	assert.match(source, /source-association-only/);
	assert.match(source, /displayCode !== "3"/);
});
