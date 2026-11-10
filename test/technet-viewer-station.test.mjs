// GND's encoded km and the Viewer's "km 0,4 + 60,91": the two marked blocks
// in technetViewer.html are pure apart from numberValue (number or {value}),
// which is given here as the Viewer defines it.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = await fs.readFile(new URL("technetViewer.html", root), "utf8");
const block = (name) => {
	const begin = html.indexOf(`// BEGIN ${name}`);
	const end = html.indexOf(`// END ${name}`);
	assert.ok(begin > 0 && end > begin, `${name} block present`);
	return html.slice(begin, end);
};
const context = vm.createContext({ numberValue: (value) => (value && typeof value === "object" && "value" in value ? Number(value.value) : Number(value)) });
new vm.Script(`${block("GND STATION")}\n${block("GND STATION SCALAR")}\nglobalThis.api = { station, stationScalar };`, { filename: "gnd-station.js" }).runInContext(context);
const { station, stationScalar } = context.api;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);

test("encoded km after the zero point: Hektometer and Meter", () => {
	near(stationScalar(100040060.908), 460.908);
	near(stationScalar(100030074.714), 374.714);
	// A Kilometersprung's Fehllänge runs the metres past 100 (WueTreu 4120).
	near(stationScalar(114680102.732), 146902.732);
	near(stationScalar(114690000), 146900);
	near(stationScalar({ value: 100040060.908, unit: "meter" }), 460.908);
});

test("encoded km before the zero point: both parts negative (WueTreu 5201)", () => {
	near(stationScalar(99959928.04), -471.96);
	near(stationScalar(99959994.374), -405.626);
	near(stationScalar(99969935.778), -364.222);
	// Consecutive elements stay continuous: 42,549 m and 41,404 m long.
	near(stationScalar(99959994.374) - stationScalar(99959951.825), 42.549);
	near(stationScalar(99969935.778) - stationScalar(99959994.374), 41.404);
	near(stationScalar(99939961.404), -638.596);
});

test("plain metres pass through", () => {
	near(stationScalar(460.908), 460.908);
	near(stationScalar(-471.96), -471.96);
	// null reads as 0, as numberValue has it everywhere in the Viewer.
	near(stationScalar(null), 0);
	assert.ok(Number.isNaN(stationScalar("x")));
});

test("the km text: Kilometer, Hektometer, Meter", () => {
	assert.equal(station(460.908).trim(), "0,4 + 60,91");
	assert.equal(station(100040060.908).trim(), "0,4 + 60,91");
	assert.equal(station(146902.732).trim(), "146,9 + 02,73");
	assert.equal(station(0).trim(), "0,0 + 00,00");
	assert.equal(station(-471.96).trim(), "-0,4 - 71,96");
	assert.equal(station(99959928.04).trim(), "-0,4 - 71,96");
	assert.equal(station("x"), "".padStart(14));
	assert.equal(station(460.908).length, 14);
	// the Meter part never rounds up to a full Hektometer
	assert.equal(station(67499.9999).trim(), "67,5 + 00,00");
	assert.equal(station(67499.994).trim(), "67,4 + 99,99");
	assert.equal(station(99.996).trim(), "0,1 + 00,00");
	assert.equal(station(-99.996).trim(), "-0,1 - 00,00");
	assert.equal(station(139858.49).trim(), "139,8 + 58,49");
});
