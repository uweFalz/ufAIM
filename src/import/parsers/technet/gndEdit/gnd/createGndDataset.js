// src/import/parsers/technet/gndEdit/gnd/createGndDataset.js

export function createGndDataset({
	source = {},
	workbookInfo = null,
	tables = {},
} = {}) {
	return {
		type: "GndDataset",
		version: 1,

		source: {
			parserId: source.parserId ?? "gndEdit",
			backend: source.backend ?? "unknown",
			fileName: source.fileName ?? "",
		},

		workbookInfo,

		tables,
	};
}
