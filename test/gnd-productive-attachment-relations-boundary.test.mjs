import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const DERIVER = new URL("../src/import/relations/deriveGndAttachmentRelationCandidates.js", import.meta.url);
const BUILDER = new URL("../src/import/build/buildImportResultFromParsed.js", import.meta.url);

test("productive derivation remains a pure import relation boundary", async () => {
	const source = await fs.readFile(DERIVER, "utf8");
	assert.doesNotMatch(source, /from\s+["'](?:@app|@spot|@domain)|Spot\.|IndexedDB|localStorage|distance|geometry/i);
	assert.match(source, /attachmentStatus\s*!==\s*"uniquely-attachable"/);
	assert.match(source, /item\?\.source\?\.index\s*===\s*index/);
	assert.match(source, /matches\.length\s*===\s*1/);
	assert.doesNotMatch(source, /ownersByKey|groupOwnersByAttachmentKey|evidence\.attachmentKey\s*===|evidence\.attachmentKey\)\s*!==/);
	assert.match(source, /removeCollidingEvidenceClaims/);
	assert.doesNotMatch(source, /(?:profile|cant)EvidenceOf|confidence:\s*1|promotable:\s*true/);
	assert.match(source, /claimScope:\s*"source-association-only"/);
	assert.doesNotMatch(source.match(/const identityParts[^;]+/)?.[0] ?? "", /auditKey|attachmentKey/);
});

test("canonical result builder is the only production integration point", async () => {
	const source = await fs.readFile(BUILDER, "utf8");
	assert.match(source, /deriveGndAttachmentRelationCandidates\(\{\s*alignments,\s*items,\s*sourceLayer,\s*source\s*\}\)/);
	assert.match(source, /explicitRelationCandidates/);
	assert.match(source, /buildGndNormalizedSourceLayer\(doc\.meta\.sourceEnvelope\)/);
});
