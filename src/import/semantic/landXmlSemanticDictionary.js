// src/import/semantic/landXmlSemanticDictionary.js

export const LANDXML_SEMANTIC_DICTIONARY = {
	version: 1,

	targets: {
		"staStart": {
			semanticClass: "length",
			semanticRole: "stationStart",
			unit: "m",
		},

		"length": {
			semanticClass: "length",
			semanticRole: "arcLength",
			unit: "m",
		},

		"Start.northing": {
			semanticClass: "coordinate",
			semanticRole: "startCoordinate",
			axis: "northing",
			unit: "m",
		},

		"Start.easting": {
			semanticClass: "coordinate",
			semanticRole: "startCoordinate",
			axis: "easting",
			unit: "m",
		},

		"End.northing": {
			semanticClass: "coordinate",
			semanticRole: "endCoordinate",
			axis: "northing",
			unit: "m",
		},

		"End.easting": {
			semanticClass: "coordinate",
			semanticRole: "endCoordinate",
			axis: "easting",
			unit: "m",
		},

		"dir": {
			semanticClass: "angle",
			semanticRole: "direction",
			unit: "rad",
			rotationSense: "cw",
			zeroAxis: "north",
		},

		"deltaDirection": {
			semanticClass: "angle",
			semanticRole: "deltaDirection",
			unit: "rad",
			rotationSense: "cw",
			zeroAxis: "north",
		},

		"radius": {
			semanticClass: "curvature",
			semanticRole: "radius",
			representation: "radius",
			unit: "m",
			zeroMeaning: "straight",
		},

		"radiusStart": {
			semanticClass: "curvature",
			semanticRole: "radiusStart",
			representation: "radius",
			unit: "m",
			zeroMeaning: "straight",
		},

		"radiusEnd": {
			semanticClass: "curvature",
			semanticRole: "radiusEnd",
			representation: "radius",
			unit: "m",
			zeroMeaning: "straight",
		},

		"cantStart": {
			semanticClass: "cant",
			semanticRole: "cantStart",
			unit: "mm",
		},

		"cantEnd": {
			semanticClass: "cant",
			semanticRole: "cantEnd",
			unit: "mm",
		},

		"spiType": {
			semanticClass: "transitionType",
			semanticRole: "spiralType",
		},

		"kindCode": {
			semanticClass: "enum",
			semanticRole: "segmentKind",
		},

		"pointNumber": {
			semanticClass: "identifier",
			semanticRole: "pointNumber",
		},

		"vendor.fieldC": {
			semanticClass: "custom",
			semanticRole: "vendorSpecific",
		},
	},
};
