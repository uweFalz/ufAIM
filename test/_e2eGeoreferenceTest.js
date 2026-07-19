import { resolveGndCrsIdentifier, resolveGndCrsIdentifiers, decodeGndLsys } from "../src/domain/crs/GndCrsResolver.js";
import { createGeoreferenceContract } from "../src/domain/coordinates/GeoreferenceContract.js";
import { makeDbRefToEtrs89Transform, projectGeographicGeometry } from "../src/domain/projection/GeographicProjection.js";
const assert = (c,m) => { if (!c) throw new Error(`Georeference E2E FAIL: ${m}`); };

for (const [lsys, epsg, strip] of [["CR0","EPSG:5682",2],["DR0","EPSG:5683",3],["ER0","EPSG:5684",4],["FR0","EPSG:5685",5]]) {
	const r = resolveGndCrsIdentifier(lsys);
	assert(r.supportState === "geographic-supported" && r.resolvedEpsg === epsg && r.meridianStrip === strip, `${lsys} must resolve authoritatively`);
}
assert(resolveGndCrsIdentifier("DA9").supportState === "local-explicit", "third-character local variant");
assert(resolveGndCrsIdentifier(null).supportState === "local-missing-crs", "missing LSYS");
assert(resolveGndCrsIdentifier("ZZ9").supportState === "local-malformed-crs", "malformed LSYS");
for (const family of ["A","B","C","S"]) assert(decodeGndLsys(`D${family}0`).family.code === family, `family ${family}`);
assert(resolveGndCrsIdentifier("DA0").supportState === "local-graphical-only", "unsupported graphical family");
assert(resolveGndCrsIdentifiers(["DR0","ER0"]).supportState === "local-conflicting-crs", "conflicting LSYS");

const resolution = resolveGndCrsIdentifier("DR0");
const projection = { polyline2d: [{x:3532112.488,y:5940746.141},{x:3532212.488,y:5940846.141}], segments: [], georeference: { horizontal: resolution } };
let sourceDefinition = null;
const transform = makeDbRefToEtrs89Transform((source, target, coordinate) => { sourceDefinition = source; return [9.48 + (coordinate[0]-3532112.488)/100000, 53.59 + (coordinate[1]-5940746.141)/100000]; }, resolution);
const placed = projectGeographicGeometry({ projection, resolution, transform });
assert(placed.ok, "valid DB_REF coordinates should transform");
assert(sourceDefinition.includes("+towgs84=584.9636,107.7175,413.8067,1.1155214628,0.282433989,-3.1384490633,7.992235"), "coordinate-frame signs converted for proj4js");
assert(placed.georeference.verticalReferenceStatus === "unresolved-separate-source-height", "vertical remains unresolved");
const outside = projectGeographicGeometry({ projection, resolution, transform: () => [0,0] });
assert(!outside.ok && outside.georeference.resolutionState === "local-outside-validity", "outside-validity rejected with local state");
const axisSwap = projectGeographicGeometry({ projection, resolution, transform: ([easting,northing]) => [northing / 100000, easting / 100000] });
assert(!axisSwap.ok && axisSwap.georeference.mode === "local-cartesian", "axis-order error rejected");
const failed = projectGeographicGeometry({ projection, resolution, transform: () => { throw new Error("synthetic failure"); } });
assert(!failed.ok && failed.georeference.resolutionState === "local-transformation-failed", "transformation failure becomes local state");
assert(!projectGeographicGeometry({ projection, resolution, transform: () => [NaN,53] }).ok, "non-finite rejected");
assert(projection.polyline2d[0].x === 3532112.488, "original coordinate preserved");
assert(createGeoreferenceContract({horizontal: resolveGndCrsIdentifier("DA9")}).mode === "local-cartesian", "stable local fallback");
console.log("Georeference E2E OK");
