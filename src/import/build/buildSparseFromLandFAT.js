// src/import/build/buildSparseFromLandFAT.js
//
// landFAT -> sparse_v1
//
// Kernel rule:
// - cGeom is canonical sparse 2D geometry
// - cGeom stores pose2 anchors and curvature structure
// - cant/profile/staEq are sparse sibling bands
// - pose3 is derived later by calculation services
//
// NOT:
// - no pose3 storage
// - no profile/cant/staEq geometry injection
// - no UI logic
// - no SPOT mutation

import * as sw from "./sparseWriter.js";

import {
	poseFromHeading,
	poseFromTwoPoints,
} from "@src/lib/geom/frame/pose2.js";

// -----------------------------------------------------------------------------
// public
// -----------------------------------------------------------------------------

export function buildSparseFromLandFAT(fatAlignment) {
	ensureObject(fatAlignment, "fatAlignment");

	if (!hasCoordGeomElements(fatAlignment)) {
		throw new Error("coordGeom.elements missing");
	}

	const coordElements = fatAlignment.coordGeom.elements;

	if (!coordElements.length) {
		throw new Error("coordGeom.elements empty");
	}

	const sparseRaw = [];

	for (let i = 0; i < coordElements.length; i += 1) {
		const seg = coordElements[i];
		const mapped = mapSegment(seg, i);
		if (mapped.length) sparseRaw.push(...mapped);
	}

	if (!sparseRaw.length) {
		throw new Error("no sparse elements built");
	}

	const startPose = resolvePoseA(coordElements[0], 0);
	const elements = ensureElementIds(sw.enforceAlternation(sparseRaw));

	const bands = compactObject({
		cant: buildCantBand(fatAlignment, elements),
		profile: buildProfileBand(fatAlignment),
		staEq: buildStaEqBand(fatAlignment),
	});

	const attachments = {
		hasCoordGeom: true,
		hasCant: Boolean(bands.cant),
		hasProfile: Boolean(bands.profile),
		hasStaEq: Boolean(bands.staEq),
	};

	const sparse = sw.createSparseAlignment({
		name: fatAlignment?.name ?? null,
		startPose,
		elements,
		meta: {
			sourceModel: "landFAT",
			kernelVersion: "sparseAlignment.v0.2",
			coordGeomElementCount: coordElements.length,
			attachments,
		},
	});

	return {
		...sparse,
		bands,
	};
}

// -----------------------------------------------------------------------------
// cGeom mapping
// -----------------------------------------------------------------------------

function mapSegment(seg, index) {
	const poseA = resolvePoseA(seg, index);
	const len = resolveLength(seg);

	switch (seg?.type) {
		case "Line": {
			if (!Number.isFinite(len) || len <= 1e-12) return [];

			return [sw.fixed({
				poseA,
				arcLength: len,
				curvature: 0,
				meta: {
					sourceType: "Line",
					sourceIndex: index,
				},
			})];
		}

		case "Curve": {
			const k = resolveCurvature(seg);

			if (!Number.isFinite(len) || len <= 1e-12) {
				return [sw.zeroFixed({
					poseA,
					curvature: k,
					meta: {
						sourceType: "Curve",
						sourceIndex: index,
					},
				})];
			}

			return [sw.fixed({
				poseA,
				arcLength: len,
				curvature: k,
				meta: {
					sourceType: "Curve",
					sourceIndex: index,
				},
			})];
		}

		case "Spiral": {
			const type = resolveTransitionType(seg);

			if (!Number.isFinite(len) || len <= 1e-12) {
				return [sw.immediate({
					poseA,
					meta: {
						sourceType: "Spiral",
						sourceIndex: index,
					},
				})];
			}

			return [sw.transition({
				poseA,
				arcLength: len,
				transType: type,
				meta: {
					sourceType: "Spiral",
					sourceIndex: index,
				},
			})];
		}

		case "Kink": {
			return [sw.kink({
				poseA,
				deltaDir: deltaDirVec(seg),
				meta: {
					sourceType: "Kink",
					sourceIndex: index,
				},
			})];
		}

		case "Immediate": {
			return [sw.immediate({
				poseA,
				meta: {
					sourceType: "Immediate",
					sourceIndex: index,
				},
			})];
		}

		default:
			throw new Error(`seg[${index}]: unsupported type "${seg?.type}"`);
	}
}

// -----------------------------------------------------------------------------
// cant band
// -----------------------------------------------------------------------------

function buildCantBand(fatAlignment, sparseElements) {
	const rawEntries = readRawCantEntries(fatAlignment);
	if (!rawEntries.length) return null;

	const fixedElements = sparseElements.filter(isFixedLikeElement);
	if (!fixedElements.length) return null;

	const elements = [];

	for (let i = 0; i < rawEntries.length; i += 1) {
		const raw = rawEntries[i];

		const cGeomElement = resolveCantTargetElement(raw, fixedElements, i);
		if (!cGeomElement) continue;

		const startCant = readCantValue(
			raw.startCant ??
			raw.cantStart ??
			raw.u0 ??
			raw.start ??
			raw.value
		);

		const endCant = readCantValue(
			raw.endCant ??
			raw.cantEnd ??
			raw.u1 ??
			raw.end ??
			raw.value
		);

		if (!Number.isFinite(startCant) && !Number.isFinite(endCant)) continue;

		elements.push(compactObject({
			cGeomElementId: cGeomElement.id,
			cGeomSourceIndex: cGeomElement.meta?.sourceIndex ?? null,

			startCant: Number.isFinite(startCant) ? startCant : endCant,
			endCant: Number.isFinite(endCant) ? endCant : startCant,

			startStationDelta: readFiniteOrNull(raw.startStationDelta ?? raw.ds0),
			endStationDelta: readFiniteOrNull(raw.endStationDelta ?? raw.ds1),

			flags: Array.isArray(raw.flags) ? raw.flags : [],
			meta: compactObject({
				sourceIndex: i,
				sourceType: raw.type ?? null,
			}),
		}));
	}

	if (!elements.length) return null;

	return {
		type: "cantBand",
		unit: readCantUnit(fatAlignment),
		valueSemantics: "railHeightDifference",
		reference: "trackCenter",
		gaugeRef: "objectGauge",

		// Important:
		// No cantFcnRef is stored.
		// Runtime uses the curvature family of the related cGeom element.
		functionRule: "useRelatedCGeomCurvatureFamily",

		elements,
	};
}

function readRawCantEntries(fatAlignment) {
	const c = fatAlignment?.cant;

	if (Array.isArray(c)) return c.filter(isObject);

	if (isObject(c)) {
		if (Array.isArray(c.elements)) return c.elements.filter(isObject);
		if (Array.isArray(c.points)) return pairCantPoints(c.points);
		if (Array.isArray(c.cant)) return pairCantPoints(c.cant);
	}

	return [];
}

function pairCantPoints(points) {
	const arr = Array.isArray(points) ? points.filter(isObject) : [];
	if (arr.length < 2) return arr;

	const out = [];

	for (let i = 0; i < arr.length - 1; i += 1) {
		const a = arr[i];
		const b = arr[i + 1];

		out.push({
			startCant: readCantValue(a.value ?? a.cant ?? a.u),
			endCant: readCantValue(b.value ?? b.cant ?? b.u),
			startStation: readStationValue(a),
			endStation: readStationValue(b),
			sourcePointIndex0: i,
			sourcePointIndex1: i + 1,
		});
	}

	return out;
}

function resolveCantTargetElement(raw, fixedElements, fallbackIndex) {
	const explicitId = raw.cGeomElementId ?? raw.elementId ?? raw.refElementId ?? null;
	if (explicitId) {
		const byId = fixedElements.find((el) => String(el.id) === String(explicitId));
		if (byId) return byId;
	}

	const explicitSourceIndex = readFiniteOrNull(
		raw.cGeomSourceIndex ??
		raw.sourceIndex ??
		raw.coordGeomIndex ??
		raw.elementIndex
	);

	if (Number.isInteger(explicitSourceIndex)) {
		const bySource = fixedElements.find(
			(el) => Number(el.meta?.sourceIndex) === explicitSourceIndex
		);
		if (bySource) return bySource;
	}

	return fixedElements[fallbackIndex] ?? null;
}

function readCantValue(value) {
	if (isObject(value)) return readFiniteOrNull(value.value);
	return readFiniteOrNull(value);
}

function readCantUnit(fatAlignment) {
	const c = fatAlignment?.cant;
	const raw =
		c?.unit ??
		c?.meta?.unit ??
		fatAlignment?.meta?.cantUnit ??
		fatAlignment?.units?.cantUnit ??
		"m";

	return String(raw);
}

// -----------------------------------------------------------------------------
// profile band
// -----------------------------------------------------------------------------

function buildProfileBand(fatAlignment) {
	const profile = fatAlignment?.profile;
	if (!isObject(profile)) return null;

	const pvis = readProfilePvis(profile);
	if (!pvis.length) return null;

	return {
		type: "profileBand",
		reference: "trackCenter",
		stationRef: readStationRef(profile),
		unit: readProfileUnit(fatAlignment, profile),
		pvis,
	};
}

function readProfilePvis(profile) {
	const raw =
		asArray(profile.pvis).length ? profile.pvis :
		asArray(profile.nw).length ? profile.nw :
		asArray(profile.points).length ? profile.points :
		asArray(profile.profile).length ? profile.profile :
		asArray(profile?.profAlign?.pvis).length ? profile.profAlign.pvis :
		[];

	const out = [];

	for (let i = 0; i < raw.length; i += 1) {
		const p = raw[i];

		const s = readStationValue(p);
		const z = readFiniteOrNull(
			p.z ??
			p.height ??
			p.elevation ??
			p.elev ??
			p.y
		);

		if (!Number.isFinite(s) || !Number.isFinite(z)) continue;

		out.push(compactObject({
			s,
			z,
			verticalCurve: readVerticalCurve(p),
			meta: compactObject({
				sourceIndex: i,
				sourceType: p.type ?? null,
			}),
		}));
	}

	return out;
}

function readVerticalCurve(p) {
	const vc = p.verticalCurve ?? p.curve ?? p.rounding ?? p.ausrundung ?? null;
	if (!isObject(vc) && !isObject(p)) return null;

	const type =
		vc?.type ??
		p?.verticalCurveType ??
		p?.curveType ??
		null;

	const length = readFiniteOrNull(
		vc?.length ??
		p?.verticalCurveLength ??
		p?.curveLength
	);

	const radius = readFiniteOrNull(
		vc?.radius ??
		p?.radius ??
		p?.r
	);

	if (!type && !Number.isFinite(length) && !Number.isFinite(radius)) return null;

	return compactObject({
		type: type ?? "unknown",
		length,
		radius,
	});
}

function readProfileUnit(fatAlignment, profile) {
	return String(
		profile?.unit ??
		profile?.meta?.unit ??
		fatAlignment?.units?.linearUnit ??
		"m"
	);
}

// -----------------------------------------------------------------------------
// staEq band
// -----------------------------------------------------------------------------

function buildStaEqBand(fatAlignment) {
	const raw = [
		...asArray(fatAlignment?.staEquations),
		...asArray(fatAlignment?.staEq),
	];

	if (!raw.length) return null;

	const equations = [];

	for (let i = 0; i < raw.length; i += 1) {
		const eq = raw[i];
		if (!isObject(eq)) continue;

		const s = readFiniteOrNull(
			eq.s ??
			eq.internalStation ??
			eq.station ??
			eq.sta
		);

		if (!Number.isFinite(s)) continue;

		equations.push(compactObject({
			s,

			before: readExternalStation(eq.before ?? eq.back ?? eq.staBack),
			after: readExternalStation(eq.after ?? eq.ahead ?? eq.staAhead),

			delta: readFiniteOrNull(eq.delta),
			type: eq.type ?? "jump",

			meta: compactObject({
				sourceIndex: i,
				raw: eq.raw ?? null,
			}),
		}));
	}

	if (!equations.length) return null;

	return {
		type: "stationEquationBand",
		reference: "refLine",
		internalStationUnit: "m",
		equations,
	};
}

function readExternalStation(value) {
	if (value == null) return null;

	if (isObject(value)) {
		return compactObject({
			raw: value.raw ?? value.label ?? null,
			value: readFiniteOrNull(value.value ?? value.station ?? value.s),
			branch: value.branch ?? null,
			quality: value.quality ?? null,
		});
	}

	const numeric = readFiniteOrNull(value);

	return compactObject({
		raw: typeof value === "string" ? value : null,
		value: numeric,
		quality: Number.isFinite(numeric) ? "interpreted" : "rawOnly",
	});
}

// -----------------------------------------------------------------------------
// low-level readers
// -----------------------------------------------------------------------------

function readPoint(p) {
	if (!p) return null;

	const x = Number.isFinite(p.easting) ? p.easting : p.x;
	const y = Number.isFinite(p.northing) ? p.northing : p.y;

	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

	return { x, y };
}

function readMeasure(m) {
	if (Number.isFinite(m)) return Number(m);
	return m && Number.isFinite(m.value) ? Number(m.value) : null;
}

function readAngle(a) {
	if (!a || !Number.isFinite(a.value)) return null;

	return {
		value: Number(a.value),
		unit: a.unit,
		orientation: a.orientation,
		origin: a.origin,
	};
}

function readStationValue(x) {
	return readFiniteOrNull(
		x?.s ??
		x?.station ??
		x?.sta ??
		x?.chainage ??
		x?.x
	);
}

function readStationRef(x) {
	return String(
		x?.stationRef ??
		x?.stationReference ??
		x?.ref ??
		"own"
	);
}

// -----------------------------------------------------------------------------
// angle → math
// -----------------------------------------------------------------------------

function angleToRad(a) {
	let v = a.value;

	switch (a.unit) {
		case "radian":
			break;
		case "gon":
			v = v * Math.PI / 200;
			break;
		case "degree":
			v = v * Math.PI / 180;
			break;
		default:
			throw new Error(`angle unit unsupported: ${a.unit}`);
	}

	if (a.orientation === "cw") v = -v;
	else if (a.orientation !== "ccw") {
		throw new Error(`angle orientation invalid: ${a.orientation}`);
	}

	switch (a.origin) {
		case "east":
			return v;
		case "north":
			return v + Math.PI / 2;
		case "west":
			return v + Math.PI;
		case "south":
			return v - Math.PI / 2;
		default:
			throw new Error(`angle origin invalid: ${a.origin}`);
	}
}

// -----------------------------------------------------------------------------
// geometry helpers
// -----------------------------------------------------------------------------

function dist(a, b) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	return Math.sqrt(dx * dx + dy * dy);
}

function poseFromStartDir(seg) {
	const angle =
		readAngle(seg?.direction) ??
		readAngle(seg?.dirStart);

	if (!angle) throw new Error("missing direction");

	const start = readPoint(seg?.start);
	if (!start) throw new Error("missing start point");

	const theta = angleToRad(angle);
	return poseFromHeading(start.x, start.y, theta);
}

function poseFromChord(seg) {
	const a = readPoint(seg?.start);
	const b = readPoint(seg?.end);

	if (!a || !b) throw new Error("missing chord");

	const len = dist(a, b);
	if (!Number.isFinite(len) || len <= 0) {
		throw new Error("invalid chord");
	}

	return poseFromTwoPoints(a.x, a.y, b.x, b.y);
}

function resolvePoseA(seg, index) {
	try {
		return poseFromStartDir(seg);
	} catch {
		try {
			return poseFromChord(seg);
		} catch (err) {
			throw new Error(`seg[${index}]: cannot resolve poseA :: ${err.message}`);
		}
	}
}

function resolveLength(seg) {
	const len = readMeasure(seg?.length);
	if (Number.isFinite(len)) return len;

	const a = readPoint(seg?.start);
	const b = readPoint(seg?.end);

	if (a && b) {
		const chord = dist(a, b);
		if (Number.isFinite(chord) && chord > 0) return chord;
	}

	return null;
}

function resolveCurvature(seg) {
	const r =
		Number.isFinite(seg?.radius) ? Number(seg.radius) :
		seg?.radius?.value === "INF" ? Infinity :
		Number.isFinite(seg?.radius?.value) ? Number(seg.radius.value) :
		null;

	if (!r || r === Infinity) return 0;

	const rot = String(seg?.rot ?? "").toLowerCase();

	if (rot === "ccw") return 1 / r;
	if (rot === "cw") return -1 / r;

	return 1 / r;
}

function resolveTransitionType(seg) {
	const raw = String(
		seg?.spiType ?? seg?.transType ?? ""
	).trim().toLowerCase();

	if (!raw) return "clothoid";

	const map = {
		clothoid: "clothoid",
		klothoide: "clothoid",
		spiral: "clothoid",
		bloss: "bloss",
		cubic: "bloss",
		immediate: "immediate",
		kink: "kink",
	};

	return map[raw] ?? raw;
}

function deltaDirVec(seg) {
	const a = readAngle(seg?.delta);
	if (!a) throw new Error("missing delta angle");

	const t = angleToRad(a);

	return {
		x: Math.cos(t),
		y: Math.sin(t),
	};
}

// -----------------------------------------------------------------------------
// shape helpers
// -----------------------------------------------------------------------------

function ensureElementIds(elements) {
	return elements.map((el, index) => {
		if (el?.id) return el;

		return {
			...el,
			id: `el_${String(index + 1).padStart(4, "0")}`,
		};
	});
}

function isFixedLikeElement(el) {
	const t = String(el?.type ?? el?.kind ?? "").toLowerCase();
	return (
		t === "fixed" ||
		t === "fixedelement" ||
		t === "zerofixed" ||
		t === "zerolengthfixed"
	);
}

function hasCoordGeomElements(fatAlignment) {
	return Array.isArray(fatAlignment?.coordGeom?.elements);
}

function ensureObject(x, label) {
	if (!isObject(x)) {
		throw new Error(`${label} must be an object`);
	}
	return x;
}

function compactObject(obj) {
	if (!isObject(obj)) return {};

	const out = {};

	for (const [key, value] of Object.entries(obj)) {
		if (value == null) continue;
		if (Array.isArray(value) && value.length === 0) continue;
		if (isObject(value) && Object.keys(value).length === 0) continue;
		out[key] = value;
	}

	return out;
}

function readFiniteOrNull(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
