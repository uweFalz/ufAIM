import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
	appendVerticalElement,
	createVerticalConstructiveState,
} from "../src/aim-core/alignment/profile/VerticalConstructiveState.js";
import {
	appendCantElement,
	createCantConstructiveState,
} from "../src/aim-core/alignment/profile/CantConstructiveState.js";
import {
	appendChainageSegment,
	createChainageMapping,
} from "../src/aim-core/alignment/profile/ChainageMapping.js";
import AlignmentProfileApplicationService from "../src/services/alignment/AlignmentProfileApplicationService.js";

export const AIM_CORE_PROFILE_DEMO_VERSION =
	"aim-core-profile-demo-runner/0.1";

const FIXTURE_VERSION = "aim-core-profile-demo/0.1";
const FIXTURE_URL = new URL(
	"../test/fixtures/aim-core/alignment-profile-demo.json",
	import.meta.url
);

function fixtureError(message) {
	throw new TypeError(`aim-core-profile-demo: ${message}`);
}

function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateFixture(fixture) {
	if (!isObject(fixture)) {
		fixtureError("fixture must be a non-array object");
	}
	if (fixture.fixtureVersion !== FIXTURE_VERSION) {
		fixtureError(`fixtureVersion must be ${FIXTURE_VERSION}`);
	}
	if (
		typeof fixture.alignmentId !== "string" ||
		fixture.alignmentId.trim() === ""
	) {
		fixtureError("alignmentId must be a non-empty string");
	}
	if (
		!Array.isArray(fixture.positions) ||
		fixture.positions.some((position) => !Number.isFinite(position))
	) {
		fixtureError("positions must be an array of finite numbers");
	}
	if (
		!isObject(fixture.vertical) ||
		typeof fixture.vertical.id !== "string" ||
		!Array.isArray(fixture.vertical.elements)
	) {
		fixtureError("vertical state definition is required");
	}
	if (
		!isObject(fixture.cant) ||
		typeof fixture.cant.id !== "string" ||
		!Array.isArray(fixture.cant.elements)
	) {
		fixtureError("cant state definition is required");
	}
	if (
		!Array.isArray(fixture.chainageMappings) ||
		fixture.chainageMappings.some(
			(mapping) =>
				!isObject(mapping) ||
				typeof mapping.id !== "string" ||
				typeof mapping.schemeId !== "string" ||
				typeof mapping.schemeVersion !== "string" ||
				!Array.isArray(mapping.segments)
		)
	) {
		fixtureError("chainage mapping definitions are required");
	}
	return fixture;
}

export function buildAlignmentProfileDemoRecord(fixture) {
	const validated = validateFixture(fixture);
	const alignmentId = validated.alignmentId;

	let vertical = createVerticalConstructiveState({
		id: validated.vertical.id,
		alignmentId,
	});
	for (const element of validated.vertical.elements) {
		vertical = appendVerticalElement(vertical, element);
	}

	let cant = createCantConstructiveState({
		id: validated.cant.id,
		alignmentId,
	});
	for (const element of validated.cant.elements) {
		cant = appendCantElement(cant, element);
	}

	const chainageMappings = validated.chainageMappings.map((definition) => {
		let mapping = createChainageMapping({
			id: definition.id,
			alignmentId,
			schemeId: definition.schemeId,
			schemeVersion: definition.schemeVersion,
		});
		for (const segment of definition.segments) {
			mapping = appendChainageSegment(mapping, segment);
		}
		return mapping;
	});

	return Object.freeze({
		alignmentId,
		vertical,
		cant,
		chainageMappings: Object.freeze(chainageMappings),
	});
}

export async function runAlignmentProfileDemo() {
	const fixture = JSON.parse(await readFile(FIXTURE_URL, "utf8"));
	validateFixture(fixture);
	const record = buildAlignmentProfileDemoRecord(fixture);
	const service = new AlignmentProfileApplicationService({
		records: [record],
	});
	const batch = await service.evaluateMany({
		alignmentId: fixture.alignmentId,
		positions: fixture.positions,
	});
	return Object.freeze({
		demoVersion: AIM_CORE_PROFILE_DEMO_VERSION,
		fixtureVersion: FIXTURE_VERSION,
		synthetic: true,
		batch,
	});
}

if (
	process.argv[1] &&
	fileURLToPath(import.meta.url) === process.argv[1]
) {
	const result = await runAlignmentProfileDemo();
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
