import assert from "node:assert/strict";
import test from "node:test";
import {
	collectDroppedFiles,
	installFileDrop,
} from "../../../app/io/input/fileDrop.js";

function fileEntry(name, fullPath = `/${name}`) {
	return {
		isFile: true,
		isDirectory: false,
		fullPath,
		file(resolve) { resolve({ name, type: "text/plain", lastModified: 1 }); },
	};
}

function directoryEntry(children) {
	let delivered = false;
	return {
		isFile: false,
		isDirectory: true,
		createReader() {
			return {
				readEntries(resolve) {
					if (delivered) resolve([]);
					else { delivered = true; resolve(children); }
				},
			};
		},
	};
}

test("collects every file from multiple dropped files and nested directories", async () => {
	const loose = fileEntry("track.tra");
	const folder = directoryEntry([
		fileEntry("profile.gra", "/project/profile.gra"),
		directoryEntry([fileEntry("network.xlsx", "/project/gnd/network.xlsx")]),
	]);
	const files = await collectDroppedFiles({
		items: [loose, folder].map((entry) => ({ webkitGetAsEntry: () => entry })),
	});
	assert.equal(files.length, 3);
	assert.deepEqual(files.map((file) => file.name), [
		"track.tra",
		"project/profile.gra",
		"project/gnd/network.xlsx",
	]);
});

test("falls back to the complete FileList when entry traversal is unavailable", async () => {
	const files = [{ name: "a.xml" }, { name: "b.ifc" }];
	assert.deepEqual(await collectDroppedFiles({ files }), files);
});

test("one drop invokes one multi-file callback and reports the collected total", async () => {
	const listeners = new Map();
	const lifecycle = [];
	const element = {
		addEventListener(name, handler) { listeners.set(name, handler); },
		removeEventListener() {},
		dispatchEvent() {},
	};
	let received = null;
	installFileDrop({
		element,
		onFiles: async (files) => { received = files; return { status: "succeeded" }; },
		onLifecycle: (entry) => lifecycle.push(entry),
	});
	const entries = [fileEntry("a.tra"), directoryEntry([fileEntry("b.gra"), fileEntry("c.xml")])];
	await listeners.get("drop")({
		preventDefault() {},
		stopPropagation() {},
		dataTransfer: { items: entries.map((entry) => ({ webkitGetAsEntry: () => entry })) },
	});
	assert.equal(received.length, 3);
	assert.equal(lifecycle.some((entry) => entry.state === "accepted"), true);
	assert.equal(lifecycle.at(-2).state, "processing");
	assert.equal(lifecycle.at(-2).fileCount, 3);
	assert.deepEqual(lifecycle.at(-2).fileNames, ["a.tra", "b.gra", "c.xml"]);
	assert.equal(lifecycle.at(-1).state, "completed");
	assert.equal(lifecycle.at(-1).fileCount, 3);
	assert.deepEqual(lifecycle.at(-1).fileNames, ["a.tra", "b.gra", "c.xml"]);
});

test("directory traversal failure terminates visibly without invoking import", async () => {
	const listeners = new Map();
	const lifecycle = [];
	const element = {
		addEventListener(name, handler) { listeners.set(name, handler); },
		removeEventListener() {},
		dispatchEvent() {},
	};
	let invoked = false;
	installFileDrop({
		element,
		onFiles: async () => { invoked = true; },
		onLifecycle: (entry) => lifecycle.push(entry),
	});
	const broken = {
		isDirectory: true,
		createReader: () => ({ readEntries(_resolve, reject) { reject(new Error("unreadable folder")); } }),
	};
	await listeners.get("drop")({
		preventDefault() {},
		stopPropagation() {},
		dataTransfer: { items: [{ webkitGetAsEntry: () => broken }] },
	});
	assert.equal(invoked, false);
	assert.equal(lifecycle.at(-1).state, "failed");
	assert.equal(lifecycle.at(-1).code, "FILE_DROP_COLLECTION_FAILED");
});
