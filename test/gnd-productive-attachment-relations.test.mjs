import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";
import MDBReader from "../src/import/parsers/technet/gndEdit/mdb/node_modules/mdb-reader/lib/node/index.js";
import { extractGndMdb } from "../src/import/parsers/technet/gndEdit/gnd/extractGndMdb.js";

const rootUrl = new URL("../", import.meta.url);
const aliases = { "@src/": "src/", "@kimport/": "src/import/", "@spot/": "src/model/spot/", "@kgeom/": "src/lib/geom/", "@kmath/": "src/lib/math/", "@utils/": "src/lib/utils/" };
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "sheetjs") return nextResolve(new URL("test/gnd-mdb-spike/node_modules/xlsx/xlsx.mjs", rootUrl).href, context); for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context); return nextResolve(specifier, context); } });

globalThis.Worker = class NodeFixtureWorker {
	postMessage(message) {
		queueMicrotask(async () => {
			try {
				const envelope = await extractGndMdb({ ...message.payload, bytes: Buffer.from(message.payload.bytes), MDBReader });
				this.onmessage?.({ data: { type: "result", envelope } });
			} catch (error) {
				this.onmessage?.({ data: { type: "error", error: { code: error.code, message: error.message } } });
			}
		});
	}
	terminate() {}
};

const { runImportPipeline } = await import("../src/import/runImportPipeline.js");
const XLSX = await import("sheetjs");

async function importFixture(name) {
	const bytes = await fs.readFile(new URL(`./fixtures/gnd-mdb/${name}`, import.meta.url));
	return runImportPipeline({ name, size: bytes.length, async arrayBuffer() { return bytes; } }, { bytes: new Uint8Array(bytes) });
}

test("physical valid GND fixture yields exact unconfirmed EH and EU source associations", async () => {
	const result = await importFixture("valid-minimal-jet4.mdb");
	const relations = result.relationCandidates.filter((candidate) => candidate.type === "gndSourceEvidenceAssociation");
	assert.ok(relations.length >= 2);
	const families = new Set(relations.map((candidate) => candidate.source.family));
	assert.ok(families.has("EH"));
	assert.ok(families.has("EU"));
	for (const candidate of relations) {
		const target = result.items.find((item) => item.id === candidate.toId);
		assert.equal(target?.kind, "alignment");
		assert.equal(candidate.status.accepted, false);
		assert.equal(candidate.status.stage, "candidate");
		assert.equal(candidate.status.promotable, undefined);
		assert.equal(candidate.evidenceClass, "partial-evidence");
		assert.equal(candidate.constructive, false);
		assert.equal(candidate.role, "source-association-review-candidate");
		assert.equal(candidate.claimScope, "source-association-only");
		assert.equal(candidate.intrinsicMappingStatus, "not-established");
		assert.equal(candidate.domainRelationStatus, "not-established");
		assert.equal(candidate.confidence, undefined);
		assert.ok(["profile-source-evidence", "cant-source-evidence"].includes(candidate.associationKind));
		assert.match(candidate.fromId, /^gnd-source-evidence:/);
		assert.equal(candidate.source.objectName, target.source.objectName);
		assert.match(candidate.source.fingerprint, /^[a-f0-9]{64}$/);
		assert.ok(candidate.source.target.every((entry) => entry.sourceId && entry.rowRef));
		assert.ok(candidate.source.attachment.every((entry) => entry.sourceId && entry.rowRef));
		assert.deepEqual(candidate.source.directedPadChain, ["P1", "P2"]);
		assert.ok(candidate.source.contexts.pp.every((entry) => entry.sourceIds.length && entry.locators.length && entry.classification));
		assert.ok(candidate.source.contexts.pl.every((entry) => entry.sourceIds.length && entry.locators.length && entry.classification));
		if (candidate.source.family === "EH") assert.ok(candidate.source.contexts.ph.every((entry) => entry.sourceIds.length && entry.locators.length && entry.classification));
		assert.equal(candidate.origin, "parser-qualified-gnd-raw-source-evidence");
		assert.equal(candidate.derivedBy, "deriveGndAttachmentRelationCandidates");
		assert.equal(candidate.method, "exact-fingerprint-source-record-directed-chain-and-raw-context");
		assert.deepEqual(candidate.reasons, ["source-fingerprint-present", "exact-source-record-resolution", "exact-directed-pad-chain", "unique-conflict-free-raw-context"]);
	}
});

test("physical conflicting GND fixture creates no productive attachment relation", async () => {
	const result = await importFixture("conflicting-evidence-jet4.mdb");
	assert.deepEqual(result.relationCandidates.filter((candidate) => candidate.type === "gndSourceEvidenceAssociation"), []);
});

test("productive XLSX parser preserves disjoint raw chains sharing one rounded audit key", async () => {
	const workbook = XLSX.utils.book_new();
	const add = (name, rows) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
	add("X_ASC11_PP", [
		{ PAD: "P1", STRECKE: "SAME", STRRIKZ: 1, STATION: 0 },
		{ PAD: "P2", STRECKE: "SAME", STRRIKZ: 1, STATION: 100 },
		{ PAD: "P3", STRECKE: "SAME", STRRIKZ: 1, STATION: 0.0004 },
		{ PAD: "P4", STRECKE: "SAME", STRRIKZ: 1, STATION: 100.0004 },
	]);
	add("X_ASC12_PL", [
		{ PAD: "P1", LSYS: "LSYS", Y: 0, X: 0 }, { PAD: "P2", LSYS: "LSYS", Y: 100, X: 0 },
		{ PAD: "P3", LSYS: "LSYS", Y: 200, X: 0 }, { PAD: "P4", LSYS: "LSYS", Y: 300, X: 0 },
	]);
	add("X_ASC13_PH", [
		{ PAD: "P1", HSYS: "HSYS", H: 10 }, { PAD: "P2", HSYS: "HSYS", H: 11 },
		{ PAD: "P3", HSYS: "HSYS", H: 20 }, { PAD: "P4", HSYS: "HSYS", H: 21 },
	]);
	add("X_ASC21_EL", [
		{ PAD1: "P1", PAD2: "P2", ELSYS: "LSYS", ELTYP: 0, ELPAR1: 100, ELPAR2: 0, ELPAR3: 0, ELARIWI: 100 },
		{ PAD1: "P3", PAD2: "P4", ELSYS: "LSYS", ELTYP: 0, ELPAR1: 100, ELPAR2: 0, ELPAR3: 0, ELARIWI: 100 },
	]);
	add("X_ASC22_EH", [
		{ PAD1: "P1", PAD2: "P2", EHSYS: "HSYS", EHTYP: 0, EHPAR1: 100, EHPAR2: 0, EHPAR3: 0 },
		{ PAD1: "P3", PAD2: "P4", EHSYS: "HSYS", EHTYP: 0, EHPAR1: 100, EHPAR2: 0, EHPAR3: 0 },
	]);
	add("X_ASC23_EU", [
		{ PAD1: "P1", PAD2: "P2", EUTYP: 0, EUPAR1: 100, EUPAR2: 0, EUPAR3: 0 },
		{ PAD1: "P3", PAD2: "P4", EUTYP: 0, EUPAR1: 100, EUPAR2: 0, EUPAR3: 0 },
	]);
	add("X_ASC24_EK", []);
	const bytes = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
	const name = "rounded-key-collision.xlsx";
	const result = await runImportPipeline({ name, size: bytes.length, async arrayBuffer() { return bytes; } }, { bytes });
	const associations = result.relationCandidates.filter((candidate) => candidate.type === "gndSourceEvidenceAssociation");
	assert.equal(associations.length, 4);
	assert.equal(new Set(associations.map((candidate) => candidate.toId)).size, 2);
	assert.equal(new Set(associations.map((candidate) => candidate.source.directedPadChain.join(">"))).size, 2);
	assert.equal(new Set(associations.map((candidate) => candidate.source.auditAttachmentKey)).size, 1);
});
