// src/model/spot/mutate/promoteImportItems.js

import { assessSpotAdmission } from "../../../import/spot/assessSpotAdmission.js";
import { materializeAlignmentDataFromSparse } from "../../../domain/alignment/editor/materializeAlignmentDataFromSparse.js";
import { createAlignmentSpotObject } from "../model/createAlignmentSpotObject.js";
import {
	appendChainageSegment,
	createChainageMapping,
} from "../../../aim-core/alignment/profile/ChainageMapping.js";

export function promoteImportItems({ items = [], spotStore } = {}) {
	if (!spotStore || typeof spotStore.addObjects !== "function") {
		throw new Error("promoteImportItems: missing spotStore.addObjects");
	}

	const addedObjects = [];
	const reviewItems = [];
	const rejectedItems = [];

	for (const item of Array.isArray(items) ? items : []) {
		if (!isObject(item)) {
			rejectedItems.push({ id: null, kind: null, reason: "invalid_item" });
			continue;
		}

		const decision = assessSpotAdmission(item);

		const allowSoftReview =
			decision?.admission === "review" &&
			item?.status?.promotable === true &&
			isDrawableAlignmentItem(item);

		if (decision?.admission === "safe" || allowSoftReview) {
			const promoted = promoteOneItemToSpotEntry(item, {
				warnings: allowSoftReview ? [decision.reason] : [],
			});

			if (!promoted) {
				reviewItems.push({
					id: item.id ?? null,
					kind: item.kind ?? null,
					reason: "promotion_builder_returned_null",
				});
				continue;
			}

			registerCrsIfPossible(spotStore, promoted.crs, promoted.entry);
			spotStore.addObjects([promoted.entry]);
			addedObjects.push(promoted.entry);
			continue;
		}

		if (decision?.admission === "review") {
			reviewItems.push({
				id: item.id ?? null,
				kind: item.kind ?? null,
				reason: decision.reason ?? "review_required",
			});
			continue;
		}

		rejectedItems.push({
			id: item.id ?? null,
			kind: item.kind ?? null,
			reason: decision?.reason ?? "rejected",
		});
	}

	return {
		ok: true,
		addedObjects,
		reviewItems,
		rejectedItems,
		count: {
			addedObjects: addedObjects.length,
			reviewItems: reviewItems.length,
			rejectedItems: rejectedItems.length,
		},
	};
}

function isDrawableAlignmentItem(item) {
	return (
		item?.kind === "alignment" &&
		isObject(item?.derived?.sparseAlignment)
	);
}

function promoteOneItemToSpotEntry(item, opts = {}) {
	switch (item?.kind) {
		case "alignment":
			return buildSpotAlignmentEntry(item, opts);
		case "profile":
			return buildSpotProfileEntry(item, opts);
		case "cant":
			return buildSpotCantEntry(item, opts);
		case "staEq":
			return buildSpotStaEqEntry(item, opts);
		case "relation":
			return buildSpotRelationEntry(item, opts);
		default:
			return null;
	}
}

function buildSpotAlignmentEntry(item, opts = {}) {
	const sparseAlignment = item?.derived?.sparseAlignment ?? null;
	if (!isObject(sparseAlignment)) return null;

	const payload = item?.payload ?? {};
	const crs = normalizeSpotCrs(item);

	const entry = createAlignmentSpotObject({
		id: item.id,
		crsId: crs.crsId,
		crsStatus: crs.status,
		name: payload.name ?? payload.id ?? item.id ?? null,
		kernel: normalizeAlignmentKernel(sparseAlignment),
		alignmentData: null,
		extended: clonePlainObject(payload.extended),
		refs: {
			profileRelationIds: [],
			cantRelationIds: [],
			staEquationRelationIds: [],
		},
		meta: buildSpotMeta(item, opts),
	});
	entry.data.alignmentData = materializeAlignmentDataFromSparse(entry);
	installSourceDeclaredAttachments(entry.data.alignmentData, payload, sparseAlignment, item);

	entry.data.meta = clonePlainObject(payload.meta);
	entry.data.extended = clonePlainObject(payload.extended);
	entry.data.georeference = clonePlainObject(item?.derived?.spatialRef ?? payload?.spatialRef);

	return {
		crs,
		entry,
	};
}

function installSourceDeclaredAttachments(alignmentData, payload, sparseAlignment, item) {
	if (!isObject(alignmentData)) return;
	const attachments = payload?.sourceAttachments;
	if (
		!isObject(attachments) ||
		attachments.contractVersion !== "import/source-declared-alignment-attachments/0.1" ||
		attachments.association !== "source-declared-inline-alignment-child"
	) return;

	alignmentData.sourceAttachments = clonePlainValue(attachments);
	const chainageMappings = buildSourceDeclaredChainageMappings({
		alignmentId: alignmentData.id,
		attachments,
		sparseAlignment,
		item,
	});
	alignmentData.profileState = {
		vertical: null,
		cant: null,
		chainageMappings,
	};
}

function buildSourceDeclaredChainageMappings({ alignmentId, attachments, sparseAlignment, item }) {
	const startAddress = readMeasureValue(attachments?.alignmentStation?.start);
	const totalLength = sparseTotalLength(sparseAlignment);
	if (!Number.isFinite(startAddress) || !Number.isFinite(totalLength) || totalLength <= 0) return [];

	const sourceEquations = Array.isArray(attachments?.staEquations) ? attachments.staEquations : [];
	const equations = sourceEquations.length > 0
		? sourceEquations
			.map((equation) => normalizeStationEquation(equation, startAddress, totalLength))
			.filter(Boolean)
			.sort((left, right) => left.s - right.s)
		: [];
	if (equations.length !== sourceEquations.length) return [];
	if (equations.some((equation, index) => index > 0 && equation.s <= equations[index - 1].s)) return [];

	const direction = equations.some((equation) => equation.direction === -1) ? -1 : 1;
	if (equations.some((equation) => equation.direction !== direction)) return [];

	let mapping = createChainageMapping({
		id: `${safeIdStem(alignmentId)}-source-chainage`,
		alignmentId,
		schemeId: `landxml-source:${safeIdStem(item?.source?.fileName ?? "dataset")}`,
		schemeVersion: "source-declared-v1",
	});
	let startS = 0;
	let address = startAddress;
	let segmentIndex = 1;
	for (const equation of equations) {
		const impliedBack = address + direction * (equation.s - startS);
		if (Number.isFinite(equation.back) && Math.abs(impliedBack - equation.back) > 1e-6) return [];
		if (equation.s > startS) {
			mapping = appendChainageSegment(mapping, {
				id: `${safeIdStem(alignmentId)}-source-chainage-${segmentIndex}`,
				startS,
				endS: equation.s,
				startAddress: address,
				direction,
				source: "LandXML StaEquation",
			});
			segmentIndex += 1;
		}
		startS = equation.s;
		address = equation.ahead;
	}
	if (startS >= totalLength) return mapping.segments.length > 0 ? [mapping] : [];
	mapping = appendChainageSegment(mapping, {
		id: `${safeIdStem(alignmentId)}-source-chainage-${segmentIndex}`,
		startS,
		endS: totalLength,
		startAddress: address,
		direction,
		source: "LandXML alignment stationing",
	});
	return [mapping];
}

function normalizeStationEquation(equation, startAddress, totalLength) {
	const internal = readMeasureValue(equation?.staInternal ?? equation?.station);
	const ahead = readMeasureValue(equation?.staAhead);
	const back = readMeasureValue(equation?.staBack);
	if (![internal, ahead].every(Number.isFinite)) return null;
	const s = internal - startAddress;
	if (!(s > 0 && s < totalLength)) return null;
	const increment = String(equation?.staIncrement ?? "increasing").trim().toLowerCase();
	return {
		s,
		ahead,
		back,
		direction: ["decreasing", "-1", "negative"].includes(increment) ? -1 : 1,
	};
}

function sparseTotalLength(sparseAlignment) {
	const explicit = Number(sparseAlignment?.totalLength ?? sparseAlignment?.arcLength);
	if (Number.isFinite(explicit) && explicit > 0) return explicit;
	const elements = Array.isArray(sparseAlignment?.elements)
		? sparseAlignment.elements
		: Array.isArray(sparseAlignment?.sparse) ? sparseAlignment.sparse : [];
	const sum = elements.reduce((total, element) => {
		const length = Number(element?.arcLength ?? element?.length);
		return Number.isFinite(length) && length > 0 ? total + length : total;
	}, 0);
	return sum > 0 ? sum : null;
}

function buildSpotProfileEntry(item, opts = {}) {
	const payload = item?.payload ?? {};
	const crs = normalizeSpotCrs(item);

	return {
		crs,
		entry: {
			id: String(item.id),
			type: "profile",
			crsId: crs.crsId,
			crsStatus: crs.status,

			data: {
				name: payload.name ?? payload.id ?? item.id ?? null,
				points: normalizeProfilePoints(payload.points),
				stationReference: payload.stationReference ?? null,
				meta: clonePlainObject(payload.meta),
				extended: clonePlainObject(payload.extended),
			},

			refs: {},
			meta: buildSpotMeta(item, opts),
		},
	};
}

function buildSpotCantEntry(item, opts = {}) {
	const payload = item?.payload ?? {};
	const crs = normalizeSpotCrs(item);

	return {
		crs,
		entry: {
			id: String(item.id),
			type: "cant",
			crsId: crs.crsId,
			crsStatus: crs.status,

			data: {
				name: payload.name ?? payload.id ?? item.id ?? null,
				values: normalizeCantValues(payload.points),
				stationReference: payload.stationReference ?? null,
				meta: clonePlainObject(payload.meta),
				extended: clonePlainObject(payload.extended),
			},

			refs: {},
			meta: buildSpotMeta(item, opts),
		},
	};
}

function buildSpotStaEqEntry(item, opts = {}) {
	const payload = item?.payload ?? {};
	const crs = normalizeSpotCrs(item);

	return {
		crs,
		entry: {
			id: String(item.id),
			type: "staEquation",
			crsId: crs.crsId,
			crsStatus: crs.status,

			data: {
				name: payload.name ?? payload.id ?? item.id ?? null,
				equations: Array.isArray(payload.equations) ? payload.equations : [],
				meta: clonePlainObject(payload.meta),
				extended: clonePlainObject(payload.extended),
			},

			refs: {},
			meta: buildSpotMeta(item, opts),
		},
	};
}

function buildSpotRelationEntry(item, opts = {}) {
	const payload = item?.payload ?? {};
	const crs = normalizeSpotCrs(item);

	return {
		crs,
		entry: {
			id: String(item.id),
			type: "relation",
			crsId: crs.crsId,
			crsStatus: crs.status,

			data: {
				name: payload.name ?? payload.id ?? item.id ?? null,
				relationType: payload.relationType ?? null,
				from: normalizeRelationEndpoint(payload.fromRef ?? payload.from),
				to: normalizeRelationEndpoint(payload.toRef ?? payload.to),
				scope: normalizeRelationScope(payload.scope),
				status: payload.status ?? "declared",
				meta: clonePlainObject(payload.meta),
				extended: clonePlainObject(payload.extended),
			},

			refs: {},
			meta: buildSpotMeta(item, opts),
		},
	};
}

function normalizeAlignmentKernel(sparseAlignment) {
	const elements = Array.isArray(sparseAlignment.elements)
		? sparseAlignment.elements
		: Array.isArray(sparseAlignment.sparse)
			? sparseAlignment.sparse
			: [];

	return {
		...sparseAlignment,
		startPose: sparseAlignment.startPose ?? null,
		elements,
		sparse: elements,
		version: sparseAlignment.version ?? "sparse_v1",
	};
}

function normalizeSpotCrs(item) {
	const sr = item?.derived?.spatialRef ?? null;

	const horizontal = firstNonEmptyString(
		sr?.crsId,
		sr?.horizontalCrsId,
		sr?.horizontal,
		sr?.horizontalCoordinateSystemName,
		item?.payload?.spatialRef?.crsId,
		item?.payload?.spatialRef?.horizontalCrsId
	);

	if (!horizontal) {
		const inferred = inferEngineeringCrs(item);

		if (inferred) {
			return {
				id: inferred.crsId,
				crsId: inferred.crsId,

				status: "inferred",

				horizontalCrsId: inferred.crsId,
				horizontalCoordinateSystemName:
					inferred.label ?? inferred.crsId,

				verticalCrsId: null,
				verticalCoordinateSystemName: null,

				source:
					item?.source?.parserId ??
					item?.source?.fileName ??
					"import",

				family: inferred.family ?? null,

				raw: {
					inferred: true,
					heuristic: inferred.heuristic ?? null,
					baseSpatialRef: isObject(sr)
						? clonePlainObject(sr)
						: {},
				},
			};
		}

		const crsId = makeUnknownCrsId(item);

		return {
			id: crsId,
			crsId,

			status: "unknown",

			horizontalCrsId: crsId,
			horizontalCoordinateSystemName:
				"unknown engineering CRS",

			verticalCrsId: null,
			verticalCoordinateSystemName: null,

			source:
				item?.source?.parserId ??
				item?.source?.fileName ??
				"import",

			family: "local_unknown",

			raw: isObject(sr)
				? clonePlainObject(sr)
				: {},
		};
	}

	const crsId = normalizeCrsId(horizontal);

	return {
		id: crsId,
		crsId,

		status: sr?.status ?? "declared",

		horizontalCrsId: crsId,

		horizontalCoordinateSystemName:
			sr?.horizontalCoordinateSystemName ??
			sr?.horizontal ??
			horizontal,

		verticalCrsId: sr?.verticalCrsId ?? null,
		verticalCoordinateSystemName:
			sr?.verticalCoordinateSystemName ?? null,

		source:
			sr?.source ??
			item?.source?.parserId ??
			null,

		family: classifyCrsFamily(crsId),

		raw: isObject(sr)
			? clonePlainObject(sr)
			: {},
	};
}

function inferEngineeringCrs(item) {
	const p = readRepresentativePoint(item);

	if (!p) return null;

	const x = Number(p.x);
	const y = Number(p.y);

	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		return null;
	}

	if (
		x > 2_000_000 &&
		x < 6_000_000 &&
		y > 5_000_000 &&
		y < 7_000_000
	) {
		const strip = Math.floor(x / 1_000_000);

		return {
			crsId: `INFERRED:GK:${strip}`,
			label: `inferred Gauss-Krüger strip ${strip}`,
			family: "gauss_krueger",

			heuristic: {
				type: "gk_strip_from_rechtswert",
				strip,
				x,
				y,
			},
		};
	}

	if (
		x > 100_000 &&
		x < 1_000_000 &&
		y > 100_000 &&
		y < 10_000_000
	) {
		return {
			crsId: "INFERRED:DBREF",
			label: "inferred DB reference system",
			family: "dbref",

			heuristic: {
				type: "dbref_like_range",
				x,
				y,
			},
		};
	}

	return null;
}

function classifyCrsFamily(crsId) {
	const s = String(crsId ?? "").toUpperCase();

	if (
		s.includes("GK") ||
		s.includes("GAUSS") ||
		s.includes("KRUEGER") ||
		s.includes("KRÜGER")
	) {
		return "gauss_krueger";
	}

	if (
		s.includes("UTM") ||
		s.startsWith("EPSG:258") ||
		s.startsWith("EPSG:32")
	) {
		return "utm";
	}

	if (
		s.includes("DBREF") ||
		s.startsWith("DB:DR")
	) {
		return "dbref";
	}

	if (
		s.startsWith("DB:DA")
	) {
		return "db_landessystem";
	}

	if (
		s.startsWith("UNKNOWN:")
	) {
		return "local_unknown";
	}

	return "unknown";
}

function makeUnknownCrsId(item) {
	const source =
		item?.source?.fileName ??
		item?.source?.parserId ??
		item?.meta?.sourceFile ??
		item?.payload?.name ??
		item?.id ??
		"import";

	const stem = safeIdStem(source);

	return `unknown:engineering:${stem}`;
}

function readRepresentativePoint(item) {
	const sparse =
		item?.derived?.sparseAlignment ??
		item?.payload?.sparseAlignment ??
		null;

	const pose =
		sparse?.startPose ??
		sparse?.pose ??
		null;

	const p =
		pose?.pnt ??
		pose?.point ??
		null;

	if (
		isObject(p) &&
		Number.isFinite(Number(p.x)) &&
		Number.isFinite(Number(p.y))
	) {
		return {
			x: Number(p.x),
			y: Number(p.y),
		};
	}

	return null;
}

function normalizeCrsId(value) {
	const s = String(value ?? "").trim();
	if (!s) return null;

	if (/^EPSG:/i.test(s)) return `EPSG:${s.split(":")[1]}`;
	if (/^DB:/i.test(s)) return `DB:${s.split(":")[1]}`;
	if (/^[A-Z]{2}\d$/i.test(s)) return `DB:${s.toUpperCase()}`;

	return s;
}

function registerCrsIfPossible(spotStore, crs, entry) {
	if (!crs?.crsId) return;

	if (typeof spotStore.addCrs === "function") {
		spotStore.addCrs(crs);
		return;
	}

	if (typeof spotStore.upsertCrs === "function") {
		spotStore.upsertCrs(crs);
		return;
	}

	if (isObject(entry)) {
		entry.meta = {
			...(entry.meta ?? {}),
			crsSnapshot: crs,
		};
	}
}

function buildSpotMeta(item, opts = {}) {
	const warnings = [
		...(Array.isArray(opts.warnings) ? opts.warnings : []),
	];

	const crs = normalizeSpotCrs(item);
	if (crs.status === "unknown" && !warnings.includes("no_crs_context")) {
		warnings.push("no_crs_context");
	}

	return {
		importItemId: item?.evidenceItemId ?? item?.id ?? null,
		evidenceId: item?.evidenceId ?? null,
		sourceEvidence: item?.derived?.sourceEvidenceSnapshot ?? null,
		source: clonePlainObject(item?.source),
		importMeta: clonePlainObject(item?.meta),
		importAssessment: clonePlainObject(item?.derived?.importAssessment),
		interpretation: isObject(item?.derived?.interpretation)
			? { ...item.derived.interpretation }
			: null,
		warnings,
	};
}

function normalizeProfilePoints(points) {
	const out = [];

	for (const p of asArray(points)) {
		const s = readMeasureValue(p?.s ?? p?.station ?? p?.sta ?? p?.chainage);
		const z = readMeasureValue(p?.z ?? p?.elevation ?? p?.height);

		if (!Number.isFinite(s) || !Number.isFinite(z)) continue;

		out.push({
			s,
			z,
			meta: clonePlainObject(p?.meta),
		});
	}

	return out;
}

function normalizeCantValues(points) {
	const out = [];

	for (const p of asArray(points)) {
		const s = readMeasureValue(p?.s ?? p?.station ?? p?.sta ?? p?.chainage);
		const cant = readMeasureValue(
			p?.cant ??
			p?.appliedCant ??
			p?.value ??
			p?.deltaH
		);

		if (!Number.isFinite(s) || !Number.isFinite(cant)) continue;

		out.push({
			s,
			cant,
			meta: clonePlainObject(p?.meta),
		});
	}

	return out;
}

function normalizeRelationEndpoint(value) {
	if (isObject(value)) {
		return {
			kind: value.kind ?? value.type ?? null,
			id: value.id ?? value.objectId ?? null,
		};
	}

	if (typeof value === "string" && value.trim()) {
		return {
			kind: null,
			id: value.trim(),
		};
	}

	return {
		kind: null,
		id: null,
	};
}

function normalizeRelationScope(scope) {
	if (!isObject(scope)) {
		return {
			sMin: null,
			sMax: null,
		};
	}

	return {
		sMin: Number.isFinite(Number(scope.sMin)) ? Number(scope.sMin) : null,
		sMax: Number.isFinite(Number(scope.sMax)) ? Number(scope.sMax) : null,
	};
}

function readMeasureValue(value) {
	if (isObject(value) && Number.isFinite(Number(value.value))) {
		return Number(value.value);
	}

	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function clonePlainObject(value) {
	return isObject(value) ? { ...value } : {};
}

function clonePlainValue(value) {
	if (Array.isArray(value)) return value.map(clonePlainValue);
	if (!isObject(value)) return value;
	return Object.fromEntries(
		Object.entries(value).map(([key, entry]) => [key, clonePlainValue(entry)])
	);
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function firstNonEmptyString(...values) {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return null;
}

function safeIdStem(value) {
	return String(value ?? "import")
		.trim()
		.replace(/\.[^.]+$/g, "")
		.replace(/[^a-zA-Z0-9_\-]+/g, "_")
		.replace(/^_+|_+$/g, "")
		|| "import";
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
