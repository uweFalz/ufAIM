import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
const aliases = { "@app/": "app/", "@src/": "src/", "@spot/": "src/model/spot/", "@projection/": "src/domain/projection/", "@transition/": "src/domain/transition/", "@alignment/": "src/domain/alignment/", "@domain/": "src/domain/", "@shared/": "src/shared/", "@runtime/": "app/runtime/", "@controllers/": "app/controllers/", "@view/": "app/view/", "@ui/": "app/ui/", "@io/": "app/io/", "@kimport/": "src/import/", "@kgeom/": "src/lib/geom/", "@kmath/": "src/lib/math/", "@utils/": "src/lib/utils/" };
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "proj4js") return { url: "data:text/javascript,export default null", shortCircuit: true }; for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context); return nextResolve(specifier, context); } });
const { createMainHorizontalProjectionReadback } = await import("../../../app/controllers/viewController.js");

test("readback freezes exact canonical revision and qualified intrinsic cursor", () => {
	const revision = { id: "R2", parentId: "R1" };
	const result = createMainHorizontalProjectionReadback({ objectId: "A1", revision, cursor: { s: 40, x: 4, y: 2 }, projectionSignature: "P2", mode: "active", selectedElementId: "ARC1" });
	assert.deepEqual(result, { status: "rendered", objectId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s: 40 }, projectionSignature: "P2", mode: "active", selectedElementId: "ARC1" });
	assert.equal(Object.isFrozen(result), true);
	assert.equal(Object.isFrozen(result.revision), true);
	assert.equal(Object.isFrozen(result.cursor), true);
});

test("preview, missing identity/revision/signature, and invalid cursor never become readback", () => {
	const valid = { objectId: "A1", revision: 2, cursor: { s: 40 }, projectionSignature: "P2", mode: "active" };
	for (const value of [{ ...valid, mode: "preview" }, { ...valid, objectId: null }, { ...valid, revision: null }, { ...valid, projectionSignature: null }, { ...valid, cursor: { s: Number.NaN } }]) assert.equal(createMainHorizontalProjectionReadback(value), null);
});

test("port invalidates same-ID caches and transports only canonical AlignmentData revision", () => {
	const source = fs.readFileSync(new URL("../../../app/controllers/viewController.js", import.meta.url), "utf8");
	const port = source.slice(source.indexOf("async refreshHorizontalProjection"), source.indexOf("getDebugState", source.indexOf("async refreshHorizontalProjection")));
	assert.match(port, /invalidateAllCaches\(\)/);
	assert.match(port, /await renderActiveState/);
	assert.match(source, /spotObject\?\.data\?\.alignmentData/);
	assert.match(source, /hasOwnProperty\.call\(alignmentData, "revision"\)/);
	assert.doesNotMatch(port, /modifiedAt|Date\.|projectionSignature\s*\?\?/);
	assert.doesNotMatch(source, /saveById|IndexedDB|localStorage/);
});
