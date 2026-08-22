import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
const aliases = { "@app/": "app/", "@src/": "src/", "@utils/": "src/lib/utils/", "@kimport/": "src/import/", "@spot/": "src/model/spot/", "@transition/": "src/domain/transition/" };
registerHooks({ resolve(specifier, context, nextResolve) { for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context); return nextResolve(specifier, context); } });
const { authorizeHorizontalElementRemoval } = await import("../../../app/controllers/bridges/alignmentEditorBridge.js");

test("removal authority requires exact active object selected row and unique element", () => {
	const input = { activeObjectId: "A", snapshotObjectId: "A", selectedElementId: "H2", requestedElementId: "H2", elements: [{ id: "H1" }, { id: "H2" }, { id: "H3" }] };
	assert.deepEqual(authorizeHorizontalElementRemoval(input), { authorized: true, objectId: "A", elementId: "H2", reason: null });
	for (const counterexample of [
		{ snapshotObjectId: "B" },
		{ activeObjectId: "B" },
		{ selectedElementId: "H1" },
		{ requestedElementId: "missing" },
		{ elements: [{ id: "H2" }, { id: "H2" }] },
	]) assert.equal(authorizeHorizontalElementRemoval({ ...input, ...counterexample }).authorized, false);
});

test("blank and missing targets never authorize removal", () => {
	assert.equal(authorizeHorizontalElementRemoval({ activeObjectId: "A", snapshotObjectId: "A", selectedElementId: "", requestedElementId: "", elements: [] }).authorized, false);
});
