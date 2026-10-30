import { parsePointList } from "../../src/services/axtran2/pointLists.js";
import {
	createPointObservationSet,
	cloneObservationJson,
	observationJsonEqual,
} from "../../src/domain/observation/PointObservationSet.js";
import { preparePointObservationInput } from "../../src/services/alignment/AlignmentPointEvidenceRequest.js";

export const POINT_OBSERVATION_ADAPTER_VERSION = "point-observation-list-adapter/1";
const PARSER = "src/services/axtran2/pointLists.js#parsePointList";

export class PointObservationAdapterError extends TypeError {
	constructor(code, message, { line = null, column = null } = {}) {
		super(message);
		this.name = "PointObservationAdapterError";
		this.code = code;
		this.line = line;
		this.column = column;
	}
}

function fail(code, message, location) {
	throw new PointObservationAdapterError(code, message, location);
}

function requireRecord(value, label) {
	if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_INPUT", `${label} must be a JSON object`);
}

function requireFields(input, allowed) {
	for (const key of Object.keys(input)) if (!allowed.includes(key)) fail("UNKNOWN_INPUT_FIELD", `unsupported input field: ${key}`);
}

function numberCell(raw, decimal, line, column) {
	const cell = raw.trim();
	const pattern = decimal === "dot"
		? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
		: /^[+-]?(?:\d+(?:,\d*)?|,\d+)(?:[eE][+-]?\d+)?$/;
	if (!pattern.test(cell)) fail("INVALID_NUMBER", `line ${line}, ${column}: expected a number in the declared ${decimal} notation`, { line, column });
	const number = Number(decimal === "comma" ? cell.replace(",", ".") : cell);
	if (!Number.isFinite(number) || Object.is(number, -0)) fail("INVALID_NUMBER", `line ${line}, ${column}: number must be finite and JSON-roundtrippable`, { line, column });
	return number;
}

/**
 * Strict, declared subset of pointLists, not a general CSV reader. Only
 * semicolons, canonical unpadded headers and dot/comma decimal notation are
 * supported. Exponents are allowed; grouping, quotes and inline comments are
 * not. Original text/cells are retained; numeric values are JS Numbers.
 *
 * No roles, default tolerances, coordinate shifts or CRS claims are inferred.
 * The caller supplies source identity/revision and the shared metric context.
 */
export function importPointObservationList(input) {
	const copy = cloneObservationJson(input);
	requireRecord(copy, "input");
	requireFields(copy, ["text", "id", "revision", "source", "metricContext", "kind", "decimal"]);
	const { text, id, revision, source, metricContext, kind, decimal } = copy;
	if (typeof text !== "string") fail("INVALID_TEXT", "text must be the original decoded text");
	if (!["points", "zwang"].includes(kind)) fail("INVALID_KIND", "kind must explicitly be points or zwang");
	if (!["dot", "comma"].includes(decimal)) fail("INVALID_DECIMAL", "decimal must explicitly be dot or comma");
	requireRecord(source, "source");
	if (Object.hasOwn(source, "pointList")) fail("RESERVED_SOURCE_METADATA", "source.pointList is reserved for adapter metadata");

	const allowed = ["name", "easting", "northing", "tolerance", ...(kind === "zwang" ? ["distance"] : [])];
	const required = ["name", "easting", "northing", ...(kind === "zwang" ? ["distance"] : [])];
	let headers = null;
	const rows = [];
	const seen = new Set();
	for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
		const line = index + 1;
		const trimmed = rawLine.trim();
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
		if (rawLine.includes("\r") || /["']/.test(rawLine) || rawLine.includes("#") || rawLine.includes("//")) {
			fail("UNSUPPORTED_LINE_SYNTAX", `line ${line}: quotes, bare carriage returns and inline comments are unsupported`, { line });
		}
		const cells = rawLine.split(";");
		if (!headers) {
			if (cells.some((cell) => !allowed.includes(cell)) || new Set(cells).size !== cells.length ||
				required.some((name) => !cells.includes(name))) {
				fail("INVALID_HEADER", `line ${line}: declare unique canonical headers ${required.join(";")} with optional tolerance`, { line });
			}
			headers = cells;
			continue;
		}
		if (cells.length !== headers.length) fail("COLUMN_COUNT", `line ${line}: cell count differs from the header`, { line });
		const original = Object.fromEntries(headers.map((header, i) => [header, cells[i]]));
		const name = original.name;
		if (!name || name !== name.trim()) fail("INVALID_POINT_ID", `line ${line}: name must be explicit, non-empty and unpadded`, { line, column: "name" });
		if (seen.has(name)) fail("DUPLICATE_POINT_ID", `line ${line}: duplicate point name ${name}`, { line, column: "name" });
		seen.add(name);
		const x = numberCell(original.easting, decimal, line, "easting");
		const y = numberCell(original.northing, decimal, line, "northing");
		const pointSource = { line, cells: original };
		if (headers.includes("distance")) pointSource.declaredDistance = numberCell(original.distance, decimal, line, "distance");
		if (headers.includes("tolerance")) {
			const tolerance = numberCell(original.tolerance, decimal, line, "tolerance");
			if (tolerance <= 0) fail("INVALID_TOLERANCE", `line ${line}: tolerance must be explicitly positive`, { line, column: "tolerance" });
			pointSource.declaredTolerance = tolerance;
		}
		rows.push({ id: name, x, y, source: pointSource });
	}
	if (!headers) fail("MISSING_HEADER", "no canonical header was supplied");
	if (!rows.length) fail("NO_POINTS", "the source contains no point rows");

	// Actually use the existing parser, but only after every accepted row is
	// unambiguous. No automatic ID or tolerance fallback may survive this check.
	let parsed;
	try {
		parsed = parsePointList(text, { kind, axes: "en", tolerance: null });
	} catch (error) {
		fail("PARSER_DISAGREEMENT", `the existing point-list parser refused the validated subset (${String(error?.code ?? error?.name)})`);
	}
	const expected = rows.map((point) => ({
		name: point.id, x: point.x, y: point.y,
		tolerance: point.source.declaredTolerance ?? null,
		...(kind === "zwang" ? { distance: point.source.declaredDistance } : {}),
	}));
	if (!observationJsonEqual(parsed, expected)) fail("PARSER_DISAGREEMENT", "the existing point-list parser disagrees with the explicit source mapping");
	return createPointObservationSet({
		id, revision, metricContext,
		source: { ...source, pointList: { version: POINT_OBSERVATION_ADAPTER_VERSION, parser: PARSER, kind, decimal, originalText: text } },
		points: rows,
	});
}

function revalidateImport(observationSet) {
	const set = createPointObservationSet(observationSet);
	const metadata = set.source.pointList;
	if (!metadata || metadata.version !== POINT_OBSERVATION_ADAPTER_VERSION || metadata.parser !== PARSER) {
		fail("UNKNOWN_SOURCE_ADAPTER", "source selectors require the supported point-list adapter provenance");
	}
	const { pointList, ...source } = set.source;
	const rebuilt = importPointObservationList({
		text: metadata.originalText, id: set.id, revision: set.revision, source, metricContext: set.metricContext,
		kind: metadata.kind, decimal: metadata.decimal,
	});
	if (!observationJsonEqual(rebuilt, set)) fail("SOURCE_REIMPORT_MISMATCH", "source coordinates, cells, line numbers or declared values do not match a deterministic reimport");
	return set;
}

function resolveDeclaration(value, selector, sourceKey, cellKey, point) {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (value !== selector) fail("INVALID_DECLARATION", `point ${point.id}: expected an explicit number or ${selector}`);
	if (!Object.hasOwn(point.source.cells, cellKey) || !Object.hasOwn(point.source, sourceKey) || !Number.isFinite(point.source[sourceKey])) {
		fail("MISSING_SOURCE_COLUMN", `point ${point.id}: ${selector} requires the corresponding declared source column`);
	}
	return point.source[sourceKey];
}

/**
 * A separate, explicit role declaration. File kind is provenance only: it does
 * not choose enforcement, offsets or the role. Reimport is a consistency check,
 * not authentication of the source or approval of its engineering meaning.
 */
export function preparePointListEvidenceInput(input) {
	const copy = cloneObservationJson(input);
	requireRecord(copy, "input");
	requireFields(copy, ["observationSet", "alignmentMetricContext", "assignments"]);
	const observationSet = revalidateImport(copy.observationSet);
	if (!Array.isArray(copy.assignments)) fail("INVALID_ASSIGNMENTS", "assignments must be explicit");
	const byId = new Map(observationSet.points.map((point) => [point.id, point]));
	const assignments = copy.assignments.map((assignment) => {
		requireRecord(assignment, "assignment");
		if (Object.hasOwn(assignment, "declaration")) fail("RESERVED_DECLARATION", "assignment.declaration is reserved for the original declared inputs");
		const { pointId, role, target, tolerance, enforcement } = assignment;
		const point = byId.get(pointId);
		if (!point) fail("UNKNOWN_POINT", `assignment references unknown point ${String(pointId)}`);
		if (!["axis", "offset"].includes(role)) fail("INVALID_ROLE", `point ${pointId}: role must explicitly be axis or offset`);
		if (!["soft", "hard"].includes(enforcement)) fail("INVALID_ENFORCEMENT", `point ${pointId}: enforcement must explicitly be soft or hard`);
		const resolvedTarget = resolveDeclaration(target, "source-distance", "declaredDistance", "distance", point);
		const resolvedTolerance = resolveDeclaration(tolerance, "source-tolerance", "declaredTolerance", "tolerance", point);
		if (role === "axis" && resolvedTarget !== 0) fail("INVALID_AXIS_TARGET", `point ${pointId}: axis role requires an explicitly zero target`);
		if (resolvedTolerance <= 0) fail("INVALID_TOLERANCE", `point ${pointId}: tolerance must be positive`);
		return {
			...assignment, target: resolvedTarget, tolerance: resolvedTolerance,
			declaration: { role, target, tolerance, enforcement },
		};
	});
	return preparePointObservationInput({ observationSet, assignments, alignmentMetricContext: copy.alignmentMetricContext });
}
