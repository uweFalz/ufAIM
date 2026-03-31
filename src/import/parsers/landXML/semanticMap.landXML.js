// src/import/parsers/landXML/semanticMap.landXML.js

export const LANDXML_SEMANTIC_MAP = {
	formatId: "landXML",
	fileType: "Alignment",
	version: 1,

	defaults: {
		angular: {
			unit: "radian",
			orientation: "ccw",
			origin: "east",
		},
		radius: {
			representation: "radius",
		},
	},

	fieldMap: {
		staStart: { defaultTarget: "staStart" },
		length: { defaultTarget: "length" },

		dir: { defaultTarget: "direction" },

		dirStart: { defaultTarget: "dirStart" },
		dirEnd: { defaultTarget: "dirEnd" },
		theta: { defaultTarget: "theta" },

		radius: { defaultTarget: "radius" },
		radiusStart: { defaultTarget: "radiusStart" },
		radiusEnd: { defaultTarget: "radiusEnd" },

		spiType: { defaultTarget: "spiType" },

		Start: { defaultTarget: "start" },
		End: { defaultTarget: "end" },
		Center: { defaultTarget: "center" },
		PI: { defaultTarget: "pi" },
	},

	specialCases: {
		semanticOverrides: [],
		semanticAlerts: {},
	},
};
