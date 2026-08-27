import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../../../app/controllers/bridges/alignmentEditorBridge.js", import.meta.url), "utf8");

test("successful radius edit renders receipt only after verified refresh at exact context", () => {
	assert.match(bridge, /updateArcOnActiveAlignment/);
	assert.match(bridge, /alignmentChange: result\.alignmentChange/);
	assert.match(bridge, /refresh\(\{ preserveSelection: false, verifiedChange: result\.alignmentChange \}\)/);
	const check = bridge.indexOf("verified receipt context changed");
	const render = bridge.indexOf("renderHorizontalRealizationChangeReceipt(fields.realizationReceipt, receipt)");
	const dispatch = bridge.indexOf("dispatchProductiveAlignmentChange", render);
	assert.ok(check > 0 && render > check && dispatch > render);
});
