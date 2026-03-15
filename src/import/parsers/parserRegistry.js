// src/import/parsers/parserRegistry.js

import { parseLandXML } from "./parseLandXML.js";
import { parseTraGraAuto } from "./parseTRA_GRA.js";
// optional später
// import { parseIFC } from "./parseIFC.js";

export const parserRegistry = [
{
	id: "landxml",
	label: "LandXML",
	canHandle: ({ parserKey }) => parserKey === "landxml",
	parseToLandFAT: async (file, ctx = {}) => {
		const text = await file.text();
		return parseLandXML(text, file.name);
	},
},

{
	id: "vermesn",
	label: "TRA/GRA",
	canHandle: ({ parserKey }) =>
	parserKey === "tra" ||
	parserKey === "gra" ||
	parserKey === "vermesn",
	parseToLandFAT: async (file, ctx = {}) => {
		return await parseTraGraAuto(file, ctx);
	},
},

// später
// {
// 	id: "ifc",
// 	label: "IFC",
// 	canHandle: ({ parserKey }) => parserKey === "ifc",
// 	parseToLandFAT: async (file, ctx = {}) => {
// 		return await parseIFC(file, ctx);
// 	},
// },
];

export function resolveParser(sniffResult) {

	for (const entry of parserRegistry) {
		if (entry.canHandle?.(sniffResult)) return entry;
	}

	return null;
}
