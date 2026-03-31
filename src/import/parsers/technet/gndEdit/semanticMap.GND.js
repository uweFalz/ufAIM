//

const GND_EL_EK_SEMANTIC_MAP = {
	formatId: "gndEdit",
	fileType: "EL_EK",
	version: 1,

	defaults: {
		units: {
			linearUnit: "meter",
			elevationUnit: "meter",
			angularUnit: "gon",
		},
		angular: {
			direction: {
				unit: "gon",
				orientation: "cw",
				origin: "north",
			},
			kinkDelta: {
				unit: "gon",
				orientation: "cw",
				origin: "west",
			},
		},
		curvature: {
			representation: "radius",
			unit: "meter",
		},
	},

	typeDispatch: {
		0: { targetType: "Line",   spiType: null },
		1: { targetType: "Curve",  spiType: null },
		2: { targetType: "Spiral", spiType: "Klothoide" },
		3: { targetType: "Spiral", spiType: "ÜB S-Form" },
		4: { targetType: "Spiral", spiType: "Bloss" },
		5: { targetType: "Kink",   spiType: null },
		6: { targetType: "StaEquation", spiType: null },
		7: { targetType: "Spiral", spiType: "S-Form (1f geschw.)" },
		8: { targetType: "Spiral", spiType: "Bloss (1f geschw.)" },
	},
};
