// src/import/parsers/_e2eParserValidationTest.js

import { getParserIds, loadParserModule } from "./parserRegistry.js";
import { validateParserModule } from "./validateParserModule.js";

function assert(condition, message) {
	if (!condition) {
		throw new Error(`ParserValidation E2E FAIL: ${message}`);
	}
}

function expectFail(fn, expectedCode) {
	let didFail = false;

	try {
		fn();
	} catch (err) {
		didFail = true;
		if (expectedCode) {
			assert(err?.code === expectedCode, `expected code ${expectedCode}, got ${String(err?.code)}`);
		}
		assert(
			err?.kind === "structural" || err?.kind === "runtime",
			`expected structured kind for ${expectedCode ?? "failure"}`
		);
	}

	assert(didFail, `expected failure${expectedCode ? ` (${expectedCode})` : ""}`);
}

function makeValidModule(id) {
	return {
		meta: { id, label: `Parser ${id}` },
		sniff: {
			extensions: ["abc"],
			looksLike: async () => true,
		},
		parse: async () => ({ ok: true }),
	};
}

function runContractUnitChecks() {
	expectFail(() => validateParserModule("x", null), "PARSER_MODULE_INVALID");
	expectFail(() => validateParserModule("x", {}), "PARSER_META_MISSING");
	expectFail(
		() =>
			validateParserModule("x", {
				meta: {},
				sniff: { extensions: ["x"] },
				parse: async () => ({}),
			}),
		"PARSER_META_ID_MISSING"
	);
	expectFail(
		() =>
			validateParserModule("x", {
				meta: { id: "other" },
				sniff: { extensions: ["x"] },
				parse: async () => ({}),
			}),
		"PARSER_META_ID_MISMATCH"
	);
	expectFail(
		() =>
			validateParserModule("x", {
				meta: { id: "x", label: 123 },
				sniff: { extensions: ["x"] },
				parse: async () => ({}),
			}),
		"PARSER_META_LABEL_INVALID"
	);
	expectFail(
		() =>
			validateParserModule("x", {
				meta: { id: "x" },
				sniff: { extensions: ["x"], looksLike: true },
				parse: async () => ({}),
			}),
		"PARSER_SNIFF_LOOKSLIKE_INVALID"
	);
	expectFail(
		() =>
			validateParserModule("x", {
				meta: { id: "x" },
				sniff: { extensions: ["", "ok"] },
				parse: async () => ({}),
			}),
		"PARSER_SNIFF_EXTENSION_INVALID"
	);
	expectFail(
		() =>
			validateParserModule("x", {
				meta: { id: "x" },
				sniff: { extensions: ["x"] },
			}),
		"PARSER_PARSE_MISSING"
	);
	expectFail(
		() =>
			validateParserModule("x", {
				meta: { id: "x" },
				sniff: { extensions: ["x"] },
				parse: 1,
			}),
		"PARSER_PARSE_NON_CALLABLE"
	);
	expectFail(
		() =>
			validateParserModule("stubber", {
				meta: { id: "stubber", status: "stub" },
				sniff: { extensions: ["x"] },
				parse: async () => ({}),
			}),
		"PARSER_META_STUB_REASON_MISSING"
	);

	validateParserModule("stubber", {
		meta: {
			id: "stubber",
			status: "incomplete",
			stubReason: "planned parser",
			label: "Stub Parser",
		},
		sniff: { extensions: ["stub"] },
		parse: async () => ({ ok: true }),
	});

	expectFail(
		() =>
			validateParserModule("x", {
				...makeValidModule("x"),
				semanticMap: {
					formatId: "f",
					fileType: "t",
					fieldMap: {
						K: { defaultTarget: "!!!invalid-target!!!" },
					},
				},
			}),
		"PARSER_SEMANTIC_TARGET_UNKNOWN"
	);

	expectFail(
		() =>
			validateParserModule("x", {
				...makeValidModule("x"),
				transTypeMap: {
					foo: "unknownTransition",
				},
			}),
		"PARSER_TRANSITION_TYPE_UNKNOWN"
	);

	validateParserModule("x", {
		...makeValidModule("x"),
		semanticMap: {
			formatId: "landfat",
			fileType: "alignment",
			fieldMap: {
				staStart: { defaultTarget: "staStart" },
				nested: { defaultTarget: "Alignment.coordGeom.elements[*].length" },
			},
			specialCases: {
				semanticOverrides: [
					{
						when: { field: "kind" },
						override: { field: "kind", target: "radius" },
					},
				],
				semanticAlerts: {},
			},
		},
		transTypeMap: {
			clothoidRaw: "clothoid",
		},
	});
}

async function runRegistryChecks() {
	const parserIds = getParserIds();
	assert(Array.isArray(parserIds) && parserIds.length > 0, "registry parser ids missing");

	for (const parserId of parserIds) {
		const mod = await loadParserModule(parserId);
		validateParserModule(parserId, mod);
	}
}

(async function runParserValidationE2E() {
	console.log("ParserValidation E2E starting...");

	runContractUnitChecks();
	await runRegistryChecks();

	if (typeof window !== "undefined") {
		window.__parserValidationE2E = {
			passed: true,
			ts: Date.now(),
		};
	}

	console.log("ParserValidation E2E PASSED");
})();
