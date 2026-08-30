import assert from "node:assert/strict";
import test from "node:test";
import { withRelativePathFile } from "../../../app/io/input/relativePathFile.js";

test("relative path facade reads the authorized source without constructing a Blob", async () => {
	const bytes = Uint8Array.from([0x4d, 0x44, 0x42]);
	const calls = [];
	const source = {
		name: "sample.mdb",
		size: bytes.length,
		type: "application/octet-stream",
		lastModified: 7,
		async arrayBuffer() { calls.push("arrayBuffer"); return bytes.buffer; },
		async text() { calls.push("text"); return "MDB"; },
		stream() { calls.push("stream"); return "stream"; },
		slice(...args) { calls.push(["slice", ...args]); return "slice"; },
	};
	const file = withRelativePathFile(source, "/samples/posN/sample.mdb");
	assert.equal(file.name, "samples/posN/sample.mdb");
	assert.equal(file.webkitRelativePath, "samples/posN/sample.mdb");
	assert.equal(file.size, 3);
	assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
	assert.equal(await file.text(), "MDB");
	assert.equal(file.stream(), "stream");
	assert.equal(file.slice(1, 2), "slice");
	assert.deepEqual(calls, ["arrayBuffer", "text", "stream", ["slice", 1, 2]]);
	assert.equal(Object.isFrozen(file), true);
});

test("unchanged file names retain the original File authority", () => {
	const source = { name: "sample.tra" };
	assert.equal(withRelativePathFile(source, "sample.tra"), source);
});
