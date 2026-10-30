import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { installFileDrop } from "../../../app/io/input/fileDrop.js";

// Exercise the actual DOM-only rail functions without starting the App,
// importing its renderer, opening a browser, or accessing user persistence.
const initSource = await readFile(new URL("../../../app/runtime/init/initFeatures.js", import.meta.url), "utf8");
const start = initSource.indexOf("function updateImportActivityRail(");
const end = initSource.indexOf("function setupCockpitSelectors(", start);
assert.ok(start >= 0 && end > start, "the production rail function boundary is present");
const railSource = initSource.slice(start, end);

function makeRail() {
	const nodes = Object.fromEntries(["title", "detail", "files", "open"].map((key) => [key, {
		textContent: "", hidden: false, children: [],
		replaceChildren(...children) { this.children = children; },
		append(child) { this.children.push(child); },
	}]));
	const classes = new Set();
	const rail = {
		dataset: {}, attributes: {},
		setAttribute(key, value) { this.attributes[key] = value; },
		classList: { toggle(key, on) { if (on) classes.add(key); else classes.delete(key); } },
		querySelector(selector) { return nodes[selector.match(/data-import-activity-(\w+)/)?.[1]]; },
	};
	const document = {
		getElementById(id) { return id === "importActivityRail" ? rail : null; },
		createElement() { return { textContent: "" }; },
	};
	const render = runInNewContext(`${railSource}\nupdateImportActivityRail;`, { document });
	return { render, rail, nodes, classes };
}

for (const [status, expectedTitle, expectedState] of [
	["cancelled", "Import abgebrochen", "cancelled"],
	["failed", "Import fehlgeschlagen", "failed"],
	["partial", "Import geprüft", "completed"],
	["succeeded", "Import abgeschlossen", "completed"],
]) {
	test(`the normal drop callback leaves a truthful ${status} terminal activity rail`, async () => {
		const { render, rail, nodes, classes } = makeRail();
		const handlers = new Map();
		const fileOutcome = { fileName: "track.mdb", status: status === "succeeded" ? "complete" : status, itemCount: status === "succeeded" ? 1 : 0 };
		installFileDrop({
			element: { addEventListener(name, handler) { handlers.set(name, handler); }, removeEventListener() {}, dispatchEvent() {} },
			onFiles: async () => {
				assert.equal(rail.attributes["aria-busy"], "true");
				assert.equal(classes.has("hidden"), false);
				return { status, fileOutcomes: status === "cancelled" ? [] : [fileOutcome] };
			},
			onLifecycle: render,
		});
		await handlers.get("drop")({ preventDefault() {}, stopPropagation() {}, dataTransfer: { files: [{ name: "track.mdb" }] } });
		assert.equal(rail.dataset.importActivityState, expectedState);
		assert.equal(nodes.title.textContent, expectedTitle);
		assert.equal(rail.attributes["aria-busy"], "false");
		assert.equal(classes.has("hidden"), false);
		assert.equal(classes.has("is-busy"), false);
		assert.equal(classes.has("is-error"), status === "failed");
		assert.equal(nodes.open.hidden, false);
		assert.equal(nodes.open.textContent, "Import ansehen");
		assert.equal(nodes.files.children[0].textContent, "track.mdb");
		if (status === "cancelled") assert.doesNotMatch(nodes.detail.textContent, /geprüft|erkannt|abgeschlossen/);
		if (status === "failed") assert.match(nodes.detail.textContent, /fehlgeschlagen/);
	});
}
